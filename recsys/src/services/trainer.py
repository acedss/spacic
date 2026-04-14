"""
ALS Trainer
─────────────────────────────────────────────────────────────
Reads ListenEvents from MongoDB → builds sparse interaction matrix →
trains ALS (implicit library) → writes top-K recs to Redis.

Implicit rating formula per (user, song) pair:
  rating = completion_rate * 0.50
         + countedStream  * 0.30
         + (1-wasSkipped) * 0.20

Where completion_rate = max(listenedMs across all events for that pair) / songDuration
"""

import asyncio
import time
import logging
from datetime import datetime, timezone, timedelta
from collections import defaultdict

import numpy as np
import scipy.sparse as sp
import implicit

from ..db.mongo import get_db
from ..services.feature_store import (
    set_user_recs, set_model_meta, set_training_lock,
)
from ..config import get_settings

logger = logging.getLogger(__name__)

# Singleton: last training result for status endpoint
_last_metrics: dict = {}


async def run_training(force: bool = False) -> dict:
    """
    Full training pipeline. Returns metrics dict.
    Called by APScheduler nightly OR POST /admin/train.
    """
    settings = get_settings()
    db = get_db()
    t0 = time.perf_counter()

    await set_training_lock(True)
    logger.info("RecSys training started")

    try:
        # ── 1. Load interaction data from MongoDB ──────────────────────────────
        # Pull last 90 days of ListenEvents (TTL matches this window)
        cutoff = datetime.now(timezone.utc) - timedelta(days=90)

        cursor = db["listenevents"].find(
            {"playedAt": {"$gte": cutoff}},
            {"userId": 1, "songId": 1, "listenedMs": 1,
             "countedStream": 1, "wasSkipped": 1},
        )

        # Also fetch song durations for completion rate
        songs_cursor = db["songs"].find({}, {"_id": 1, "duration": 1})
        song_durations: dict[str, float] = {}
        async for song in songs_cursor:
            song_durations[str(song["_id"])] = float(song.get("duration", 1))

        # Aggregate: (userId, songId) → best implicit rating
        pair_signals: dict[tuple, dict] = defaultdict(
            lambda: {"max_listened_ms": 0.0, "counted_stream": False, "was_skipped": True}
        )

        async for event in cursor:
            uid = str(event["userId"])
            sid = str(event["songId"])
            key = (uid, sid)
            pair_signals[key]["max_listened_ms"] = max(
                pair_signals[key]["max_listened_ms"],
                float(event.get("listenedMs", 0)),
            )
            if event.get("countedStream"):
                pair_signals[key]["counted_stream"] = True
            if not event.get("wasSkipped", True):
                pair_signals[key]["was_skipped"] = False

        if not pair_signals:
            logger.warning("No interaction data found — skipping training")
            await set_training_lock(False)
            return {"error": "no_data"}

        # ── 2. Build user/song index maps ──────────────────────────────────────
        user_ids = sorted({k[0] for k in pair_signals})
        song_ids = sorted({k[1] for k in pair_signals})
        user_idx = {u: i for i, u in enumerate(user_ids)}
        song_idx = {s: i for i, s in enumerate(song_ids)}

        # ── 3. Compute implicit ratings → sparse matrix ────────────────────────
        rows, cols, data = [], [], []
        for (uid, sid), signals in pair_signals.items():
            duration = song_durations.get(sid, 30_000)  # fallback 30s
            completion = min(signals["max_listened_ms"] / max(duration * 1000, 1), 1.0)
            rating = (
                completion * 0.50
                + (1.0 if signals["counted_stream"] else 0.0) * 0.30
                + (0.0 if signals["was_skipped"] else 1.0) * 0.20
            )
            if rating > 0:
                rows.append(user_idx[uid])
                cols.append(song_idx[sid])
                data.append(rating)

        interaction_matrix = sp.csr_matrix(
            (data, (rows, cols)),
            shape=(len(user_ids), len(song_ids)),
            dtype=np.float32,
        )

        # ── 4. Train ALS ───────────────────────────────────────────────────────
        model = implicit.als.AlternatingLeastSquares(
            factors=settings.ALS_FACTORS,
            iterations=settings.ALS_ITERATIONS,
            regularization=settings.ALS_REGULARIZATION,
            random_state=42,
        )
        # implicit expects (items × users) matrix
        model.fit(interaction_matrix.T)

        # ── 5. Generate top-K recommendations for all users ───────────────────
        top_k = settings.TOP_K
        # Batch recommend for all users at once
        user_items = interaction_matrix  # (users × items)

        tasks = []
        batch_size = 100
        for i in range(0, len(user_ids), batch_size):
            batch_users = list(range(i, min(i + batch_size, len(user_ids))))
            ids, scores = model.recommend(
                batch_users,
                user_items[batch_users],
                N=top_k,
                filter_already_liked_items=True,
            )
            for j, u_local_idx in enumerate(batch_users):
                uid_str = user_ids[u_local_idx]
                rec_song_ids = [song_ids[int(s)] for s in ids[j]]
                tasks.append(set_user_recs(uid_str, rec_song_ids))

        await asyncio.gather(*tasks)

        # ── 6. Compute basic coverage metric ──────────────────────────────────
        all_recommended = set()
        ids_flat, _ = model.recommend(
            list(range(len(user_ids))),
            interaction_matrix,
            N=top_k,
            filter_already_liked_items=False,
        )
        for row in ids_flat:
            all_recommended.update(int(s) for s in row)
        coverage = len(all_recommended) / len(song_ids) if song_ids else 0.0

        duration = time.perf_counter() - t0
        version = f"v{int(datetime.now(timezone.utc).timestamp())}"
        trained_at = datetime.now(timezone.utc)

        await set_model_meta(version, trained_at, duration)

        metrics = {
            "version": version,
            "trained_at": trained_at.isoformat(),
            "duration_s": round(duration, 2),
            "training_users": len(user_ids),
            "training_songs": len(song_ids),
            "training_interactions": len(pair_signals),
            "coverage": round(coverage, 3),
        }
        global _last_metrics
        _last_metrics = metrics
        logger.info("RecSys training done: %s", metrics)
        return metrics

    except Exception as exc:
        logger.exception("Training failed: %s", exc)
        await set_training_lock(False)
        raise
    finally:
        await set_training_lock(False)


def get_last_metrics() -> dict:
    return _last_metrics

"""
ALS Trainer — reads Listener join records from MongoDB, trains an implicit
ALS model on (user, room) interactions, writes top-K room recommendations
per user to Redis.

Implicit confidence per (user, room) pair:
  confidence = num_sessions + log1p(total_minutes_listened)

Rationale: each join is a strong "I chose this room" signal; total minutes
add a duration-aware boost without letting a single marathon session dominate.
"""

import asyncio
import math
import time
import logging
from datetime import datetime, timezone, timedelta
from collections import defaultdict

import numpy as np
import scipy.sparse as sp
import implicit

from ..db.mongo import get_db
from ..services.feature_store import set_user_recs, set_model_meta, set_training_lock
from ..config import get_settings

logger = logging.getLogger(__name__)

_last_metrics: dict = {}


async def run_training(force: bool = False) -> dict:
    settings = get_settings()
    db = get_db()
    t0 = time.perf_counter()

    await set_training_lock(True)
    logger.info("RecSys training started (rooms)")

    try:
        cutoff = datetime.now(timezone.utc) - timedelta(days=90)

        # One Listener doc = one user-room session.  Use joinedAt/leftAt to
        # derive duration; isActive sessions (leftAt=null) get a small default.
        cursor = db["listeners"].find(
            {"joinedAt": {"$gte": cutoff}},
            {"userId": 1, "roomId": 1, "joinedAt": 1, "leftAt": 1},
        )

        pair_signals: dict[tuple, dict] = defaultdict(
            lambda: {"sessions": 0, "minutes": 0.0}
        )

        async for ev in cursor:
            uid = str(ev["userId"])
            rid = str(ev["roomId"])
            joined = ev.get("joinedAt")
            left = ev.get("leftAt")
            if joined and left:
                minutes = max((left - joined).total_seconds() / 60.0, 0.0)
            else:
                minutes = 5.0  # default for still-active or missing leftAt
            pair_signals[(uid, rid)]["sessions"] += 1
            pair_signals[(uid, rid)]["minutes"] += minutes

        if not pair_signals:
            logger.warning("No listener data found — skipping training")
            await set_training_lock(False)
            return {"error": "no_data"}

        user_ids = sorted({k[0] for k in pair_signals})
        room_ids = sorted({k[1] for k in pair_signals})
        user_idx = {u: i for i, u in enumerate(user_ids)}
        room_idx = {r: i for i, r in enumerate(room_ids)}

        rows, cols, data = [], [], []
        for (uid, rid), sig in pair_signals.items():
            confidence = sig["sessions"] + math.log1p(sig["minutes"])
            if confidence > 0:
                rows.append(user_idx[uid])
                cols.append(room_idx[rid])
                data.append(confidence)

        # user × room CSR — rows=users, cols=rooms
        interaction_matrix = sp.csr_matrix(
            (data, (rows, cols)),
            shape=(len(user_ids), len(room_ids)),
            dtype=np.float32,
        )

        model = implicit.als.AlternatingLeastSquares(
            factors=settings.ALS_FACTORS,
            iterations=settings.ALS_ITERATIONS,
            regularization=settings.ALS_REGULARIZATION,
            random_state=42,
        )
        # implicit ≥0.6 expects user × item matrix directly to .fit()
        model.fit(interaction_matrix)

        # Cap N at len(rooms)-1 to dodge implicit's topK off-by-one in C ext.
        top_k = max(1, min(settings.TOP_K, len(room_ids) - 1))

        tasks = []
        for u_idx in range(len(user_ids)):
            ids, _ = model.recommend(
                u_idx,
                interaction_matrix[u_idx],
                N=top_k,
                filter_already_liked_items=True,
            )
            # implicit pads with -1 when fewer than N candidates remain after
            # filtering — guard against out-of-range indices before lookup.
            valid = [room_ids[int(s)] for s in ids if 0 <= int(s) < len(room_ids)]
            tasks.append(set_user_recs(user_ids[u_idx], valid))

        await asyncio.gather(*tasks)

        all_recommended = set()
        for u_idx in range(len(user_ids)):
            ids, _ = model.recommend(
                u_idx,
                interaction_matrix[u_idx],
                N=top_k,
                filter_already_liked_items=False,
            )
            all_recommended.update(int(s) for s in ids if 0 <= int(s) < len(room_ids))
        coverage = len(all_recommended) / len(room_ids) if room_ids else 0.0

        duration = time.perf_counter() - t0
        version = f"v{int(datetime.now(timezone.utc).timestamp())}"
        trained_at = datetime.now(timezone.utc)

        await set_model_meta(version, trained_at, duration)

        metrics = {
            "version": version,
            "trained_at": trained_at.isoformat(),
            "duration_s": round(duration, 2),
            "training_users": len(user_ids),
            "training_rooms": len(room_ids),
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

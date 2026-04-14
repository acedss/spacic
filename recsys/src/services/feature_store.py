"""
Redis Feature Store
─────────────────────────────────────────────────────────────
Key schema:
  recsys:user:{userId}:recs        → JSON list of top-K songId strings
  recsys:user:{userId}:recs:ts     → ISO timestamp when recs were written
  recsys:stats:requests            → int  (total recommendation requests)
  recsys:stats:hits                → int  (requests served from cache)
  recsys:meta:model_version        → string
  recsys:meta:trained_at           → ISO timestamp
  recsys:meta:training_duration_s  → float string
  recsys:meta:is_training          → "1" | "0"
"""

import json
from datetime import datetime, timezone
from ..db.redis_client import get_redis


RECS_TTL = 86_400 * 2  # pre-computed recs expire after 2 days


# ── Read ──────────────────────────────────────────────────────────────────────

async def get_user_recs(user_id: str) -> list[str] | None:
    r = get_redis()
    raw = await r.get(f"recsys:user:{user_id}:recs")
    if raw is None:
        return None
    await r.incr("recsys:stats:hits")
    return json.loads(raw)


async def get_model_meta() -> dict:
    r = get_redis()
    keys = [
        "recsys:meta:model_version",
        "recsys:meta:trained_at",
        "recsys:meta:training_duration_s",
        "recsys:meta:is_training",
    ]
    values = await r.mget(*keys)
    return {
        "version":    values[0] or "none",
        "trained_at": values[1],
        "duration_s": float(values[2]) if values[2] else None,
        "is_training": values[3] == "1",
    }


async def get_cache_stats() -> dict:
    r = get_redis()
    reqs, hits = await r.mget("recsys:stats:requests", "recsys:stats:hits")
    reqs = int(reqs or 0)
    hits = int(hits or 0)

    # Count how many users have cached recs
    cursor = 0
    users_cached = 0
    while True:
        cursor, keys = await r.scan(cursor, match="recsys:user:*:recs", count=100)
        users_cached += len(keys)
        if cursor == 0:
            break

    return {
        "users_cached": users_cached,
        "total_requests": reqs,
        "cache_hits": hits,
        "hit_rate_pct": round((hits / reqs * 100), 1) if reqs > 0 else 0.0,
    }


# ── Write ─────────────────────────────────────────────────────────────────────

async def set_user_recs(user_id: str, song_ids: list[str]) -> None:
    r = get_redis()
    pipe = r.pipeline()
    pipe.set(f"recsys:user:{user_id}:recs", json.dumps(song_ids), ex=RECS_TTL)
    pipe.set(f"recsys:user:{user_id}:recs:ts", datetime.now(timezone.utc).isoformat())
    await pipe.execute()


async def set_model_meta(version: str, trained_at: datetime, duration_s: float) -> None:
    r = get_redis()
    pipe = r.pipeline()
    pipe.set("recsys:meta:model_version", version)
    pipe.set("recsys:meta:trained_at", trained_at.isoformat())
    pipe.set("recsys:meta:training_duration_s", str(duration_s))
    pipe.set("recsys:meta:is_training", "0")
    await pipe.execute()


async def set_training_lock(is_training: bool) -> None:
    await get_redis().set("recsys:meta:is_training", "1" if is_training else "0")


async def increment_request_counter() -> None:
    await get_redis().incr("recsys:stats:requests")

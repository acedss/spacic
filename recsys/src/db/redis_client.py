import redis.asyncio as aioredis
from ..config import get_settings

_redis: aioredis.Redis | None = None


def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(
            get_settings().REDIS_URL,
            decode_responses=True,
        )
    return _redis


async def close():
    global _redis
    if _redis:
        await _redis.aclose()
        _redis = None

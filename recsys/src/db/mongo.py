from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from ..config import get_settings

_client: AsyncIOMotorClient | None = None


def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(get_settings().MONGODB_URI)
    return _client


def get_db() -> AsyncIOMotorDatabase:
    # DB name is embedded in the Atlas URI (e.g. .../spacic_db?...)
    # get_default_database() reads it automatically — no separate MONGO_DB needed
    return get_client().get_default_database()


async def close():
    global _client
    if _client:
        _client.close()
        _client = None

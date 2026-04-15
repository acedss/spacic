"""
Recommender — serves recs at request time.

Strategy (priority order):
  1. Redis cache hit  → return pre-computed top-K (< 1ms)
  2. Content-based    → user's top artists → matching songs
  3. Popularity       → top streamCount songs
"""

from datetime import datetime, timezone
from ..db.mongo import get_db
from ..services.feature_store import get_user_recs, increment_request_counter
from bson import ObjectId


async def get_recommendations(user_id: str, limit: int = 20) -> dict:
    await increment_request_counter()

    cached = await get_user_recs(user_id)
    if cached:
        return {
            "userId": user_id,
            "songIds": cached[:limit],
            "source": "cache",
            "generatedAt": datetime.now(timezone.utc),
        }

    db = get_db()
    try:
        oid = ObjectId(user_id)
    except Exception:
        oid = None

    content_recs = []
    if oid:
        pipeline = [
            {"$match": {"userId": oid}},
            {"$sort": {"date": -1}},
            {"$limit": 30},
            {"$unwind": "$topArtists"},
            {"$group": {"_id": "$topArtists.artistName", "totalStreams": {"$sum": "$topArtists.streams"}}},
            {"$sort": {"totalStreams": -1}},
            {"$limit": 5},
        ]
        top_artists = [doc["_id"] async for doc in db["userdailystats"].aggregate(pipeline)]

        if top_artists:
            listened_ids = set()
            async for ev in db["listenevents"].find(
                {"userId": oid, "countedStream": True}, {"songId": 1}
            ).limit(200):
                listened_ids.add(ev["songId"])

            content_songs = await db["songs"].find(
                {"artist": {"$in": top_artists}, "_id": {"$nin": list(listened_ids)}},
                {"_id": 1},
            ).sort("streamCount", -1).limit(limit).to_list(limit)
            content_recs = [str(s["_id"]) for s in content_songs]

    if len(content_recs) >= limit:
        return {"userId": user_id, "songIds": content_recs[:limit], "source": "content", "generatedAt": datetime.now(timezone.utc)}

    need = limit - len(content_recs)
    exclude = set(content_recs)
    popular = await db["songs"].find(
        {"_id": {"$nin": [ObjectId(s) for s in exclude if ObjectId.is_valid(s)]}},
        {"_id": 1},
    ).sort("streamCount", -1).limit(need).to_list(need)

    return {
        "userId": user_id,
        "songIds": content_recs + [str(s["_id"]) for s in popular],
        "source": "fallback",
        "generatedAt": datetime.now(timezone.utc),
    }

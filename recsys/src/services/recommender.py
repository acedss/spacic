"""
Recommender — serves room recs at request time.

Strategy (priority order):
  1. Redis cache hit       → ALS-precomputed top-K rooms
  2. Content-based         → rooms whose tags overlap user's recently visited rooms' tags
  3. Popularity (live)     → top live public rooms by current listenerCount
  4. Popularity (all-time) → top public rooms by stats.totalListeners
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
            "roomIds": cached[:limit],
            "source": "cache",
            "generatedAt": datetime.now(timezone.utc),
        }

    db = get_db()
    try:
        oid = ObjectId(user_id)
    except Exception:
        oid = None

    # ── 2. Content-based: tag overlap with rooms the user has recently joined ──
    content_recs: list[str] = []
    visited_room_ids: set = set()
    if oid:
        async for lst in db["listeners"].find(
            {"userId": oid}, {"roomId": 1}
        ).sort("joinedAt", -1).limit(50):
            visited_room_ids.add(lst["roomId"])

        if visited_room_ids:
            tag_pipeline = [
                {"$match": {"_id": {"$in": list(visited_room_ids)}}},
                {"$unwind": "$tags"},
                {"$group": {"_id": "$tags", "n": {"$sum": 1}}},
                {"$sort": {"n": -1}},
                {"$limit": 5},
            ]
            top_tags = [doc["_id"] async for doc in db["rooms"].aggregate(tag_pipeline)]

            if top_tags:
                content_rooms = await db["rooms"].find(
                    {
                        "tags": {"$in": top_tags},
                        "isPublic": True,
                        "_id": {"$nin": list(visited_room_ids)},
                    },
                    {"_id": 1},
                ).sort("favoriteCount", -1).limit(limit).to_list(limit)
                content_recs = [str(r["_id"]) for r in content_rooms]

    if len(content_recs) >= limit:
        return {
            "userId": user_id,
            "roomIds": content_recs[:limit],
            "source": "content",
            "generatedAt": datetime.now(timezone.utc),
        }

    # ── 3 + 4. Popularity fallback: live public rooms first, then all-time. ──
    need = limit - len(content_recs)
    exclude = set(content_recs) | {str(r) for r in visited_room_ids}

    def _to_oid(s: str):
        try:
            return ObjectId(s)
        except Exception:
            return None

    exclude_oids = [o for o in (_to_oid(s) for s in exclude) if o is not None]

    live = await db["rooms"].find(
        {"status": "live", "isPublic": True, "_id": {"$nin": exclude_oids}},
        {"_id": 1},
    ).sort("stats.totalListeners", -1).limit(need).to_list(need)
    pop_ids = [str(r["_id"]) for r in live]

    if len(pop_ids) < need:
        more_need = need - len(pop_ids)
        more_exclude = exclude_oids + [_to_oid(s) for s in pop_ids if _to_oid(s)]
        all_time = await db["rooms"].find(
            {"isPublic": True, "_id": {"$nin": more_exclude}},
            {"_id": 1},
        ).sort("stats.totalListeners", -1).limit(more_need).to_list(more_need)
        pop_ids += [str(r["_id"]) for r in all_time]

    return {
        "userId": user_id,
        "roomIds": content_recs + pop_ids,
        "source": "fallback",
        "generatedAt": datetime.now(timezone.utc),
    }

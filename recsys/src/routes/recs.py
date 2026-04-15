from fastapi import APIRouter, HTTPException, Query
from ..services.recommender import get_recommendations
from ..models.schemas import RecsResponse

router = APIRouter(prefix="/recs", tags=["recommendations"])


@router.get("/{user_id}", response_model=RecsResponse)
async def recommend(user_id: str, limit: int = Query(default=20, ge=1, le=50)):
    result = await get_recommendations(user_id, limit)
    return RecsResponse(**result)

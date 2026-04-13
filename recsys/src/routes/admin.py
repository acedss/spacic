"""
Admin monitoring routes — consumed by Node.js admin panel proxy.
All routes protected by X-Internal-Key header.
"""

import asyncio
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Header, BackgroundTasks
from ..services.feature_store import get_model_meta, get_cache_stats, set_training_lock
from ..services.trainer import run_training, get_last_metrics
from ..models.schemas import AdminStatus, ModelInfo, ModelMetrics, CacheStats, SchedulerInfo, TrainRequest
from ..config import get_settings

router = APIRouter(prefix="/admin", tags=["admin"])

_training_task: asyncio.Task | None = None


def _require_internal_key(x_internal_key: str | None):
    if x_internal_key != get_settings().RECSYS_INTERNAL_API_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")


@router.get("/status", response_model=AdminStatus)
async def get_status(x_internal_key: str | None = Header(default=None)):
    _require_internal_key(x_internal_key)

    meta = await get_model_meta()
    cache = await get_cache_stats()
    last = get_last_metrics()

    return AdminStatus(
        service="healthy",
        model=ModelInfo(
            version=meta["version"],
            trained_at=datetime.fromisoformat(meta["trained_at"]) if meta.get("trained_at") else None,
            duration_s=meta.get("duration_s"),
            metrics=ModelMetrics(
                precision_at_10=last.get("precision_at_10"),
                coverage=last.get("coverage"),
                training_users=last.get("training_users", 0),
                training_songs=last.get("training_songs", 0),
                training_interactions=last.get("training_interactions", 0),
            ),
        ),
        cache=CacheStats(
            users_cached=cache["users_cached"],
            hit_rate_pct=cache["hit_rate_pct"],
            total_requests=cache["total_requests"],
            cache_hits=cache["cache_hits"],
        ),
        scheduler=SchedulerInfo(
            last_run_at=datetime.fromisoformat(meta["trained_at"]) if meta.get("trained_at") else None,
            last_run_duration_s=meta.get("duration_s"),
            is_training=meta.get("is_training", False),
        ),
    )


@router.post("/train")
async def trigger_training(
    body: TrainRequest,
    background_tasks: BackgroundTasks,
    x_internal_key: str | None = Header(default=None),
):
    _require_internal_key(x_internal_key)

    meta = await get_model_meta()
    if meta.get("is_training"):
        raise HTTPException(status_code=409, detail="Training already in progress")

    async def _run():
        await run_training(force=body.force)

    background_tasks.add_task(_run)
    await set_training_lock(True)

    return {"status": "training_started", "startedAt": datetime.now(timezone.utc).isoformat()}


@router.get("/health")
async def health():
    return {"status": "ok", "ts": datetime.now(timezone.utc).isoformat()}

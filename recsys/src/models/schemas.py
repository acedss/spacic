from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class RecsResponse(BaseModel):
    userId: str
    songIds: list[str]
    source: str          # "cache" | "realtime" | "fallback"
    generatedAt: datetime


class ModelMetrics(BaseModel):
    precision_at_10: Optional[float] = None
    coverage: Optional[float] = None
    training_users: int = 0
    training_songs: int = 0
    training_interactions: int = 0


class ModelInfo(BaseModel):
    version: str
    trained_at: Optional[datetime] = None
    duration_s: Optional[float] = None
    metrics: ModelMetrics = ModelMetrics()


class CacheStats(BaseModel):
    users_cached: int = 0
    hit_rate_pct: float = 0.0
    total_requests: int = 0
    cache_hits: int = 0


class SchedulerInfo(BaseModel):
    next_training: Optional[datetime] = None
    last_run_at: Optional[datetime] = None
    last_run_duration_s: Optional[float] = None
    is_training: bool = False


class AdminStatus(BaseModel):
    service: str = "healthy"
    model: ModelInfo
    cache: CacheStats
    scheduler: SchedulerInfo


class TrainRequest(BaseModel):
    force: bool = False  # skip cooldown check

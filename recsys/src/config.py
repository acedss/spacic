from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Same vars as backend/.env — no duplication needed
    MONGODB_URI: str  # e.g. mongodb+srv://user:pass@host/spacic_db
    REDIS_URL: str    # e.g. redis://default:pass@host:port

    # Internal API key — Node.js sends this header to reach Python service
    # Store as "RECSYS_INTERNAL_API_KEY" in Jenkins credentials
    RECSYS_INTERNAL_API_KEY: str = "spacic-recsys-internal-2026"

    # ALS model hyper-params
    ALS_FACTORS: int = 64
    ALS_ITERATIONS: int = 20
    ALS_REGULARIZATION: float = 0.01

    # Top-K recommendations to pre-compute per user
    TOP_K: int = 50

    # Nightly training cron (UTC, 24h)
    TRAIN_HOUR_UTC: int = 2
    TRAIN_MINUTE_UTC: int = 0

    # MLflow — "mlite" uses local SQLite (no server needed for MVP)
    MLFLOW_TRACKING_URI: str = "mlite"

    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()

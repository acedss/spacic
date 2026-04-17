import logging
import os
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")  # prevent ALS thread contention
from contextlib import asynccontextmanager
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import get_settings
from .db.mongo import close as close_mongo
from .db.redis_client import close as close_redis
from .routes import admin, recs
from .services.trainer import run_training

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    scheduler.add_job(
        run_training,
        CronTrigger(hour=settings.TRAIN_HOUR_UTC, minute=settings.TRAIN_MINUTE_UTC, timezone="UTC"),
        id="nightly_training",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("Scheduler started — nightly training at %02d:%02d UTC", settings.TRAIN_HOUR_UTC, settings.TRAIN_MINUTE_UTC)
    yield
    scheduler.shutdown(wait=False)
    await close_mongo()
    await close_redis()


app = FastAPI(title="Spacic RecSys", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4000", "http://spacic-be:4000"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(recs.router)
app.include_router(admin.router)

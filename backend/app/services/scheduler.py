"""
APScheduler-based periodic task scheduler.
Publishes ingestion and insight generation tasks to RabbitMQ on a schedule.
"""
import asyncio
import logging
from apscheduler.schedulers.background import BackgroundScheduler
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

scheduler = BackgroundScheduler()


def _publish_ingestion_all():
    """Publish ingestion tasks for all competitors."""
    from app.rabbitmq import publish_task, QUEUE_INGESTION
    asyncio.run(
        publish_task(QUEUE_INGESTION, {"task": "ingest_all"})
    )
    logger.info("Scheduled: published ingest_all task")


def _publish_insight_generation():
    """Publish insight generation tasks."""
    from app.rabbitmq import publish_task, QUEUE_INSIGHTS
    asyncio.run(
        publish_task(QUEUE_INSIGHTS, {"task": "generate_insights_all"})
    )
    logger.info("Scheduled: published generate_insights_all task")


def start_scheduler():
    scheduler.add_job(
        _publish_ingestion_all,
        "interval",
        minutes=settings.INGESTION_INTERVAL_MINUTES,
        id="ingestion_all",
        replace_existing=True,
    )
    scheduler.add_job(
        _publish_insight_generation,
        "interval",
        minutes=settings.INGESTION_INTERVAL_MINUTES * 2,
        id="insight_generation",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("Scheduler started — ingestion every %d min, insights every %d min",
                settings.INGESTION_INTERVAL_MINUTES, settings.INGESTION_INTERVAL_MINUTES * 2)


def stop_scheduler():
    scheduler.shutdown(wait=False)
    logger.info("Scheduler stopped")

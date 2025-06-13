"""
RabbitMQ Consumer — Processes tasks from ingestion, NLP, vision, and insight queues.
Runs as a separate process (python -m app.workers.consumer).
"""
import asyncio
import json
import logging
from datetime import datetime
from uuid import UUID
from io import BytesIO

import aio_pika
import httpx
from PIL import Image
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import async_session
from app.models import (
    Competitor, IngestionJob, SentimentData, WebsiteSnapshot,
)
from app.rabbitmq import (
    QUEUE_INGESTION, QUEUE_NLP, QUEUE_VISION, QUEUE_INSIGHTS,
    get_rabbitmq_connection,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
logger = logging.getLogger("worker")
settings = get_settings()


# ── Task Handlers ──────────────────────────────────────────────

async def handle_ingestion(payload: dict):
    """Handle data ingestion tasks."""
    from app.services.ingestion import run_ingestion
    from app.services.insights import process_ingested_records

    task = payload.get("task")
    logger.info("Ingestion task: %s", task)

    if task == "ingest_all":
        # Get all competitors first
        async with async_session() as db:
            result = await db.execute(select(Competitor))
            competitors = result.scalars().all()
            comp_ids = [(c.id, c.name) for c in competitors]

        # Process each competitor in its own session/transaction
        for comp_id, comp_name in comp_ids:
            try:
                async with async_session() as db:
                    result = await db.execute(
                        select(Competitor).where(Competitor.id == comp_id)
                    )
                    comp = result.scalar_one_or_none()
                    if comp:
                        await _ingest_competitor(comp, db)
                        await db.commit()
                        logger.info("Committed data for %s", comp_name)
            except Exception as e:
                logger.error("Failed to process %s: %s", comp_name, e)

    elif task == "ingest":
        competitor_id = payload.get("competitor_id")
        if competitor_id:
            async with async_session() as db:
                result = await db.execute(
                    select(Competitor).where(Competitor.id == UUID(competitor_id))
                )
                comp = result.scalar_one_or_none()
                if comp:
                    await _ingest_competitor(comp, db)
                    await db.commit()


async def _ingest_competitor(comp: Competitor, db: AsyncSession):
    """Ingest data for a single competitor."""
    from app.services.ingestion import run_ingestion
    from app.services.insights import process_ingested_records

    # Create ingestion job record
    job = IngestionJob(
        source="custom",
        competitor_id=comp.id,
        status="running",
        started_at=datetime.utcnow(),
    )
    db.add(job)
    await db.flush()

    try:
        records = await run_ingestion(
            competitor_name=comp.name,
            keywords=comp.keywords or [comp.name],
            rss_feeds=comp.rss_feeds,
            website=comp.website,
            social_handles=comp.social_handles,
        )

        count = await process_ingested_records(records, comp.id, db)

        job.status = "completed"
        job.records_processed = count
        job.completed_at = datetime.utcnow()
        logger.info("Ingested %d records for %s", count, comp.name)

    except Exception as e:
        job.status = "failed"
        job.error_message = str(e)[:1000]
        job.completed_at = datetime.utcnow()
        logger.error("Ingestion failed for %s: %s", comp.name, e)

    await db.flush()


async def handle_nlp(payload: dict):
    """Handle NLP tasks (sentiment analysis, entity extraction)."""
    from app.services.nlp import analyze_sentiment

    task = payload.get("task")
    logger.info("NLP task: %s", task)

    if task == "sentiment":
        text = payload.get("text", "")
        competitor_id = payload.get("competitor_id")
        result = analyze_sentiment(text)

        if competitor_id:
            async with async_session() as db:
                sentiment = SentimentData(
                    competitor_id=UUID(competitor_id),
                    score=result["score"],
                    magnitude=result["magnitude"],
                    source="custom",
                    source_text=text[:500],
                )
                db.add(sentiment)
                await db.commit()

        logger.info("Sentiment result: %s (score=%.2f)", result["label"], result["score"])


async def capture_screenshot(url: str) -> Image:
    """Capture a real screenshot of a URL using Playwright headless Chromium."""
    from playwright.async_api import async_playwright

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1280, "height": 720})
        await page.goto(url, wait_until="networkidle", timeout=30000)
        screenshot_bytes = await page.screenshot(full_page=False)
        html_content = await page.content()
        await browser.close()

    img = Image.open(BytesIO(screenshot_bytes)).convert("RGB")
    return img, html_content


async def handle_vision(payload: dict):
    """Handle vision tasks (website monitoring with CLIP + OpenCV)."""
    from app.services.vision import detect_visual_changes, compute_visual_hash

    task = payload.get("task")
    logger.info("Vision task: %s", task)

    if task == "monitor_website":
        url = payload.get("url", "")
        competitor_id = payload.get("competitor_id")

        if not url or not competitor_id:
            return

        try:
            # Capture real screenshot using Playwright headless browser
            img, html_content = await capture_screenshot(url)

            # Get previous snapshot for comparison
            async with async_session() as db:
                prev_result = await db.execute(
                    select(WebsiteSnapshot)
                    .where(WebsiteSnapshot.competitor_id == UUID(competitor_id))
                    .order_by(WebsiteSnapshot.created_at.desc())
                    .limit(1)
                )
                prev_snapshot = prev_result.scalar_one_or_none()

                # Load previous screenshot for OpenCV diff if available
                prev_image = None
                if prev_snapshot and prev_snapshot.screenshot_path:
                    try:
                        prev_image = Image.open(prev_snapshot.screenshot_path).convert("RGB")
                    except Exception:
                        pass

                # Run CLIP + OpenCV analysis
                visual_result = detect_visual_changes(
                    current_image=img,
                    previous_image=prev_image,
                    labels=["product page", "pricing page", "blog post", "landing page", "documentation"],
                )

                # Save current screenshot to disk
                import hashlib
                import os
                screenshots_dir = "/app/data/screenshots"
                os.makedirs(screenshots_dir, exist_ok=True)
                screenshot_path = os.path.join(screenshots_dir, f"{competitor_id}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.png")
                img.save(screenshot_path)

                html_hash = hashlib.sha256(html_content.encode()).hexdigest()[:64]

                # Determine if changes were detected
                changes_detected = False
                if visual_result["comparison"]:
                    changes_detected = visual_result["comparison"]["changes_detected"]
                elif prev_snapshot:
                    changes_detected = prev_snapshot.html_hash != html_hash

                # Build diff summary
                diff_parts = []
                if visual_result.get("classification"):
                    diff_parts.append(f"Page type: {visual_result['classification']['label']} ({visual_result['classification']['score']:.0%})")
                if visual_result["comparison"]:
                    diff_parts.append(f"SSIM: {visual_result['comparison']['ssim']}")
                    diff_parts.append(f"Pixel diff: {visual_result['comparison']['pixel_diff_pct']}%")
                    diff_parts.append(f"Changed regions: {len(visual_result['comparison']['changed_regions'])}")

                snapshot = WebsiteSnapshot(
                    competitor_id=UUID(competitor_id),
                    url=url,
                    html_hash=html_hash,
                    screenshot_path=screenshot_path,
                    visual_hash=visual_result["visual_hash"],
                    changes_detected=changes_detected,
                    diff_summary="; ".join(diff_parts) if diff_parts else json.dumps(visual_result.get("classification", {})),
                    clip_embedding=visual_result["clip_embedding"][:10],
                )
                db.add(snapshot)
                await db.commit()

            logger.info("Website monitoring completed for %s (changes=%s)", url, changes_detected)

        except Exception as e:
            logger.error("Vision task failed for %s: %s", url, e)


async def handle_insights(payload: dict):
    """Handle insight generation tasks."""
    from app.services.insights import run_insight_pipeline

    task = payload.get("task")
    logger.info("Insight task: %s", task)

    async with async_session() as db:
        if task == "generate_insights":
            user_id = payload.get("user_id")
            if user_id:
                insights = await run_insight_pipeline(UUID(user_id), db)
                logger.info("Generated %d insights for user %s", len(insights), user_id)

        elif task == "generate_insights_all":
            # Generate for all users who have competitors
            from app.models import User
            result = await db.execute(select(User.id).distinct())
            user_ids = [row[0] for row in result.all()]
            for uid in user_ids:
                try:
                    insights = await run_insight_pipeline(uid, db)
                    logger.info("Generated %d insights for user %s", len(insights), uid)
                except Exception as e:
                    logger.error("Insight generation failed for user %s: %s", uid, e)

        await db.commit()


# ── Queue Routing ──────────────────────────────────────────────

HANDLERS = {
    QUEUE_INGESTION: handle_ingestion,
    QUEUE_NLP: handle_nlp,
    QUEUE_VISION: handle_vision,
    QUEUE_INSIGHTS: handle_insights,
}


async def process_message(message: aio_pika.abc.AbstractIncomingMessage, queue_name: str):
    # Acknowledge immediately — long NLP tasks would exceed heartbeat otherwise
    await message.ack()
    try:
        payload = json.loads(message.body.decode())
        handler = HANDLERS.get(queue_name)
        if handler:
            await handler(payload)
        else:
            logger.warning("No handler for queue: %s", queue_name)
    except Exception as e:
        logger.error("Error processing message from %s: %s", queue_name, e, exc_info=True)


def preload_models():
    """Pre-load all NLP models before consuming messages to avoid RabbitMQ timeouts."""
    logger.info("Pre-loading NLP models (this may take several minutes on first run)...")
    from app.services.nlp import (
        get_sentiment_pipeline,
        get_ner_pipeline,
        get_classification_pipeline,
        get_embedding_model,
    )
    get_sentiment_pipeline()
    logger.info("Sentiment model loaded.")
    get_ner_pipeline()
    logger.info("NER model loaded.")
    get_classification_pipeline()
    logger.info("Zero-shot classification model loaded.")
    get_embedding_model()
    logger.info("Embedding model loaded.")
    logger.info("All NLP models pre-loaded successfully.")


async def main():
    logger.info("Starting RabbitMQ consumer worker...")

    # Pre-load all ML models BEFORE connecting to RabbitMQ
    preload_models()

    connection = await get_rabbitmq_connection()

    async with connection:
        channel = await connection.channel()
        await channel.set_qos(prefetch_count=1)

        # Declare and consume from all queues
        for queue_name in HANDLERS:
            queue = await channel.declare_queue(queue_name, durable=True)
            await queue.consume(lambda msg, qn=queue_name: process_message(msg, qn))
            logger.info("Consuming from queue: %s", queue_name)

        logger.info("Worker ready. Waiting for tasks...")
        await asyncio.Future()  # Run forever


if __name__ == "__main__":
    asyncio.run(main())

"""
Agentic Insight Extraction — Combines NLP + CLIP + clustering to surface competitive signals.
This is the core intelligence pipeline that processes raw ingested data
into actionable insights using a multi-step agentic workflow.
"""
import asyncio
import logging
from datetime import datetime, timedelta
from functools import partial
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Activity, Competitor, Insight, SentimentData,
    InsightType, ActivityType, IngestionSource,
)
from app.services.nlp import (
    analyze_sentiment,
    extract_entities,
    classify_activity,
    classify_insight_type,
    cluster_texts,
    embed_texts,
    batch_sentiment,
    batch_classify,
    batch_ner,
)

logger = logging.getLogger(__name__)


# ── Step 1: Process Raw Records → Activities ──────────────────

def process_record(record: dict, competitor_id: UUID) -> dict:
    """
    Agentic step 1: Take a raw ingested record, run NLP pipeline,
    and produce a structured Activity.
    """
    text = f"{record['title']}. {record['content']}"

    # Sentiment analysis
    sentiment = analyze_sentiment(text)

    # Named entity recognition
    entities = extract_entities(text)

    # Activity type classification
    classification = classify_activity(text)

    # Map classification to ActivityType
    type_map = {
        "product launch": ActivityType.product,
        "technology update": ActivityType.product,
        "pricing change": ActivityType.pricing,
        "hiring announcement": ActivityType.hiring,
        "partnership deal": ActivityType.partnership,
        "marketing campaign": ActivityType.marketing,
        "earnings report": ActivityType.news,
        "regulatory filing": ActivityType.regulatory,
        "security incident": ActivityType.news,
        "leadership change": ActivityType.hiring,
        "market expansion": ActivityType.marketing,
        "customer complaint": ActivityType.sentiment,
    }
    activity_type = type_map.get(classification["label"], ActivityType.news)

    # Determine importance based on classification confidence and sentiment magnitude
    importance = "medium"
    if classification["score"] > 0.7 and abs(sentiment["magnitude"]) > 0.3:
        importance = "high"
    if classification["score"] > 0.85:
        importance = "critical"

    return {
        "competitor_id": competitor_id,
        "type": activity_type,
        "title": record["title"][:512],
        "description": record["content"][:2000],
        "importance": importance,
        "source": record["source"],
        "source_url": record.get("url", ""),
        "raw_content": record["content"],
        "entities": entities,
        "metadata": {
            "sentiment": sentiment,
            "classification": classification,
            "content_hash": record.get("content_hash", ""),
        },
    }


# ── Step 2: Cluster Activities → Themes ───────────────────────

def cluster_activities(activities: list[dict]) -> list[dict]:
    """
    Agentic step 2: Cluster related activities to find themes/trends.
    """
    texts = [f"{a['title']}. {a['description'][:200]}" for a in activities]
    if not texts:
        return []

    clusters = cluster_texts(texts, threshold=0.4)

    enriched_clusters = []
    for cluster in clusters:
        # Get representative text (centroid)
        representative = cluster["texts"][0] if cluster["texts"] else ""

        # Classify the cluster theme
        theme = classify_activity(representative)
        insight_type = classify_insight_type(representative)

        enriched_clusters.append({
            "cluster_id": cluster["cluster_id"],
            "size": cluster["size"],
            "theme": theme["label"],
            "theme_confidence": theme["score"],
            "insight_type": insight_type["label"],
            "insight_confidence": insight_type["score"],
            "representative_text": representative,
            "all_texts": cluster["texts"],
        })

    return enriched_clusters


# ── Step 3: Generate Insights from Clusters ───────────────────

def generate_insight_from_cluster(cluster: dict, competitor_ids: list[UUID], user_id: UUID) -> dict:
    """
    Agentic step 3: Transform a cluster of related activities into an actionable insight.
    """
    size = cluster["size"]
    theme = cluster["theme"]
    insight_type_str = cluster["insight_type"]

    # Generate title based on pattern
    title_templates = {
        "opportunity": f"Emerging opportunity detected: {theme} ({size} signals)",
        "threat": f"Competitive threat identified: {theme} ({size} signals)",
        "trend": f"Market trend emerging: {theme} ({size} signals)",
        "anomaly": f"Unusual activity detected: {theme} ({size} signals)",
    }
    title = title_templates.get(insight_type_str, f"Signal detected: {theme}")

    # Build description from cluster texts
    description_parts = [
        f"Analysis of {size} related data points reveals a significant pattern around '{theme}'.",
        f"Confidence: {cluster['theme_confidence']:.0%}.",
        "",
        "Key signals:",
    ]
    for i, text in enumerate(cluster["all_texts"][:5]):
        description_parts.append(f"  {i+1}. {text[:200]}")

    if size > 5:
        description_parts.append(f"  ... and {size - 5} more related signals.")

    description = "\n".join(description_parts)

    # Map to InsightType enum
    type_map = {
        "opportunity": InsightType.opportunity,
        "threat": InsightType.threat,
        "trend": InsightType.trend,
        "anomaly": InsightType.anomaly,
    }

    return {
        "user_id": user_id,
        "title": title[:512],
        "description": description,
        "type": type_map.get(insight_type_str, InsightType.trend),
        "confidence": cluster["insight_confidence"],
        "sources": [{"theme": theme, "cluster_size": size}],
        "competitor_ids": competitor_ids,
        "extra_data": {
            "cluster_id": cluster["cluster_id"],
            "theme": theme,
            "theme_confidence": cluster["theme_confidence"],
        },
        "cluster_id": str(cluster["cluster_id"]),
    }


# ── Full Agentic Pipeline ─────────────────────────────────────

async def run_insight_pipeline(
    user_id: UUID,
    db: AsyncSession,
) -> list[dict]:
    """
    Full agentic insight extraction pipeline:
    1. Fetch recent activities for all user's competitors
    2. Run NLP clustering to find themes
    3. Generate actionable insights from clusters
    4. Store insights in database
    """
    logger.info("Starting insight pipeline for user %s", user_id)

    # Fetch recent activities (last 7 days)
    since = datetime.utcnow() - timedelta(days=7)
    result = await db.execute(
        select(Activity)
        .join(Competitor)
        .where(Competitor.user_id == user_id, Activity.created_at >= since)
        .order_by(Activity.created_at.desc())
        .limit(500)
    )
    activities = result.scalars().all()

    if not activities:
        logger.info("No recent activities found for user %s", user_id)
        return []

    # Convert to dicts for processing
    activity_dicts = [
        {"title": a.title, "description": a.description, "competitor_id": a.competitor_id}
        for a in activities
    ]

    # Get unique competitor IDs
    competitor_ids = list(set(a.competitor_id for a in activities))

    # Cluster activities (run in thread to avoid blocking event loop)
    loop = asyncio.get_event_loop()
    clusters = await loop.run_in_executor(None, partial(cluster_activities, activity_dicts))
    logger.info("Found %d activity clusters", len(clusters))

    # Generate insights from significant clusters (size >= 2)
    insights = []
    for cluster in clusters:
        if cluster["size"] >= 2:
            insight_data = await loop.run_in_executor(
                None, partial(generate_insight_from_cluster, cluster, competitor_ids, user_id)
            )
            insight = Insight(**insight_data)
            db.add(insight)
            insights.append(insight_data)

    await db.flush()
    logger.info("Generated %d insights for user %s", len(insights), user_id)
    return insights


# ── Process Ingested Records ───────────────────────────────────

def _batch_process_records(records: list[dict], competitor_id: UUID) -> list[dict]:
    """
    Batch-process all records through NLP models.
    Runs sentiment + NER + classification in bulk instead of per-record.
    ~3-5x faster than sequential processing on CPU.
    """
    texts = [f"{r['title']}. {r['content']}"[:512] for r in records]
    total = len(texts)

    logger.info("Batch NLP: running sentiment on %d texts...", total)
    sentiments = batch_sentiment(texts)

    logger.info("Batch NLP: running classification on %d texts...", total)
    classifications = batch_classify(texts)

    logger.info("Batch NLP: running NER on %d texts...", total)
    entities_list = batch_ner(texts)

    # Type mapping
    type_map = {
        "product launch": ActivityType.product,
        "technology update": ActivityType.product,
        "pricing change": ActivityType.pricing,
        "hiring announcement": ActivityType.hiring,
        "partnership deal": ActivityType.partnership,
        "marketing campaign": ActivityType.marketing,
        "earnings report": ActivityType.news,
        "regulatory filing": ActivityType.regulatory,
        "security incident": ActivityType.news,
        "leadership change": ActivityType.hiring,
        "market expansion": ActivityType.marketing,
        "customer complaint": ActivityType.sentiment,
    }

    results = []
    for i, record in enumerate(records):
        sentiment = sentiments[i]
        classification = classifications[i]
        entities = entities_list[i]
        activity_type = type_map.get(classification["label"], ActivityType.news)

        importance = "medium"
        if classification["score"] > 0.7 and abs(sentiment["magnitude"]) > 0.3:
            importance = "high"
        if classification["score"] > 0.85:
            importance = "critical"

        results.append({
            "competitor_id": competitor_id,
            "type": activity_type,
            "title": record["title"][:512],
            "description": record["content"][:2000],
            "importance": importance,
            "source": record["source"],
            "source_url": record.get("url", ""),
            "raw_content": record["content"],
            "entities": entities,
            "metadata": {
                "sentiment": sentiment,
                "classification": classification,
                "content_hash": record.get("content_hash", ""),
            },
        })

        if (i + 1) % 50 == 0 or (i + 1) == total:
            logger.info("Batch NLP: assembled %d/%d records", i + 1, total)

    return results


async def process_ingested_records(
    records: list[dict],
    competitor_id: UUID,
    db: AsyncSession,
) -> int:
    """
    Process raw ingested records through NLP pipeline and store as Activities + Sentiment.
    Uses batch inference for ~3-5x speedup over per-record processing.
    """
    total = len(records)
    loop = asyncio.get_event_loop()

    # Run all NLP in one batch on a thread (avoids blocking event loop)
    logger.info("Starting batch NLP processing for %d records...", total)
    processed_list = await loop.run_in_executor(
        None, partial(_batch_process_records, records, competitor_id)
    )
    logger.info("Batch NLP complete. Storing %d results...", len(processed_list))

    count = 0
    for i, processed in enumerate(processed_list):
        try:
            activity = Activity(
                competitor_id=processed["competitor_id"],
                type=processed["type"],
                title=processed["title"],
                description=processed["description"],
                importance=processed["importance"],
                source=processed["source"] if processed["source"] in IngestionSource.__members__ else "custom",
                source_url=processed["source_url"],
                raw_content=processed["raw_content"],
                entities=processed["entities"],
                extra_data=processed["metadata"],
            )
            db.add(activity)

            sentiment_info = processed["metadata"]["sentiment"]
            sentiment = SentimentData(
                competitor_id=competitor_id,
                score=sentiment_info["score"],
                magnitude=sentiment_info["magnitude"],
                source=processed["source"] if processed["source"] in IngestionSource.__members__ else "custom",
                source_text=processed["title"][:500],
            )
            db.add(sentiment)
            count += 1

            if (i + 1) % 50 == 0 or (i + 1) == total:
                await db.flush()

        except Exception as e:
            logger.error("Error storing record %d/%d: %s", i + 1, total, e)

    await db.flush()

    # Update competitor stats
    result = await db.execute(
        select(Competitor).where(Competitor.id == competitor_id)
    )
    competitor = result.scalar_one_or_none()
    if competitor:
        sent_result = await db.execute(
            select(SentimentData.score)
            .where(SentimentData.competitor_id == competitor_id)
            .order_by(SentimentData.date.desc())
            .limit(50)
        )
        scores = [row[0] for row in sent_result.all()]
        if scores:
            new_avg = sum(scores) / len(scores)
            competitor.sentiment_change = round(new_avg - competitor.sentiment_score, 2)
            competitor.sentiment_score = round(new_avg, 2)

        competitor.recent_activities = count + (competitor.recent_activities or 0)
        await db.flush()

    logger.info("Processed %d records for competitor %s", count, competitor_id)
    return count

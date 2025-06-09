from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, cast, Date, Numeric
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timedelta
from app.database import get_db
from app.models import User, Competitor, Activity, Alert, SentimentData, IngestionJob
from app.schemas import DashboardStats
from app.auth import get_current_user
from app.redis_client import cache_get, cache_set

router = APIRouter()


@router.get("/stats", response_model=DashboardStats)
async def get_stats(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    cache_key = f"dashboard_stats:{user.id}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    # Total competitors
    comp_count = await db.execute(
        select(func.count(Competitor.id)).where(Competitor.user_id == user.id)
    )
    total_competitors = comp_count.scalar() or 0

    # Total activities
    act_count = await db.execute(
        select(func.count(Activity.id))
        .join(Competitor)
        .where(Competitor.user_id == user.id)
    )
    total_activities = act_count.scalar() or 0

    # Active alerts
    alert_count = await db.execute(
        select(func.count(Alert.id))
        .where(Alert.user_id == user.id, Alert.status == "active")
    )
    active_alerts = alert_count.scalar() or 0

    # Average sentiment
    avg_sent = await db.execute(
        select(func.avg(SentimentData.score))
        .join(Competitor)
        .where(Competitor.user_id == user.id)
    )
    avg_sentiment = round(float(avg_sent.scalar() or 0), 2)

    # Records processed today
    today_count = await db.execute(
        select(func.sum(IngestionJob.records_processed))
        .where(IngestionJob.created_at >= today)
    )
    records_today = today_count.scalar() or 0

    # Active sources (distinct sources with jobs in last 24h)
    sources_q = await db.execute(
        select(func.count(func.distinct(IngestionJob.source)))
        .where(IngestionJob.created_at >= datetime.utcnow() - timedelta(hours=24))
    )
    sources_active = sources_q.scalar() or 0

    stats = DashboardStats(
        total_competitors=total_competitors,
        total_activities=total_activities,
        active_alerts=active_alerts,
        avg_sentiment=avg_sentiment,
        records_today=records_today,
        sources_active=sources_active,
    )
    await cache_set(cache_key, stats.model_dump(), ttl=60)
    return stats


@router.get("/sentiment-trends")
async def get_sentiment_trends(
    days: int = Query(30, le=90),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Aggregated sentiment trends: avg score per competitor per day."""
    since = datetime.utcnow() - timedelta(days=days)

    result = await db.execute(
        select(
            cast(SentimentData.date, Date).label("day"),
            Competitor.id,
            Competitor.name,
            func.round(cast(func.avg(SentimentData.score), Numeric), 1).label("avg_score"),
        )
        .join(Competitor, SentimentData.competitor_id == Competitor.id)
        .where(Competitor.user_id == user.id, SentimentData.date >= since)
        .group_by(cast(SentimentData.date, Date), Competitor.id, Competitor.name)
        .order_by(cast(SentimentData.date, Date))
    )
    rows = result.all()

    return [
        {"date": str(r.day), "competitor_id": str(r.id), "name": r.name, "score": float(r.avg_score)}
        for r in rows
    ]

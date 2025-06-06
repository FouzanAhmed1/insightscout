from uuid import UUID
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timedelta
from app.database import get_db
from app.models import User, SentimentData, Competitor
from app.schemas import SentimentOut, SentimentAnalyzeRequest
from app.auth import get_current_user
from app.rabbitmq import publish_task, QUEUE_NLP

router = APIRouter()


@router.get("/", response_model=list[SentimentOut])
async def list_sentiment(
    competitor_id: UUID | None = None,
    days: int = Query(30, le=365),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    since = datetime.utcnow() - timedelta(days=days)
    q = (
        select(SentimentData)
        .join(Competitor)
        .where(Competitor.user_id == user.id, SentimentData.date >= since)
        .order_by(SentimentData.date.asc())
    )
    if competitor_id:
        q = q.where(SentimentData.competitor_id == competitor_id)

    result = await db.execute(q)
    return result.scalars().all()


@router.get("/summary")
async def sentiment_summary(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get average sentiment per competitor over the last 7 days."""
    since = datetime.utcnow() - timedelta(days=7)
    q = (
        select(
            Competitor.id,
            Competitor.name,
            func.avg(SentimentData.score).label("avg_score"),
            func.count(SentimentData.id).label("data_points"),
        )
        .join(SentimentData, SentimentData.competitor_id == Competitor.id)
        .where(Competitor.user_id == user.id, SentimentData.date >= since)
        .group_by(Competitor.id, Competitor.name)
    )
    result = await db.execute(q)
    rows = result.all()
    return [
        {
            "competitor_id": str(r.id),
            "name": r.name,
            "avg_score": round(float(r.avg_score), 2),
            "data_points": r.data_points,
        }
        for r in rows
    ]


@router.post("/analyze")
async def analyze_sentiment(
    data: SentimentAnalyzeRequest,
    user: User = Depends(get_current_user),
):
    """Queue a text for sentiment analysis via NLP pipeline."""
    await publish_task(QUEUE_NLP, {
        "task": "sentiment",
        "text": data.text,
        "competitor_id": str(data.competitor_id) if data.competitor_id else None,
        "user_id": str(user.id),
    })
    return {"status": "queued", "message": "Sentiment analysis task submitted"}

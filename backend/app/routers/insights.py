from uuid import UUID
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import User, Insight
from app.schemas import InsightOut
from app.auth import get_current_user
from app.rabbitmq import publish_task, QUEUE_INSIGHTS

router = APIRouter()


@router.get("/", response_model=list[InsightOut])
async def list_insights(
    type: str | None = None,
    limit: int = Query(50, le=200),
    offset: int = 0,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(Insight)
        .where(Insight.user_id == user.id)
        .order_by(Insight.created_at.desc())
    )
    if type:
        q = q.where(Insight.type == type)
    q = q.limit(limit).offset(offset)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("/generate")
async def generate_insights(
    user: User = Depends(get_current_user),
):
    """Trigger agentic insight generation pipeline."""
    await publish_task(QUEUE_INSIGHTS, {
        "task": "generate_insights",
        "user_id": str(user.id),
    })
    return {"status": "queued", "message": "Insight generation pipeline triggered"}


@router.get("/{insight_id}", response_model=InsightOut)
async def get_insight(
    insight_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Insight).where(Insight.id == insight_id, Insight.user_id == user.id)
    )
    insight = result.scalar_one_or_none()
    if not insight:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Insight not found")
    return insight

from uuid import UUID
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import User, Competitor, WebsiteSnapshot
from app.schemas import WebsiteSnapshotOut, MonitorRequest
from app.auth import get_current_user
from app.rabbitmq import publish_task, QUEUE_VISION

router = APIRouter()


@router.get("/snapshots", response_model=list[WebsiteSnapshotOut])
async def list_snapshots(
    competitor_id: UUID | None = None,
    limit: int = Query(50, le=200),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(WebsiteSnapshot)
        .join(Competitor)
        .where(Competitor.user_id == user.id)
        .order_by(WebsiteSnapshot.created_at.desc())
    )
    if competitor_id:
        q = q.where(WebsiteSnapshot.competitor_id == competitor_id)
    q = q.limit(limit)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("/trigger")
async def trigger_monitoring(
    data: MonitorRequest,
    user: User = Depends(get_current_user),
):
    """Queue a website monitoring task (screenshot + CLIP + OpenCV diff)."""
    await publish_task(QUEUE_VISION, {
        "task": "monitor_website",
        "competitor_id": str(data.competitor_id),
        "url": data.url,
        "user_id": str(user.id),
    })
    return {"status": "queued", "message": "Website monitoring task submitted"}

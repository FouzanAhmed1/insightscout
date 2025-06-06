from uuid import UUID
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import User, Activity, Competitor
from app.schemas import ActivityOut
from app.auth import get_current_user

router = APIRouter()


@router.get("/", response_model=list[ActivityOut])
async def list_activities(
    competitor_id: UUID | None = None,
    type: str | None = None,
    importance: str | None = None,
    limit: int = Query(50, le=500),
    offset: int = 0,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(Activity)
        .join(Competitor)
        .where(Competitor.user_id == user.id)
        .order_by(Activity.created_at.desc())
    )
    if competitor_id:
        q = q.where(Activity.competitor_id == competitor_id)
    if type:
        q = q.where(Activity.type == type)
    if importance:
        q = q.where(Activity.importance == importance)

    q = q.limit(limit).offset(offset)
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/{activity_id}", response_model=ActivityOut)
async def get_activity(
    activity_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Activity)
        .join(Competitor)
        .where(Activity.id == activity_id, Competitor.user_id == user.id)
    )
    activity = result.scalar_one_or_none()
    if not activity:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Activity not found")
    return activity

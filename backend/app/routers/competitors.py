from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import User, Competitor, Activity
from app.schemas import CompetitorCreate, CompetitorUpdate, CompetitorOut
from app.auth import get_current_user
from app.redis_client import cache_get, cache_set, cache_delete

router = APIRouter()


@router.get("/", response_model=list[CompetitorOut])
async def list_competitors(
    industry: str | None = None,
    search: str | None = None,
    sort_by: str = "name",
    limit: int = Query(50, le=200),
    offset: int = 0,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    cache_key = f"competitors:{user.id}:{industry}:{search}:{sort_by}:{limit}:{offset}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    q = select(Competitor).where(Competitor.user_id == user.id)
    if industry:
        q = q.where(Competitor.industry == industry)
    if search:
        q = q.where(Competitor.name.ilike(f"%{search}%"))

    sort_col = getattr(Competitor, sort_by, Competitor.name)
    q = q.order_by(sort_col).limit(limit).offset(offset)

    result = await db.execute(q)
    competitors = result.scalars().all()
    out = [CompetitorOut.model_validate(c).model_dump() for c in competitors]
    await cache_set(cache_key, out, ttl=120)
    return out


@router.get("/{competitor_id}", response_model=CompetitorOut)
async def get_competitor(
    competitor_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Competitor).where(Competitor.id == competitor_id, Competitor.user_id == user.id)
    )
    comp = result.scalar_one_or_none()
    if not comp:
        raise HTTPException(status_code=404, detail="Competitor not found")
    return comp


@router.post("/", response_model=CompetitorOut, status_code=201)
async def create_competitor(
    data: CompetitorCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    comp = Competitor(user_id=user.id, **data.model_dump())
    db.add(comp)
    await db.flush()
    await cache_delete(f"competitors:{user.id}:*")
    return comp


@router.patch("/{competitor_id}", response_model=CompetitorOut)
async def update_competitor(
    competitor_id: UUID,
    data: CompetitorUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Competitor).where(Competitor.id == competitor_id, Competitor.user_id == user.id)
    )
    comp = result.scalar_one_or_none()
    if not comp:
        raise HTTPException(status_code=404, detail="Competitor not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(comp, field, value)

    await db.flush()
    return comp


@router.delete("/{competitor_id}", status_code=204)
async def delete_competitor(
    competitor_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Competitor).where(Competitor.id == competitor_id, Competitor.user_id == user.id)
    )
    comp = result.scalar_one_or_none()
    if not comp:
        raise HTTPException(status_code=404, detail="Competitor not found")
    await db.delete(comp)

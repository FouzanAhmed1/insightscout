from uuid import UUID
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import User, IngestionJob, Competitor
from app.schemas import IngestionTrigger, IngestionJobOut
from app.auth import get_current_user
from app.rabbitmq import publish_task, QUEUE_INGESTION

router = APIRouter()


@router.get("/jobs", response_model=list[IngestionJobOut])
async def list_jobs(
    limit: int = Query(50, le=200),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(IngestionJob)
        .order_by(IngestionJob.created_at.desc())
        .limit(limit)
    )
    result = await db.execute(q)
    return result.scalars().all()


@router.post("/trigger")
async def trigger_ingestion(
    data: IngestionTrigger,
    user: User = Depends(get_current_user),
):
    """Manually trigger data ingestion for a source."""
    await publish_task(QUEUE_INGESTION, {
        "task": "ingest",
        "source": data.source,
        "competitor_id": str(data.competitor_id) if data.competitor_id else None,
        "user_id": str(user.id),
    })
    return {"status": "queued", "message": f"Ingestion task for {data.source} submitted"}

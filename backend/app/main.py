import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, competitors, activities, sentiment, insights, alerts, monitoring, ingestion, dashboard
from app.services.scheduler import start_scheduler, stop_scheduler
from app.seed import seed_database

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: seed demo data then start scheduler
    try:
        seeded = await seed_database()
        if seeded:
            logger.info("Demo data seeded — triggering initial ingestion for all competitors...")
            from app.rabbitmq import publish_task, QUEUE_INGESTION
            await publish_task(QUEUE_INGESTION, {"task": "ingest_all"})
    except Exception as e:
        logger.error("Seed failed (non-fatal): %s", e)
    start_scheduler()
    yield
    # Shutdown
    stop_scheduler()


app = FastAPI(
    title="InsightScout API",
    description="AI-Powered Real-Time Intelligence Platform",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(competitors.router, prefix="/api/competitors", tags=["Competitors"])
app.include_router(activities.router, prefix="/api/activities", tags=["Activities"])
app.include_router(sentiment.router, prefix="/api/sentiment", tags=["Sentiment"])
app.include_router(insights.router, prefix="/api/insights", tags=["Insights"])
app.include_router(alerts.router, prefix="/api/alerts", tags=["Alerts"])
app.include_router(monitoring.router, prefix="/api/monitoring", tags=["Monitoring"])
app.include_router(ingestion.router, prefix="/api/ingestion", tags=["Ingestion"])


@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "InsightScout API"}

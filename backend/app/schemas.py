from pydantic import BaseModel, EmailStr
from datetime import datetime
from uuid import UUID
from typing import Any


# ── Auth ───────────────────────────────────────────────────────
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str = ""

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UserOut(BaseModel):
    id: UUID
    email: str
    full_name: str
    created_at: datetime
    model_config = {"from_attributes": True}


# ── Competitors ────────────────────────────────────────────────
class CompetitorCreate(BaseModel):
    name: str
    website: str = ""
    industry: str = ""
    logo_url: str = ""
    description: str = ""
    market_position: str = ""
    rss_feeds: list[str] = []
    keywords: list[str] = []
    social_handles: dict[str, str] = {}

class CompetitorUpdate(BaseModel):
    name: str | None = None
    website: str | None = None
    industry: str | None = None
    logo_url: str | None = None
    description: str | None = None
    market_position: str | None = None
    rss_feeds: list[str] | None = None
    keywords: list[str] | None = None
    social_handles: dict[str, str] | None = None

class CompetitorOut(BaseModel):
    id: UUID
    name: str
    website: str
    industry: str
    logo_url: str
    description: str
    market_position: str
    sentiment_score: float
    sentiment_change: float
    recent_activities: int
    tracking_since: datetime
    rss_feeds: list[str]
    keywords: list[str]
    social_handles: dict[str, str]
    created_at: datetime
    model_config = {"from_attributes": True}


# ── Activities ─────────────────────────────────────────────────
class ActivityOut(BaseModel):
    id: UUID
    competitor_id: UUID
    type: str
    title: str
    description: str
    importance: str
    source: str
    source_url: str
    entities: list[Any]
    extra_data: dict[str, Any] = {}
    created_at: datetime
    model_config = {"from_attributes": True}


# ── Sentiment ──────────────────────────────────────────────────
class SentimentOut(BaseModel):
    id: UUID
    competitor_id: UUID
    score: float
    magnitude: float
    source: str
    date: datetime
    model_config = {"from_attributes": True}

class SentimentAnalyzeRequest(BaseModel):
    text: str
    competitor_id: UUID | None = None


# ── Insights ───────────────────────────────────────────────────
class InsightOut(BaseModel):
    id: UUID
    title: str
    description: str
    type: str
    confidence: float
    sources: list[Any]
    competitor_ids: list[UUID]
    extra_data: dict[str, Any] = {}
    cluster_id: str
    created_at: datetime
    model_config = {"from_attributes": True}


# ── Alerts ─────────────────────────────────────────────────────
class AlertCreate(BaseModel):
    name: str
    type: str
    description: str = ""
    target: str = ""
    conditions: dict[str, Any] = {}

class AlertUpdate(BaseModel):
    name: str | None = None
    type: str | None = None
    description: str | None = None
    target: str | None = None
    status: str | None = None
    conditions: dict[str, Any] | None = None

class AlertOut(BaseModel):
    id: UUID
    name: str
    type: str
    description: str
    target: str
    status: str
    conditions: dict[str, Any]
    last_triggered: datetime | None
    created_at: datetime
    model_config = {"from_attributes": True}


# ── Monitoring ─────────────────────────────────────────────────
class WebsiteSnapshotOut(BaseModel):
    id: UUID
    competitor_id: UUID
    url: str
    changes_detected: bool
    diff_summary: str
    created_at: datetime
    model_config = {"from_attributes": True}

class MonitorRequest(BaseModel):
    competitor_id: UUID
    url: str


# ── Ingestion ──────────────────────────────────────────────────
class IngestionTrigger(BaseModel):
    source: str
    competitor_id: UUID | None = None

class IngestionJobOut(BaseModel):
    id: UUID
    source: str
    competitor_id: UUID | None
    status: str
    records_processed: int
    error_message: str
    created_at: datetime
    model_config = {"from_attributes": True}


# ── Dashboard ──────────────────────────────────────────────────
class DashboardStats(BaseModel):
    total_competitors: int
    total_activities: int
    active_alerts: int
    avg_sentiment: float
    records_today: int
    sources_active: int

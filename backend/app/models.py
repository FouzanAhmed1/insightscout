import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Float, Integer, Text, Boolean,
    DateTime, ForeignKey, JSON, Enum as SAEnum, Index
)
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import relationship
from app.database import Base
import enum


class ActivityType(str, enum.Enum):
    product = "product"
    sentiment = "sentiment"
    marketing = "marketing"
    news = "news"
    pricing = "pricing"
    hiring = "hiring"
    partnership = "partnership"
    regulatory = "regulatory"


class InsightType(str, enum.Enum):
    opportunity = "opportunity"
    threat = "threat"
    trend = "trend"
    anomaly = "anomaly"


class AlertStatus(str, enum.Enum):
    active = "active"
    paused = "paused"
    triggered = "triggered"


class IngestionSource(str, enum.Enum):
    rss = "rss"
    news_api = "news_api"
    reddit = "reddit"
    twitter = "twitter"
    website = "website"
    app_store = "app_store"
    linkedin = "linkedin"
    youtube = "youtube"
    sec_filings = "sec_filings"
    github = "github"
    custom = "custom"


# ── Users ──────────────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), default="")
    settings = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    competitors = relationship("Competitor", back_populates="user", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="user", cascade="all, delete-orphan")


# ── Competitors ────────────────────────────────────────────────
class Competitor(Base):
    __tablename__ = "competitors"
    __table_args__ = (
        Index("ix_competitors_user_industry", "user_id", "industry"),
    )
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    website = Column(String(512), default="")
    industry = Column(String(255), default="")
    logo_url = Column(String(512), default="")
    description = Column(Text, default="")
    market_position = Column(String(50), default="")
    sentiment_score = Column(Float, default=0.0)
    sentiment_change = Column(Float, default=0.0)
    recent_activities = Column(Integer, default=0)
    tracking_since = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Data source config for ingestion
    rss_feeds = Column(ARRAY(String), default=list)
    keywords = Column(ARRAY(String), default=list)
    social_handles = Column(JSON, default=dict)  # {"twitter": "@x", "reddit": "r/x", ...}

    user = relationship("User", back_populates="competitors")
    activities = relationship("Activity", back_populates="competitor", cascade="all, delete-orphan")
    sentiment_data = relationship("SentimentData", back_populates="competitor", cascade="all, delete-orphan")
    website_snapshots = relationship("WebsiteSnapshot", back_populates="competitor", cascade="all, delete-orphan")


# ── Activities ─────────────────────────────────────────────────
class Activity(Base):
    __tablename__ = "activities"
    __table_args__ = (
        Index("ix_activities_competitor_created", "competitor_id", "created_at"),
    )
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    competitor_id = Column(UUID(as_uuid=True), ForeignKey("competitors.id", ondelete="CASCADE"), nullable=False)
    type = Column(String(50), nullable=False)
    title = Column(String(512), nullable=False)
    description = Column(Text, default="")
    importance = Column(String(20), default="medium")  # low, medium, high, critical
    source = Column(String(50), default="custom")
    source_url = Column(String(1024), default="")
    raw_content = Column(Text, default="")
    extra_data = Column("metadata", JSON, default=dict)
    entities = Column(JSON, default=list)    # NER extracted entities
    embedding_id = Column(String(255), default="")  # reference to vector store
    created_at = Column(DateTime, default=datetime.utcnow)

    competitor = relationship("Competitor", back_populates="activities")


# ── Sentiment Data ─────────────────────────────────────────────
class SentimentData(Base):
    __tablename__ = "sentiment_data"
    __table_args__ = (
        Index("ix_sentiment_competitor_date", "competitor_id", "date"),
    )
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    competitor_id = Column(UUID(as_uuid=True), ForeignKey("competitors.id", ondelete="CASCADE"), nullable=False)
    score = Column(Float, nullable=False)
    magnitude = Column(Float, default=0.0)
    source = Column(String(50), default="custom")
    source_text = Column(Text, default="")
    date = Column(DateTime, default=datetime.utcnow)

    competitor = relationship("Competitor", back_populates="sentiment_data")


# ── Insights ───────────────────────────────────────────────────
class Insight(Base):
    __tablename__ = "insights"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(512), nullable=False)
    description = Column(Text, nullable=False)
    type = Column(String(50), nullable=False)
    confidence = Column(Float, default=0.0)
    sources = Column(JSON, default=list)
    competitor_ids = Column(ARRAY(UUID(as_uuid=True)), default=list)
    extra_data = Column("metadata", JSON, default=dict)
    cluster_id = Column(String(255), default="")
    created_at = Column(DateTime, default=datetime.utcnow)


# ── Alerts ─────────────────────────────────────────────────────
class Alert(Base):
    __tablename__ = "alerts"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    type = Column(String(100), nullable=False)
    description = Column(Text, default="")
    target = Column(String(255), default="")
    status = Column(String(20), default="active")
    conditions = Column(JSON, default=dict)
    last_triggered = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="alerts")


# ── Website Snapshots ──────────────────────────────────────────
class WebsiteSnapshot(Base):
    __tablename__ = "website_snapshots"
    __table_args__ = (
        Index("ix_snapshot_competitor_created", "competitor_id", "created_at"),
    )
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    competitor_id = Column(UUID(as_uuid=True), ForeignKey("competitors.id", ondelete="CASCADE"), nullable=False)
    url = Column(String(1024), nullable=False)
    html_hash = Column(String(64), default="")
    screenshot_path = Column(String(1024), default="")
    visual_hash = Column(String(64), default="")
    changes_detected = Column(Boolean, default=False)
    diff_summary = Column(Text, default="")
    clip_embedding = Column(JSON, default=list)  # CLIP visual embedding
    created_at = Column(DateTime, default=datetime.utcnow)

    competitor = relationship("Competitor", back_populates="website_snapshots")


# ── Ingestion Jobs ─────────────────────────────────────────────
class IngestionJob(Base):
    __tablename__ = "ingestion_jobs"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source = Column(String(50), nullable=False)
    competitor_id = Column(UUID(as_uuid=True), ForeignKey("competitors.id", ondelete="CASCADE"), nullable=True)
    status = Column(String(20), default="pending")  # pending, running, completed, failed
    records_processed = Column(Integer, default=0)
    error_message = Column(Text, default="")
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

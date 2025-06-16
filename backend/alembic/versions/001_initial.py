"""Initial schema

Revision ID: 001
Revises:
Create Date: 2024-01-01
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, ARRAY

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Users
    op.create_table(
        "users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("email", sa.String(255), unique=True, nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(255), server_default=""),
        sa.Column("settings", sa.JSON, server_default="{}"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("now()")),
    )
    op.create_index("ix_users_email", "users", ["email"])

    # Competitors
    op.create_table(
        "competitors",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("website", sa.String(512), server_default=""),
        sa.Column("industry", sa.String(255), server_default=""),
        sa.Column("logo_url", sa.String(512), server_default=""),
        sa.Column("description", sa.Text, server_default=""),
        sa.Column("market_position", sa.String(50), server_default=""),
        sa.Column("sentiment_score", sa.Float, server_default="0"),
        sa.Column("sentiment_change", sa.Float, server_default="0"),
        sa.Column("recent_activities", sa.Integer, server_default="0"),
        sa.Column("tracking_since", sa.DateTime, server_default=sa.text("now()")),
        sa.Column("rss_feeds", ARRAY(sa.String), server_default="{}"),
        sa.Column("keywords", ARRAY(sa.String), server_default="{}"),
        sa.Column("social_handles", sa.JSON, server_default="{}"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("now()")),
    )
    op.create_index("ix_competitors_user_industry", "competitors", ["user_id", "industry"])

    # Activities
    op.create_table(
        "activities",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("competitor_id", UUID(as_uuid=True), sa.ForeignKey("competitors.id", ondelete="CASCADE"), nullable=False),
        sa.Column("type", sa.String(50), nullable=False),
        sa.Column("title", sa.String(512), nullable=False),
        sa.Column("description", sa.Text, server_default=""),
        sa.Column("importance", sa.String(20), server_default="medium"),
        sa.Column("source", sa.String(50), server_default="custom"),
        sa.Column("source_url", sa.String(1024), server_default=""),
        sa.Column("raw_content", sa.Text, server_default=""),
        sa.Column("metadata", sa.JSON, server_default="{}"),
        sa.Column("entities", sa.JSON, server_default="[]"),
        sa.Column("embedding_id", sa.String(255), server_default=""),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("now()")),
    )
    op.create_index("ix_activities_competitor_created", "activities", ["competitor_id", "created_at"])

    # Sentiment Data
    op.create_table(
        "sentiment_data",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("competitor_id", UUID(as_uuid=True), sa.ForeignKey("competitors.id", ondelete="CASCADE"), nullable=False),
        sa.Column("score", sa.Float, nullable=False),
        sa.Column("magnitude", sa.Float, server_default="0"),
        sa.Column("source", sa.String(50), server_default="custom"),
        sa.Column("source_text", sa.Text, server_default=""),
        sa.Column("date", sa.DateTime, server_default=sa.text("now()")),
    )
    op.create_index("ix_sentiment_competitor_date", "sentiment_data", ["competitor_id", "date"])

    # Insights
    op.create_table(
        "insights",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(512), nullable=False),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("type", sa.String(50), nullable=False),
        sa.Column("confidence", sa.Float, server_default="0"),
        sa.Column("sources", sa.JSON, server_default="[]"),
        sa.Column("competitor_ids", ARRAY(UUID(as_uuid=True)), server_default="{}"),
        sa.Column("metadata", sa.JSON, server_default="{}"),
        sa.Column("cluster_id", sa.String(255), server_default=""),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("now()")),
    )

    # Alerts
    op.create_table(
        "alerts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("type", sa.String(100), nullable=False),
        sa.Column("description", sa.Text, server_default=""),
        sa.Column("target", sa.String(255), server_default=""),
        sa.Column("status", sa.String(20), server_default="active"),
        sa.Column("conditions", sa.JSON, server_default="{}"),
        sa.Column("last_triggered", sa.DateTime, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("now()")),
    )

    # Website Snapshots
    op.create_table(
        "website_snapshots",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("competitor_id", UUID(as_uuid=True), sa.ForeignKey("competitors.id", ondelete="CASCADE"), nullable=False),
        sa.Column("url", sa.String(1024), nullable=False),
        sa.Column("html_hash", sa.String(64), server_default=""),
        sa.Column("screenshot_path", sa.String(1024), server_default=""),
        sa.Column("visual_hash", sa.String(64), server_default=""),
        sa.Column("changes_detected", sa.Boolean, server_default="false"),
        sa.Column("diff_summary", sa.Text, server_default=""),
        sa.Column("clip_embedding", sa.JSON, server_default="[]"),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("now()")),
    )
    op.create_index("ix_snapshot_competitor_created", "website_snapshots", ["competitor_id", "created_at"])

    # Ingestion Jobs
    op.create_table(
        "ingestion_jobs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("source", sa.String(50), nullable=False),
        sa.Column("competitor_id", UUID(as_uuid=True), sa.ForeignKey("competitors.id", ondelete="CASCADE"), nullable=True),
        sa.Column("status", sa.String(20), server_default="pending"),
        sa.Column("records_processed", sa.Integer, server_default="0"),
        sa.Column("error_message", sa.Text, server_default=""),
        sa.Column("started_at", sa.DateTime, nullable=True),
        sa.Column("completed_at", sa.DateTime, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("now()")),
    )


def downgrade() -> None:
    op.drop_table("ingestion_jobs")
    op.drop_table("website_snapshots")
    op.drop_table("alerts")
    op.drop_table("insights")
    op.drop_table("sentiment_data")
    op.drop_table("activities")
    op.drop_table("competitors")
    op.drop_table("users")

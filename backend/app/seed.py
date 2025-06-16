"""
Database seeder — creates demo user, competitors, and alerts on first run.
Idempotent: skips if demo user already exists.
"""
import asyncio
import logging
from datetime import datetime, timedelta
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.auth import hash_password
from app.models import User, Competitor, Alert

logger = logging.getLogger(__name__)

# ── Demo credentials ──────────────────────────────────────────
DEMO_EMAIL = "admin@insightscout.dev"
DEMO_PASSWORD = "admin123"
DEMO_NAME = "Fouzan (Admin)"

# ── Competitors to seed ──────────────────────────────────────
COMPETITORS = [
    {
        "name": "OpenAI",
        "website": "https://openai.com",
        "industry": "Artificial Intelligence",
        "description": "AI research lab behind ChatGPT, GPT-4, DALL-E, and Codex. Leading the frontier of large language models.",
        "market_position": "leader",
        "keywords": ["openai", "chatgpt", "gpt-4", "dall-e"],
        "rss_feeds": ["https://openai.com/blog/rss.xml"],
        "social_handles": {"twitter": "@OpenAI", "github": "openai/openai-python"},
    },
    {
        "name": "Google DeepMind",
        "website": "https://deepmind.google",
        "industry": "Artificial Intelligence",
        "description": "Google's AI research division behind Gemini, AlphaFold, and AlphaGo. Pushing boundaries in multimodal AI.",
        "market_position": "leader",
        "keywords": ["google", "deepmind", "gemini", "bard", "alphafold"],
        "rss_feeds": [],
        "social_handles": {"twitter": "@GoogleDeepMind", "github": "google-deepmind/gemma"},
    },
    {
        "name": "Meta AI",
        "website": "https://ai.meta.com",
        "industry": "Artificial Intelligence",
        "description": "Meta's AI research lab behind LLaMA, SAM, and open-source AI models. Pioneer in open-weight LLMs.",
        "market_position": "challenger",
        "keywords": ["meta", "llama", "facebook ai", "open source ai"],
        "rss_feeds": [],
        "social_handles": {"twitter": "@MetaAI", "github": "meta-llama/llama"},
    },
    {
        "name": "Anthropic",
        "website": "https://anthropic.com",
        "industry": "Artificial Intelligence",
        "description": "AI safety company behind Claude. Focused on building reliable, interpretable, and steerable AI systems.",
        "market_position": "challenger",
        "keywords": ["anthropic", "claude", "constitutional ai", "ai safety"],
        "rss_feeds": [],
        "social_handles": {"twitter": "@AnthropicAI", "github": "anthropics/anthropic-sdk-python"},
    },
    {
        "name": "Microsoft",
        "website": "https://microsoft.com",
        "industry": "Technology",
        "description": "Tech giant with major AI investments via OpenAI partnership. Copilot, Azure AI, and enterprise AI integration.",
        "market_position": "leader",
        "keywords": ["microsoft", "copilot", "azure ai", "bing ai"],
        "rss_feeds": ["https://blogs.microsoft.com/feed/"],
        "social_handles": {"twitter": "@Microsoft", "github": "microsoft/vscode"},
    },
    {
        "name": "Amazon AWS",
        "website": "https://aws.amazon.com",
        "industry": "Cloud & AI",
        "description": "Cloud infrastructure leader with Bedrock, SageMaker, and AI services. Key player in enterprise AI deployment.",
        "market_position": "leader",
        "keywords": ["aws", "amazon", "bedrock", "sagemaker", "alexa ai"],
        "rss_feeds": ["https://aws.amazon.com/blogs/aws/feed/"],
        "social_handles": {"twitter": "@awscloud", "github": "aws/aws-sdk-python"},
    },
    {
        "name": "Nvidia",
        "website": "https://nvidia.com",
        "industry": "AI Hardware & Software",
        "description": "Dominant AI chip maker. H100/B200 GPUs power most AI training. CUDA ecosystem is the backbone of ML infrastructure.",
        "market_position": "leader",
        "keywords": ["nvidia", "cuda", "h100", "gpu", "tensorrt"],
        "rss_feeds": ["https://blogs.nvidia.com/feed/"],
        "social_handles": {"twitter": "@nvidia", "github": "NVIDIA/TensorRT"},
    },
    {
        "name": "Mistral AI",
        "website": "https://mistral.ai",
        "industry": "Artificial Intelligence",
        "description": "French AI startup building open and commercial LLMs. Known for efficient, high-performance models.",
        "market_position": "niche",
        "keywords": ["mistral", "mixtral", "mistral ai", "pixtral"],
        "rss_feeds": [],
        "social_handles": {"twitter": "@MistralAI", "github": "mistralai/mistral-src"},
    },
]

# ── Alerts to seed ────────────────────────────────────────────
ALERTS = [
    {
        "name": "Sentiment Drop Alert",
        "type": "sentiment_spike",
        "description": "Alert when any competitor sentiment drops below 30 (very negative)",
        "target": "all_competitors",
        "conditions": {"threshold": 30, "direction": "below", "window_hours": 24},
    },
    {
        "name": "New Product Launch",
        "type": "new_feature",
        "description": "Detect when competitors announce new products or features",
        "target": "all_competitors",
        "conditions": {"activity_types": ["product"], "importance": "high"},
    },
    {
        "name": "Pricing Change Monitor",
        "type": "price_change",
        "description": "Track pricing page changes across competitor websites",
        "target": "all_competitors",
        "conditions": {"page_keywords": ["pricing", "plans", "enterprise"], "change_threshold": 0.1},
    },
    {
        "name": "Hiring Surge Detector",
        "type": "hiring_surge",
        "description": "Alert when competitors show unusual hiring activity",
        "target": "all_competitors",
        "conditions": {"min_postings": 10, "window_days": 7},
    },
    {
        "name": "Press & Media Mentions",
        "type": "press_mention",
        "description": "Track major press coverage and media mentions",
        "target": "all_competitors",
        "conditions": {"sources": ["news", "reddit", "twitter"], "min_volume": 5},
    },
]


async def seed_database():
    """Seed the database with demo data. Idempotent — skips if demo user exists."""
    async with async_session() as db:
        # Check if demo user already exists
        result = await db.execute(select(User).where(User.email == DEMO_EMAIL))
        existing = result.scalar_one_or_none()

        if existing:
            logger.info("Seed data already exists (user: %s). Skipping.", DEMO_EMAIL)
            return False

        logger.info("Seeding database with demo data...")

        # Create demo user
        user = User(
            id=uuid4(),
            email=DEMO_EMAIL,
            hashed_password=hash_password(DEMO_PASSWORD),
            full_name=DEMO_NAME,
            settings={"theme": "dark", "notifications": True},
        )
        db.add(user)
        await db.flush()
        logger.info("Created demo user: %s / %s", DEMO_EMAIL, DEMO_PASSWORD)

        # Create competitors
        for comp_data in COMPETITORS:
            competitor = Competitor(
                id=uuid4(),
                user_id=user.id,
                **comp_data,
            )
            db.add(competitor)
        await db.flush()
        logger.info("Created %d competitors", len(COMPETITORS))

        # Create alerts
        for alert_data in ALERTS:
            alert = Alert(
                id=uuid4(),
                user_id=user.id,
                **alert_data,
            )
            db.add(alert)
        await db.flush()
        logger.info("Created %d alerts", len(ALERTS))

        await db.commit()
        logger.info("Database seeded successfully!")
        return True


def run_seed():
    """Synchronous wrapper for seed_database."""
    return asyncio.run(seed_database())

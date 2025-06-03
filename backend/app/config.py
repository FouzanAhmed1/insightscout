from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # ── Database ──
    DATABASE_URL: str = "postgresql+asyncpg://insightscout:insightscout_secret@localhost:5432/insightscout"
    DATABASE_URL_SYNC: str = "postgresql://insightscout:insightscout_secret@localhost:5432/insightscout"

    # ── Redis ──
    REDIS_URL: str = "redis://localhost:6379/0"

    # ── RabbitMQ ──
    RABBITMQ_URL: str = "amqp://insightscout:insightscout_secret@localhost:5672/"

    # ── Auth ──
    JWT_SECRET: str = "change-me-in-production-insightscout-2024"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # ── HuggingFace ──
    HUGGINGFACE_CACHE: str = ".cache/huggingface"
    SENTIMENT_MODEL: str = "cardiffnlp/twitter-roberta-base-sentiment-latest"
    NER_MODEL: str = "dslim/bert-base-NER"
    CLASSIFICATION_MODEL: str = "valhalla/distilbart-mnli-12-3"
    CLIP_MODEL: str = "ViT-B-32"
    CLIP_PRETRAINED: str = "laion2b_s34b_b79k"

    # ── Ingestion ──
    NEWS_API_KEY: str = ""
    REDDIT_CLIENT_ID: str = ""
    REDDIT_CLIENT_SECRET: str = ""
    TWITTER_BEARER_TOKEN: str = ""

    # ── Scheduling ──
    INGESTION_INTERVAL_MINUTES: int = 30
    MONITORING_INTERVAL_MINUTES: int = 60

    model_config = {"env_file": ".env", "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    return Settings()

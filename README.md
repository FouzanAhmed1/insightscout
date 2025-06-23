# InsightScout

A competitive intelligence platform I built to track competitors across multiple data sources, analyze sentiment and activities using NLP, and surface insights through a clean dashboard.

## What It Does

- **Data Ingestion** — Pulls data from RSS feeds, News API, Reddit, Twitter/X, GitHub, SEC filings, YouTube, and website scraping
- **Sentiment Analysis** — Scores competitor mentions using RoBERTa, tracks sentiment trends over time
- **Activity Classification** — Automatically categorizes activities (product launches, pricing changes, hiring, partnerships, etc.) using zero-shot classification
- **Website Monitoring** — Takes automated screenshots via Playwright and detects visual changes using CLIP embeddings
- **Insight Generation** — Clusters related activities and flags opportunities, threats, trends, and anomalies
- **Custom Alerts** — Set up rules based on sentiment thresholds, keywords, or activity types
- **Dashboard** — KPI cards, sentiment trend charts, competitor comparisons, and a real-time activity feed

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 14, React, TypeScript, Tailwind CSS, Recharts, Zustand |
| Backend | FastAPI, SQLAlchemy 2.0 (async), Alembic, APScheduler |
| ML/NLP | HuggingFace Transformers, Sentence-Transformers, CLIP, scikit-learn |
| Infra | PostgreSQL 16, Redis 7, RabbitMQ 3.13, Docker Compose |
| Auth | JWT (python-jose), bcrypt |

## Architecture

```
Next.js (:3000) → FastAPI (:8000) → PostgreSQL (:5432)
                        ↓
                  RabbitMQ (:5672)     Redis (:6379)
                        ↓
                  Worker Process
                  (ingestion, NLP, monitoring, insights)
```

## Getting Started

You just need Docker.

```bash
chmod +x start.sh
./start.sh
```

This spins up all 6 services. Once it's running:

- **Frontend:** http://localhost:3000
- **API:** http://localhost:8000
- **Swagger Docs:** http://localhost:8000/docs

A demo account gets seeded automatically — `admin@insightscout.dev` / `admin123`.

## Environment Variables

The Docker setup handles defaults, but if you want to customize:

**backend/.env:**
```env
DATABASE_URL=postgresql+asyncpg://insightscout:insightscout_secret@postgres:5432/insightscout
REDIS_URL=redis://redis:6379/0
RABBITMQ_URL=amqp://insightscout:insightscout_secret@rabbitmq:5672/
JWT_SECRET=change-me-in-production

# Optional — for additional data sources
NEWS_API_KEY=
REDDIT_CLIENT_ID=
REDDIT_CLIENT_SECRET=
TWITTER_BEARER_TOKEN=
```

**frontend/.env.local:**
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## How It Works

1. Add competitors you want to track (name, website, industry)
2. Trigger data ingestion — the worker fetches data from configured sources
3. NLP pipeline runs automatically: sentiment scoring, entity extraction, activity classification
4. Check the dashboard for trends, insights, and alerts
5. Set up alert rules to get notified about specific changes

Website monitoring works separately — trigger a snapshot from the monitoring page and the system compares it against previous snapshots using CLIP embeddings and SSIM.

## Stopping

```bash
docker compose down        # stop services
docker compose down -v     # stop and remove data
```

# InsightScout — AI-Powered Competitive Intelligence Platform

A full-stack competitive intelligence platform that tracks competitors across 10+ data sources, runs NLP analysis using transformer models, and surfaces actionable business insights in real-time.

![Python](https://img.shields.io/badge/Python-3.11-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-green)
![Next.js](https://img.shields.io/badge/Next.js-14.2-black)
![Docker](https://img.shields.io/badge/Docker-Compose-blue)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue)

## Features

- **Multi-Source Data Ingestion** — RSS feeds, News API, Reddit, Twitter/X, GitHub, SEC filings (EDGAR), YouTube, and direct website scraping
- **NLP Pipeline** — Sentiment analysis (RoBERTa), named entity recognition, zero-shot activity classification, and semantic text clustering using HuggingFace Transformers
- **Website Monitoring** — Automated screenshots via Playwright with visual change detection using CLIP embeddings and OpenCV SSIM comparison
- **Insight Generation** — Agentic pipeline that clusters related activities by semantic similarity and classifies them as opportunities, threats, trends, or anomalies
- **Custom Alerts** — Configurable monitoring rules with sentiment thresholds, keyword matching, and activity type triggers
- **Interactive Dashboard** — Sentiment trend charts, competitor comparisons, KPI cards, and a real-time activity feed

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Next.js    │────▶│   FastAPI     │────▶│ PostgreSQL  │
│   Frontend   │     │   Backend     │     │   (Data)    │
│  :3000       │     │  :8000        │     │  :5432      │
└─────────────┘     └──────┬───────┘     └─────────────┘
                           │
                    ┌──────┴───────┐
                    │              │
               ┌────▼────┐  ┌─────▼─────┐
               │ RabbitMQ │  │   Redis    │
               │ (Queue)  │  │  (Cache)   │
               │ :5672    │  │  :6379     │
               └────┬─────┘  └───────────┘
                    │
               ┌────▼──────────────────┐
               │   Worker Process       │
               │  - Data ingestion      │
               │  - NLP processing      │
               │  - Website monitoring  │
               │  - Insight generation  │
               └───────────────────────┘
```

## Tech Stack

| Layer        | Technology                                                        |
|-------------|-------------------------------------------------------------------|
| Frontend    | Next.js 14, React 18, TypeScript, Tailwind CSS, Recharts, Zustand |
| Backend     | FastAPI, SQLAlchemy 2.0 (async), Alembic, APScheduler             |
| AI/ML       | HuggingFace Transformers, Sentence-Transformers, CLIP, scikit-learn |
| Infra       | PostgreSQL 16, Redis 7, RabbitMQ 3.13, Docker Compose             |
| Auth        | JWT (python-jose), bcrypt                                         |

## Getting Started

### Prerequisites

- [Docker](https://www.docker.com/) and Docker Compose V2

### Quick Start

```bash
chmod +x start.sh
./start.sh
```

This starts all 6 services. Once running:

| Service     | URL                          |
|------------|------------------------------|
| Frontend   | http://localhost:3000         |
| Backend API| http://localhost:8000         |
| API Docs   | http://localhost:8000/docs    |
| RabbitMQ UI| http://localhost:15672        |

### Environment Variables

Create `backend/.env`:

```env
DATABASE_URL=postgresql+asyncpg://insightscout:insightscout_secret@postgres:5432/insightscout
REDIS_URL=redis://redis:6379/0
RABBITMQ_URL=amqp://insightscout:insightscout_secret@rabbitmq:5672/
JWT_SECRET=change-me-in-production

# Optional — enable additional data sources
NEWS_API_KEY=
REDDIT_CLIENT_ID=
REDDIT_CLIENT_SECRET=
TWITTER_BEARER_TOKEN=
```

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## API Endpoints

### Auth
| Method | Endpoint              | Description         |
|--------|-----------------------|---------------------|
| POST   | `/api/auth/register`  | Create account      |
| POST   | `/api/auth/login`     | Get JWT token       |
| GET    | `/api/auth/me`        | Current user info   |

### Competitors
| Method | Endpoint                       | Description              |
|--------|--------------------------------|--------------------------|
| GET    | `/api/competitors/`            | List (filter by industry, search, sort) |
| POST   | `/api/competitors/`            | Create competitor        |
| GET    | `/api/competitors/{id}`        | Get details              |
| PATCH  | `/api/competitors/{id}`        | Update                   |
| DELETE | `/api/competitors/{id}`        | Delete                   |

### Intelligence
| Method | Endpoint                  | Description                        |
|--------|---------------------------|------------------------------------|
| GET    | `/api/activities/`        | List activities (filter by type, importance) |
| GET    | `/api/sentiment/`         | Sentiment history (7/30/90 days)   |
| GET    | `/api/sentiment/summary`  | Average sentiment per competitor   |
| POST   | `/api/sentiment/analyze`  | Queue sentiment analysis           |
| GET    | `/api/insights/`          | List AI-generated insights         |
| POST   | `/api/insights/generate`  | Trigger insight generation pipeline |

### Monitoring & Alerts
| Method | Endpoint                   | Description                    |
|--------|----------------------------|--------------------------------|
| GET    | `/api/monitoring/snapshots`| Website snapshots              |
| POST   | `/api/monitoring/trigger`  | Trigger screenshot + CLIP diff |
| GET    | `/api/alerts/`             | List alerts                    |
| POST   | `/api/alerts/`             | Create alert rule              |
| POST   | `/api/ingestion/trigger`   | Trigger data ingestion         |

## ML Models Used

| Task                   | Model                        | Purpose                                    |
|------------------------|------------------------------|--------------------------------------------|
| Sentiment Analysis     | RoBERTa (via Transformers)   | Score text positive/negative/neutral (0-100)|
| Entity Recognition     | NER pipeline (Transformers)  | Extract people, orgs, locations             |
| Activity Classification| Embedding cosine similarity (all-MiniLM-L6-v2) | Classify as product launch, pricing change, hiring, etc. |
| Text Embeddings        | all-MiniLM-L6-v2             | Semantic similarity & clustering            |
| Visual Analysis        | CLIP (OpenCLIP)              | Website screenshot classification & change detection |

## Usage Guide

### 1. First Run & Login

After `./start.sh`, open **http://localhost:3000**. A demo account is seeded automatically:

- **Email:** `admin@insightscout.dev`
- **Password:** `admin123`

Or register a new account from the auth page.

### 2. Adding Competitors

Navigate to **Competitors** → click **Add Competitor**. Fill in:
- **Name** — e.g. "OpenAI"
- **Website** — e.g. "https://openai.com"
- **Industry** — e.g. "AI/ML", "Fintech", "E-commerce"
- **Description** — a short summary of what they do

### 3. Ingesting Data

Go to **Ingestion** → click **Trigger Ingestion**. Select a source (RSS, News API, Reddit, etc.) and optionally a specific competitor. The worker will fetch data, run NLP analysis (sentiment, classification, NER), and store results. Processing takes ~30-60 seconds per competitor with batch inference.

### 4. Dashboard

The **Dashboard** shows:
- **KPI Cards** — tracked competitors, activities detected, active alerts, avg sentiment, records today, active sources
- **Sentiment Trends** — multi-line chart showing sentiment scores per competitor over the last 30 days
- **Recent Activity** — latest detected competitor activities (clickable if they have source URLs)
- **AI Insights** — opportunities, threats, trends, and anomalies generated by the insight pipeline

### 5. Monitoring Competitors

- **Sentiment** — view sentiment history per competitor, analyze custom text
- **Activities** — browse all detected activities, filter by type and competitor
- **Insights** — view AI-generated insights or trigger the generation pipeline
- **Alerts** — set up rules for sentiment thresholds, keyword matches, or activity type triggers

### 6. Website Monitoring

From a competitor's detail page or **Monitoring**, trigger a website snapshot. The system takes a screenshot via Playwright, computes CLIP embeddings, and compares with previous snapshots to detect visual changes.

### 7. API Access

Full Swagger docs are available at **http://localhost:8000/docs**. All endpoints require a JWT token (get one via `/api/auth/login`).

## Database Schema

9 tables: `users`, `competitors`, `activities`, `sentiment_data`, `insights`, `alerts`, `website_snapshots`, `ingestion_jobs`, and supporting enums. Migrations managed by Alembic and auto-run on startup.

## Design Decisions & Tradeoffs

- **RabbitMQ over Celery** — Direct `aio-pika` consumer gives finer control over prefetch, acknowledgment, and model preloading. ML models are loaded once at worker startup to avoid repeated cold starts.
- **Async everywhere** — `asyncpg` + async SQLAlchemy + `httpx` keeps the API non-blocking. The worker uses sync model inference but runs one task at a time (`prefetch_count=1`) to bound memory usage.
- **Redis caching** — Dashboard stats and competitor lists are cached with short TTLs (60-120s) to reduce database load without serving stale data.
- **CLIP for visual diff** — Comparing website screenshots semantically (not just pixel-level) catches layout and content changes that hash-based comparison would miss.
- **Monorepo with Docker Compose** — Simplifies local development. In production, each service would be independently deployable.

## What I'd Do Differently at Scale

- Swap RabbitMQ worker for Kubernetes jobs with horizontal autoscaling per queue
- Move ML inference to a dedicated GPU service (Triton / TorchServe) behind a gRPC API
- Add a CDC pipeline (Debezium) for real-time activity streaming instead of polling
- Shard the activities table by competitor_id and partition sentiment_data by date
- Replace in-process embedding storage with a vector database (Pinecone / pgvector)

## Deploying for Free

Here are the best options for hosting InsightScout for free so others can access it.

### Option 1: Railway (Recommended)

[Railway](https://railway.app) offers a generous free tier and supports Docker Compose-style multi-service deployments.

1. Push your code to a GitHub repo
2. Sign up at [railway.app](https://railway.app) with GitHub
3. Create a new project → **Deploy from GitHub Repo**
4. Add services from the Railway dashboard:
   - **PostgreSQL** — use Railway's built-in Postgres plugin (free)
   - **Redis** — use Railway's built-in Redis plugin (free)
   - **Backend** — point to `/backend` directory, set Dockerfile path
   - **Frontend** — point to `/frontend` directory, set Dockerfile path
5. Set environment variables on each service:
   - Backend: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `RABBITMQ_URL`
   - Frontend: `NEXT_PUBLIC_API_URL` (your backend's Railway URL), `INTERNAL_API_URL`
6. Railway auto-deploys on every push

**Note:** Railway's free tier gives $5/month credit which is enough for light usage. For RabbitMQ, use [CloudAMQP](https://www.cloudamqp.com/) free tier (Little Lemur plan).

### Option 2: Render

[Render](https://render.com) offers free web services with some limitations.

1. Push to GitHub
2. Create services on Render:
   - **Web Service** (Backend): Docker, point to `/backend`, set env vars
   - **Web Service** (Frontend): Docker, point to `/frontend`
   - **PostgreSQL**: Use Render's free Postgres (90-day limit on free tier)
   - **Redis**: Use Render's free Redis
3. Set `NEXT_PUBLIC_API_URL` on frontend to your backend's Render URL
4. Free tier services spin down after 15 min of inactivity (cold starts ~30s)

### Option 3: Fly.io

[Fly.io](https://fly.io) gives you 3 free VMs and supports Docker.

1. Install the `flyctl` CLI
2. For each service (backend, frontend, worker):
   ```bash
   cd backend
   fly launch --name insightscout-api
   fly secrets set DATABASE_URL=... REDIS_URL=... JWT_SECRET=...
   ```
3. Use Fly Postgres (`fly postgres create`) and Upstash Redis (free) for databases
4. Use CloudAMQP free tier for RabbitMQ

### Free Database & Queue Providers

| Service | Provider | Free Tier |
|---------|----------|-----------|
| PostgreSQL | [Neon](https://neon.tech) | 512 MB, always free |
| PostgreSQL | [Supabase](https://supabase.com) | 500 MB, 2 projects |
| Redis | [Upstash](https://upstash.com) | 10K commands/day |
| RabbitMQ | [CloudAMQP](https://cloudamqp.com) | Little Lemur (1M msgs/month) |

### Environment Variables for Production

When deploying, update these values:

```env
# Backend
DATABASE_URL=postgresql+asyncpg://<user>:<pass>@<host>:5432/<db>
REDIS_URL=redis://<host>:6379
RABBITMQ_URL=amqp://<user>:<pass>@<host>:5672/
JWT_SECRET=<generate-a-strong-random-string>

# Frontend
NEXT_PUBLIC_API_URL=https://your-backend-url.railway.app
```

Generate a secure JWT secret:
```bash
openssl rand -hex 32
```

## Stopping the App

```bash
docker compose down
```

To also remove stored data:

```bash
docker compose down -v
```

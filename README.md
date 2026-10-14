# InsightScout

An AI-powered competitive intelligence platform. Track competitors across ten-plus data sources, run the results through NLP pipelines (sentiment scoring, activity classification, visual change detection), and surface everything in a real-time dashboard with alerts.

## How the system fits together

```
Ingestion sources          NLP pipelines               API            UI
(RSS, News API,            (sentiment, NER,             (FastAPI)      (Next.js)
 Reddit, GitHub, SEC,       zero-shot classification,
 YouTube, Twitter,          CLIP vision diffing,        Postgres
 LinkedIn, App Store,       insight clustering)        Redis
 website scraping)                                     RabbitMQ
      │                          │                       │              │
      └─────────► Worker ◄───────┴──► queue results ────►┴──► dashboard │
                  (scheduler +                                              │
                   RabbitMQ consumer)                                user login
```

1. **Ingest** - a scheduler publishes ingestion jobs to RabbitMQ; the worker fetches competitor mentions from RSS, news, Reddit, GitHub, SEC filings, YouTube, Twitter/X, LinkedIn, the App Store, and raw website scraping.
2. **Analyze** - each record runs through transformer-based NLP: RoBERTa sentiment scoring, NER, zero-shot activity classification (product launch, pricing change, hiring, partnership, etc.). Website snapshots go through Playwright + CLIP embeddings for visual change detection.
3. **Cluster** - related activities are grouped into insights flagged as opportunities, threats, trends, or anomalies.
4. **Serve** - FastAPI exposes everything under `/api/*`; a Next.js dashboard shows KPI cards, sentiment trends, competitor comparisons, and a live activity feed. Custom alert rules fire on sentiment drops, keywords, or activity types.

## Tech stack

| Layer      | Tech                                                                          |
|------------|-------------------------------------------------------------------------------|
| Frontend   | Next.js 14, React 18, TypeScript, Tailwind CSS, Recharts, Zustand              |
| Backend    | FastAPI, SQLAlchemy 2.0 (async), Alembic, APScheduler                          |
| ML / NLP   | HuggingFace Transformers, Sentence-Transformers, CLIP, scikit-learn           |
| Infra      | PostgreSQL 16, Redis 7, RabbitMQ 3.13, Docker Compose                          |
| Auth       | JWT (python-jose), bcrypt                                                     |

## Prerequisites

- Docker Engine 24+ with the Docker Compose v2 plugin (`docker compose version` should work)
- ~8 GB of free RAM and ~6 GB of disk for the ML model downloads on first run

No other setup. Python, Node, Postgres, Redis, and RabbitMQ all run inside containers.

## Quickstart

From a fresh clone:

```bash
git clone <this-repo>
cd insightscout
./start.sh
```

That is the whole setup. The script checks for Docker, creates a `.env` from `.env.example` if you do not have one, brings up Postgres, Redis, and RabbitMQ, then builds and starts the backend, the worker, and the frontend.

When it finishes, open:

- **Dashboard:** http://localhost:3000
- **API docs (Swagger):** http://localhost:8000/docs
- **RabbitMQ management:** http://localhost:15672 (user `insightscout`, password `insightscout_secret`)

A demo account is seeded on first run: `admin@insightscout.dev` / `admin123`. It comes with 8 competitors and 5 alert rules already configured, and an initial ingestion job is triggered automatically, so you should see data flowing within a few minutes.

Watch the worker to see ingestion and NLP processing in real time:

```bash
docker compose logs -f worker
```

## Running the demo

1. Log in with the seeded demo account.
2. The dashboard should already have competitors (OpenAI, Anthropic, Nvidia, and others). If the feed is empty, give the first ingestion pass a few minutes to complete.
3. Try it out:
   - Add a competitor from the Competitors page, then hit **Run ingestion** to pull fresh mentions.
   - Check the **Sentiment** page for trend lines per competitor.
   - Open **Monitoring**, add a website URL, and trigger a snapshot to see visual change detection.
   - Create an alert rule (for example: notify me when sentiment for a competitor drops below -0.3) on the **Alerts** page.

## Configuration

All settings live in the root `.env` file. Copy `.env.example` to `.env` (start.sh does this for you) and edit what you need. One caveat: the infra connection strings (`DATABASE_URL`, `REDIS_URL`, `RABBITMQ_URL`) are pinned by docker-compose.yml for the containerized setup, so `.env` values for those only take effect if you run the backend outside Docker.

- `JWT_SECRET` - **change this in any real deployment.** The default is a placeholder and is only acceptable for local development.
- `NEWS_API_KEY`, `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `TWITTER_BEARER_TOKEN` - optional. Ingestion works without them (RSS, GitHub, SEC filings, and website scraping need no keys); sources that need a key are skipped gracefully with a warning in the worker logs.
- `INGESTION_INTERVAL_MINUTES`, `MONITORING_INTERVAL_MINUTES` - how often the scheduler re-runs ingestion and website monitoring. Defaults are 30 and 60.
- `DEMO_EMAIL`, `DEMO_PASSWORD`, `DEMO_NAME` - the seeded demo account. Change these if you do not want the well-known default login.
- The HF model names (`SENTIMENT_MODEL`, `NER_MODEL`, etc.) - override only if you know what you are doing; defaults are the models the pipelines were tested with.

See `.env.example` for the full list with defaults.

## Project layout

```
insightscout/
  start.sh                 One-command setup: infra, then app services
  docker-compose.yml       postgres, redis, rabbitmq, backend, worker, frontend
  .env.example             Documented settings (copy to .env to customize)
  backend/
    Dockerfile
    requirements.txt       Pinned dependencies
    alembic/               Database migrations
    app/
      main.py              FastAPI app, routers, CORS, startup lifespan
      config.py            Settings (reads env, falls back to sane defaults)
      routers/             auth, dashboard, competitors, activities, sentiment,
                           insights, alerts, monitoring, ingestion
      services/            ingestion.py, nlp.py, vision.py, insights.py, scheduler.py
      workers/consumer.py  RabbitMQ consumer: ingestion -> NLP -> vision -> insights
      seed.py              Demo data seeder (idempotent)
  frontend/
    Dockerfile
    src/
      app/                 Next.js App Router pages (dashboard, auth, settings, trends)
      components/          layout, ui primitives
      lib/                 API client (proxied through Next.js rewrites), store
```

## Stopping and cleanup

```bash
docker compose down        # stop services, keep data
docker compose down -v     # stop services and delete all data volumes
```

## Notes and limitations

- This is a development-grade setup. The backend runs uvicorn with `--reload` and the frontend runs `next dev`, which is great for iterating but not how you would deploy it.
- First startup downloads several hundred MB of HuggingFace models, so the worker is slow to become useful on a cold start. Models are cached in a named volume (`hf_cache`) so this only happens once.
- Demo credentials are intentionally simple and documented. Do not expose this stack to the internet without changing them and setting a real `JWT_SECRET`.

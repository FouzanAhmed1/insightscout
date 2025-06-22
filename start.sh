#!/bin/bash
set -e

echo "=========================================="
echo "  InsightScout — Competitive Intelligence Platform"
echo "=========================================="
echo ""

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "ERROR: Docker is required. Install from https://docker.com"
    exit 1
fi

if ! docker compose version &> /dev/null; then
    echo "ERROR: Docker Compose V2 is required."
    exit 1
fi

echo "[1/3] Starting infrastructure (PostgreSQL, Redis, RabbitMQ)..."
docker compose up -d postgres redis rabbitmq

echo "[2/3] Waiting for services to be healthy..."
sleep 5

echo "[3/3] Starting backend, worker, and frontend..."
docker compose up -d --build

echo ""
echo "=========================================="
echo "  Services running:"
echo "  Frontend:   http://localhost:3000"
echo "  Backend:    http://localhost:8000"
echo "  API Docs:   http://localhost:8000/docs"
echo "  RabbitMQ:   http://localhost:15672"
echo "                (user: insightscout / pass: insightscout_secret)"
echo ""
echo "  Login Credentials (auto-seeded):"
echo "    Email:    admin@insightscout.dev"
echo "    Password: admin123"
echo ""
echo "  8 competitors pre-loaded with auto-ingestion"
echo "  5 alert rules active"
echo "=========================================="
echo ""
echo "Run 'docker compose logs -f worker' to watch NLP processing"
echo "Run 'docker compose down' to stop all services"

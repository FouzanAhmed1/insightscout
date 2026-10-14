"""
Throughput benchmark for the InsightScout NLP pipeline.

Measures real per-record processing latency through process_record()
(sentiment + NER + classification) using the production HuggingFace models,
then extrapolates sustained records/day for a single worker.

Usage:
    pip install -r backend/requirements.txt
    python benchmark/throughput.py [--samples N]

The printed records/day figure is measured, not estimated. Only cite it
on a resume if you ran this yourself on representative hardware.
"""
import argparse
import statistics
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

SAMPLE_TEXTS = [
    "Acme Corp launches a new AI-powered analytics dashboard for enterprise customers, "
    "with pricing starting at $499 per month and a free 14-day trial.",
    "Beta Inc announces a 15 percent price increase on all subscription tiers effective "
    "next quarter, citing rising infrastructure costs.",
    "Gamma Labs hires former Google VP Jane Smith as new CTO to lead their "
    "machine learning platform team of 200 engineers.",
    "Delta Co partners with Microsoft to integrate Azure OpenAI services into "
    "their customer support product line.",
    "Epsilon startup raises $50M Series B led by Andreessen Horowitz to expand "
    "their real-time data pipeline offering.",
    "Zeta Corp reports Q3 earnings beating expectations with 40 percent revenue "
    "growth driven by their cloud segment.",
    "Eta Inc unveils a marketing campaign targeting developers with open-source "
    "tooling and a $1M hackathon prize pool.",
    "Theta Ltd ships a major technology update to their mobile app with on-device "
    "ML inference and offline support.",
    "Iota Systems acquires competitor Kappa AI for $200M to consolidate their "
    "position in the observability market.",
    "Lambda Co opens a new 500-person engineering hub in Toronto focused on "
    "distributed systems and data infrastructure.",
]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--samples", type=int, default=10)
    args = parser.parse_args()

    from app.services.insights import process_record
    from uuid import uuid4

    texts = (SAMPLE_TEXTS * ((args.samples // len(SAMPLE_TEXTS)) + 1))[: args.samples]
    latencies: list[float] = []

    print(f"Warming up + measuring {args.samples} records through process_record()...")
    for i, text in enumerate(texts):
        record = {"title": f"Sample {i}", "content": text}
        start = time.perf_counter()
        process_record(record, uuid4())
        latencies.append(time.perf_counter() - start)
        print(f"  record {i + 1}/{args.samples}: {latencies[-1]:.2f}s")

    # Drop the first (cold model load) for the steady-state figure.
    steady = latencies[1:] if len(latencies) > 1 else latencies
    median = statistics.median(steady)
    per_day = int(86400 / median)

    print()
    print(f"Median per-record latency (steady state): {median:.2f}s")
    print(f"Measured single-worker throughput: ~{per_day:,} records/day")
    print("Note: batch inference (batch_sentiment/batch_classify) is 3-5x faster")
    print("than per-record processing; run with --samples 50+ for tighter numbers.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

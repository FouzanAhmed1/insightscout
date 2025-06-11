"""
HuggingFace NLP Service — Sentiment Analysis, NER, Zero-Shot Classification, Text Clustering.
Runs on the worker process, models are loaded once and cached.
"""
import logging
from functools import lru_cache
import numpy as np
from transformers import pipeline, AutoTokenizer, AutoModelForSequenceClassification
from sentence_transformers import SentenceTransformer
from sklearn.cluster import AgglomerativeClustering
from sklearn.metrics.pairwise import cosine_similarity
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


# ── Model Loaders (cached singletons) ─────────────────────────

@lru_cache
def get_sentiment_pipeline():
    logger.info("Loading sentiment model: %s", settings.SENTIMENT_MODEL)
    return pipeline(
        "sentiment-analysis",
        model=settings.SENTIMENT_MODEL,
        tokenizer=settings.SENTIMENT_MODEL,
        top_k=None,
        truncation=True,
        max_length=512,
    )


@lru_cache
def get_ner_pipeline():
    logger.info("Loading NER model: %s", settings.NER_MODEL)
    return pipeline(
        "ner",
        model=settings.NER_MODEL,
        tokenizer=settings.NER_MODEL,
        aggregation_strategy="simple",
    )


@lru_cache
def get_classification_pipeline():
    logger.info("Loading zero-shot classification model: %s", settings.CLASSIFICATION_MODEL)
    return pipeline(
        "zero-shot-classification",
        model=settings.CLASSIFICATION_MODEL,
    )


@lru_cache
def get_embedding_model():
    logger.info("Loading sentence embedding model")
    return SentenceTransformer("all-MiniLM-L6-v2")


# ── Sentiment Analysis ─────────────────────────────────────────

def analyze_sentiment(text: str) -> dict:
    """
    Analyze sentiment of text using RoBERTa model.
    Returns: {"label": "positive"|"negative"|"neutral", "score": 0.0-1.0, "scores": {...}}
    """
    pipe = get_sentiment_pipeline()
    results = pipe(text[:512])

    # results is a list of lists of dicts with label/score
    if results and isinstance(results[0], list):
        results = results[0]

    label_map = {}
    for r in results:
        label_map[r["label"].lower()] = r["score"]

    # Normalize to 0-100 scale
    pos = label_map.get("positive", 0)
    neg = label_map.get("negative", 0)
    neu = label_map.get("neutral", 0)

    # Weighted score: 0 = very negative, 50 = neutral, 100 = very positive
    normalized_score = round((pos * 100 + neu * 50 + neg * 0), 2)
    best_label = max(label_map, key=label_map.get)

    return {
        "label": best_label,
        "score": normalized_score,
        "magnitude": round(max(pos, neg) - neu, 4),
        "raw_scores": label_map,
    }


def batch_sentiment(texts: list[str], batch_size: int = 32) -> list[dict]:
    """Analyze sentiment for a batch of texts using native pipeline batching."""
    pipe = get_sentiment_pipeline()
    truncated = [t[:512] for t in texts]
    raw_results = pipe(truncated, batch_size=batch_size)

    results = []
    for raw in raw_results:
        # Normalize nested list format
        if isinstance(raw, list) and raw and isinstance(raw[0], dict):
            items = raw
        elif isinstance(raw, list) and raw and isinstance(raw[0], list):
            items = raw[0]
        else:
            items = raw

        label_map = {}
        for r in items:
            label_map[r["label"].lower()] = r["score"]

        pos = label_map.get("positive", 0)
        neg = label_map.get("negative", 0)
        neu = label_map.get("neutral", 0)
        normalized_score = round((pos * 100 + neu * 50 + neg * 0), 2)
        best_label = max(label_map, key=label_map.get)

        results.append({
            "label": best_label,
            "score": normalized_score,
            "magnitude": round(max(pos, neg) - neu, 4),
            "raw_scores": label_map,
        })
    return results


def batch_classify(texts: list[str], candidate_labels: list[str] | None = None) -> list[dict]:
    """
    Classify a batch of texts using embedding similarity (~50x faster than zero-shot BART).
    Embeds both texts and labels with sentence-transformer, then matches by cosine similarity.
    """
    labels = candidate_labels or ACTIVITY_LABELS
    model = get_embedding_model()

    # Embed labels once (cached across calls via model internals)
    label_embeddings = model.encode(labels, show_progress_bar=False)

    # Embed all texts in one batch
    text_embeddings = model.encode([t[:512] for t in texts], show_progress_bar=False, batch_size=64)

    # Cosine similarity: (num_texts, embedding_dim) @ (embedding_dim, num_labels) => (num_texts, num_labels)
    sims = cosine_similarity(text_embeddings, label_embeddings)

    results = []
    for sim_row in sims:
        best_idx = int(np.argmax(sim_row))
        all_scores = {labels[j]: round(float(sim_row[j]), 4) for j in range(len(labels))}
        results.append({
            "label": labels[best_idx],
            "score": round(float(sim_row[best_idx]), 4),
            "all_scores": all_scores,
        })
    return results


def batch_ner(texts: list[str], batch_size: int = 32) -> list[list[dict]]:
    """Extract entities from a batch of texts using native pipeline batching."""
    pipe = get_ner_pipeline()
    truncated = [t[:512] for t in texts]
    raw_results = pipe(truncated, batch_size=batch_size)

    results = []
    for raw in raw_results:
        entities = []
        for r in raw:
            entities.append({
                "entity": r["entity_group"],
                "word": r["word"],
                "score": round(float(r["score"]), 4),
                "start": r["start"],
                "end": r["end"],
            })
        results.append(entities)
    return results


# ── Named Entity Recognition ──────────────────────────────────

def extract_entities(text: str) -> list[dict]:
    """
    Extract named entities (ORG, PER, LOC, MISC) from text.
    Returns: [{"entity": "ORG", "word": "Apple", "score": 0.99, "start": 0, "end": 5}]
    """
    pipe = get_ner_pipeline()
    results = pipe(text[:512])
    entities = []
    for r in results:
        entities.append({
            "entity": r["entity_group"],
            "word": r["word"],
            "score": round(float(r["score"]), 4),
            "start": r["start"],
            "end": r["end"],
        })
    return entities


# ── Zero-Shot Classification ──────────────────────────────────

ACTIVITY_LABELS = [
    "product launch", "pricing change", "hiring announcement",
    "partnership deal", "marketing campaign", "earnings report",
    "regulatory filing", "security incident", "leadership change",
    "technology update", "market expansion", "customer complaint",
]

INSIGHT_LABELS = ["opportunity", "threat", "trend", "anomaly"]


def classify_activity(text: str, candidate_labels: list[str] | None = None) -> dict:
    """
    Classify text into activity categories using zero-shot classification.
    Returns: {"label": str, "score": float, "all_scores": {label: score}}
    """
    pipe = get_classification_pipeline()
    labels = candidate_labels or ACTIVITY_LABELS
    result = pipe(text[:512], candidate_labels=labels, multi_label=False)
    return {
        "label": result["labels"][0],
        "score": round(float(result["scores"][0]), 4),
        "all_scores": dict(zip(result["labels"], [round(float(s), 4) for s in result["scores"]])),
    }


def classify_insight_type(text: str) -> dict:
    """Classify whether an insight is an opportunity, threat, trend, or anomaly."""
    return classify_activity(text, INSIGHT_LABELS)


# ── Text Embedding & Clustering ────────────────────────────────

def embed_texts(texts: list[str]) -> np.ndarray:
    """Generate sentence embeddings for a list of texts."""
    model = get_embedding_model()
    return model.encode(texts, show_progress_bar=False)


def cluster_texts(texts: list[str], threshold: float = 0.35) -> list[dict]:
    """
    Cluster texts by semantic similarity using agglomerative clustering.
    Returns: [{"cluster_id": int, "texts": [...], "centroid_idx": int}]
    """
    if len(texts) < 2:
        return [{"cluster_id": 0, "texts": texts, "centroid_idx": 0}] if texts else []

    embeddings = embed_texts(texts)
    sim_matrix = cosine_similarity(embeddings)
    distance_matrix = 1 - sim_matrix

    clustering = AgglomerativeClustering(
        n_clusters=None,
        distance_threshold=threshold,
        metric="precomputed",
        linkage="average",
    )
    labels = clustering.fit_predict(distance_matrix)

    clusters = {}
    for idx, label in enumerate(labels):
        label = int(label)
        if label not in clusters:
            clusters[label] = {"cluster_id": label, "texts": [], "indices": []}
        clusters[label]["texts"].append(texts[idx])
        clusters[label]["indices"].append(idx)

    # Find centroid for each cluster
    result = []
    for cid, cluster in clusters.items():
        indices = cluster["indices"]
        sub_embeddings = embeddings[indices]
        centroid = sub_embeddings.mean(axis=0)
        dists = np.linalg.norm(sub_embeddings - centroid, axis=1)
        centroid_local = int(np.argmin(dists))
        result.append({
            "cluster_id": cid,
            "texts": cluster["texts"],
            "centroid_idx": indices[centroid_local],
            "size": len(cluster["texts"]),
        })

    return sorted(result, key=lambda x: x["size"], reverse=True)

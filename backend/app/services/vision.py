"""
CLIP + OpenCV Vision Service — Visual similarity, screenshot comparison, image classification.
"""
import hashlib
import io
import logging
from functools import lru_cache
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
import open_clip
import torch

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


# ── CLIP Model Loader ──────────────────────────────────────────

@lru_cache
def get_clip_model():
    logger.info("Loading CLIP model: %s / %s", settings.CLIP_MODEL, settings.CLIP_PRETRAINED)
    model, _, preprocess = open_clip.create_model_and_transforms(
        settings.CLIP_MODEL, pretrained=settings.CLIP_PRETRAINED
    )
    tokenizer = open_clip.get_tokenizer(settings.CLIP_MODEL)
    model.eval()
    return model, preprocess, tokenizer


# ── CLIP Embeddings ────────────────────────────────────────────

def embed_image(image: Image.Image) -> list[float]:
    """Generate CLIP embedding for a PIL image."""
    model, preprocess, _ = get_clip_model()
    img_tensor = preprocess(image).unsqueeze(0)
    with torch.no_grad():
        features = model.encode_image(img_tensor)
        features /= features.norm(dim=-1, keepdim=True)
    return features[0].cpu().numpy().tolist()


def embed_text(text: str) -> list[float]:
    """Generate CLIP text embedding."""
    model, _, tokenizer = get_clip_model()
    tokens = tokenizer([text])
    with torch.no_grad():
        features = model.encode_text(tokens)
        features /= features.norm(dim=-1, keepdim=True)
    return features[0].cpu().numpy().tolist()


def clip_similarity(image: Image.Image, text: str) -> float:
    """Compute CLIP similarity between an image and text."""
    img_emb = np.array(embed_image(image))
    txt_emb = np.array(embed_text(text))
    return float(np.dot(img_emb, txt_emb))


def classify_image(image: Image.Image, labels: list[str]) -> dict:
    """
    Zero-shot image classification using CLIP.
    Returns: {"label": str, "score": float, "all_scores": {label: score}}
    """
    model, preprocess, tokenizer = get_clip_model()
    img_tensor = preprocess(image).unsqueeze(0)
    tokens = tokenizer(labels)

    with torch.no_grad():
        img_features = model.encode_image(img_tensor)
        txt_features = model.encode_text(tokens)
        img_features /= img_features.norm(dim=-1, keepdim=True)
        txt_features /= txt_features.norm(dim=-1, keepdim=True)
        similarity = (100.0 * img_features @ txt_features.T).softmax(dim=-1)

    scores = similarity[0].cpu().numpy()
    best_idx = int(np.argmax(scores))
    return {
        "label": labels[best_idx],
        "score": round(float(scores[best_idx]), 4),
        "all_scores": {l: round(float(s), 4) for l, s in zip(labels, scores)},
    }


# ── OpenCV Screenshot Comparison ──────────────────────────────

def image_to_cv2(image: Image.Image) -> np.ndarray:
    """Convert PIL Image to OpenCV format."""
    return cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)


def compute_visual_hash(image: Image.Image) -> str:
    """Compute perceptual hash of an image using OpenCV."""
    cv_img = image_to_cv2(image)
    gray = cv2.cvtColor(cv_img, cv2.COLOR_BGR2GRAY)
    resized = cv2.resize(gray, (64, 64))
    return hashlib.sha256(resized.tobytes()).hexdigest()


def compare_screenshots(img1: Image.Image, img2: Image.Image) -> dict:
    """
    Compare two screenshots using multiple OpenCV methods.
    Returns: {"ssim": float, "pixel_diff_pct": float, "changed_regions": [...], "diff_image": bytes}
    """
    cv_img1 = image_to_cv2(img1.resize((1280, 720)))
    cv_img2 = image_to_cv2(img2.resize((1280, 720)))

    gray1 = cv2.cvtColor(cv_img1, cv2.COLOR_BGR2GRAY)
    gray2 = cv2.cvtColor(cv_img2, cv2.COLOR_BGR2GRAY)

    # Structural Similarity (simplified — full SSIM needs scikit-image)
    diff = cv2.absdiff(gray1, gray2)
    non_zero = np.count_nonzero(diff > 25)
    total_pixels = diff.shape[0] * diff.shape[1]
    pixel_diff_pct = round((non_zero / total_pixels) * 100, 2)

    # Mean absolute difference as pseudo-SSIM
    mean_diff = float(np.mean(diff))
    ssim_approx = round(1.0 - (mean_diff / 255.0), 4)

    # Find changed regions using contours
    _, thresh = cv2.threshold(diff, 30, 255, cv2.THRESH_BINARY)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    dilated = cv2.dilate(thresh, kernel, iterations=2)
    contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    changed_regions = []
    diff_visual = cv_img2.copy()
    for contour in contours:
        area = cv2.contourArea(contour)
        if area > 500:  # Filter small noise
            x, y, w, h = cv2.boundingRect(contour)
            changed_regions.append({"x": x, "y": y, "width": w, "height": h, "area": int(area)})
            cv2.rectangle(diff_visual, (x, y), (x + w, y + h), (0, 0, 255), 2)

    # Encode diff image
    _, buffer = cv2.imencode(".png", diff_visual)
    diff_bytes = buffer.tobytes()

    return {
        "ssim": ssim_approx,
        "pixel_diff_pct": pixel_diff_pct,
        "changed_regions": changed_regions,
        "changes_detected": pixel_diff_pct > 1.0,
        "diff_image": diff_bytes,
    }


def detect_visual_changes(
    current_image: Image.Image,
    previous_image: Image.Image | None,
    labels: list[str] | None = None,
) -> dict:
    """
    Full visual analysis pipeline: CLIP classification + OpenCV diff.
    """
    result = {
        "clip_embedding": embed_image(current_image),
        "visual_hash": compute_visual_hash(current_image),
    }

    # CLIP classification
    if labels:
        result["classification"] = classify_image(current_image, labels)

    # Screenshot diff
    if previous_image:
        comparison = compare_screenshots(previous_image, current_image)
        result["comparison"] = {
            "ssim": comparison["ssim"],
            "pixel_diff_pct": comparison["pixel_diff_pct"],
            "changed_regions": comparison["changed_regions"],
            "changes_detected": comparison["changes_detected"],
        }
    else:
        result["comparison"] = None

    return result

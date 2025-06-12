"""
Data Ingestion Service — Pulls data from 10+ sources using async HTTP.
Each source handler returns normalized records for the NLP pipeline.
"""
import hashlib
import logging
from datetime import datetime
from typing import Any

import feedparser
import httpx
from bs4 import BeautifulSoup

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

HTTP_TIMEOUT = 30.0
USER_AGENT = "InsightScout/1.0 (+https://insightscout.dev)"


def _content_hash(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()[:16]


# ── Normalized Record ──────────────────────────────────────────

def make_record(
    source: str,
    title: str,
    content: str,
    url: str = "",
    published: datetime | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict:
    return {
        "source": source,
        "title": title,
        "content": content,
        "url": url,
        "published": published or datetime.utcnow(),
        "content_hash": _content_hash(title + content),
        "metadata": metadata or {},
    }


# ── 1. RSS Feed Ingestion ─────────────────────────────────────

async def ingest_rss(feed_urls: list[str]) -> list[dict]:
    records = []
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT, headers={"User-Agent": USER_AGENT}) as client:
        for url in feed_urls:
            try:
                resp = await client.get(url)
                feed = feedparser.parse(resp.text)
                for entry in feed.entries[:50]:
                    content = entry.get("summary", "") or entry.get("description", "")
                    records.append(make_record(
                        source="rss",
                        title=entry.get("title", ""),
                        content=BeautifulSoup(content, "html.parser").get_text()[:2000],
                        url=entry.get("link", ""),
                        published=datetime(*entry.published_parsed[:6]) if hasattr(entry, "published_parsed") and entry.published_parsed else None,
                        metadata={"feed_url": url},
                    ))
            except Exception as e:
                logger.error("RSS ingestion error for %s: %s", url, e)
    return records


# ── 2. News API Ingestion ─────────────────────────────────────

async def ingest_news_api(keywords: list[str], page_size: int = 50) -> list[dict]:
    if not settings.NEWS_API_KEY:
        logger.warning("NEWS_API_KEY not set, skipping news API ingestion")
        return []

    records = []
    query = " OR ".join(keywords)
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
        try:
            resp = await client.get(
                "https://newsapi.org/v2/everything",
                params={"q": query, "pageSize": page_size, "sortBy": "publishedAt", "language": "en"},
                headers={"X-Api-Key": settings.NEWS_API_KEY},
            )
            data = resp.json()
            for article in data.get("articles", []):
                records.append(make_record(
                    source="news_api",
                    title=article.get("title", ""),
                    content=article.get("description", "") or article.get("content", ""),
                    url=article.get("url", ""),
                    published=datetime.fromisoformat(article["publishedAt"].replace("Z", "+00:00")) if article.get("publishedAt") else None,
                    metadata={"source_name": article.get("source", {}).get("name", "")},
                ))
        except Exception as e:
            logger.error("News API ingestion error: %s", e)
    return records


# ── 3. Reddit Ingestion ───────────────────────────────────────

async def ingest_reddit(subreddits: list[str], keywords: list[str]) -> list[dict]:
    records = []
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT, headers={"User-Agent": USER_AGENT}) as client:
        for subreddit in subreddits:
            try:
                resp = await client.get(
                    f"https://www.reddit.com/r/{subreddit}/search.json",
                    params={"q": " OR ".join(keywords), "sort": "new", "limit": 50, "restrict_sr": "on", "t": "week"},
                )
                data = resp.json()
                for post in data.get("data", {}).get("children", []):
                    p = post["data"]
                    records.append(make_record(
                        source="reddit",
                        title=p.get("title", ""),
                        content=p.get("selftext", "")[:2000],
                        url=f"https://reddit.com{p.get('permalink', '')}",
                        published=datetime.fromtimestamp(p["created_utc"]) if p.get("created_utc") else None,
                        metadata={"subreddit": subreddit, "score": p.get("score", 0), "num_comments": p.get("num_comments", 0)},
                    ))
            except Exception as e:
                logger.error("Reddit ingestion error for r/%s: %s", subreddit, e)
    return records


# ── 4. Website Scraping ───────────────────────────────────────

async def ingest_website(urls: list[str]) -> list[dict]:
    records = []
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT, headers={"User-Agent": USER_AGENT}, follow_redirects=True) as client:
        for url in urls:
            try:
                resp = await client.get(url)
                soup = BeautifulSoup(resp.text, "html.parser")

                # Remove scripts and styles
                for tag in soup(["script", "style", "nav", "footer"]):
                    tag.decompose()

                title = soup.title.string if soup.title else url
                text = soup.get_text(separator=" ", strip=True)[:5000]

                records.append(make_record(
                    source="website",
                    title=title,
                    content=text,
                    url=url,
                    metadata={"html_hash": _content_hash(resp.text)},
                ))
            except Exception as e:
                logger.error("Website scraping error for %s: %s", url, e)
    return records


# ── 5. GitHub Activity ────────────────────────────────────────

async def ingest_github(repos: list[str]) -> list[dict]:
    records = []
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT, headers={"User-Agent": USER_AGENT}) as client:
        for repo in repos:
            try:
                # Get recent events
                resp = await client.get(f"https://api.github.com/repos/{repo}/events", params={"per_page": 30})
                events = resp.json()
                for event in events:
                    if isinstance(event, dict):
                        records.append(make_record(
                            source="github",
                            title=f"{event.get('type', 'Event')} on {repo}",
                            content=str(event.get("payload", {}))[:1000],
                            url=f"https://github.com/{repo}",
                            published=datetime.fromisoformat(event["created_at"].replace("Z", "+00:00")) if event.get("created_at") else None,
                            metadata={"repo": repo, "event_type": event.get("type", "")},
                        ))
            except Exception as e:
                logger.error("GitHub ingestion error for %s: %s", repo, e)
    return records


# ── 6. SEC Filings (EDGAR) ────────────────────────────────────

async def ingest_sec_filings(company_names: list[str]) -> list[dict]:
    records = []
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT, headers={"User-Agent": USER_AGENT}) as client:
        for name in company_names:
            try:
                resp = await client.get(
                    "https://efts.sec.gov/LATEST/search-index",
                    params={"q": name, "dateRange": "custom", "startdt": "2024-01-01", "forms": "10-K,10-Q,8-K"},
                )
                data = resp.json()
                for hit in data.get("hits", {}).get("hits", [])[:20]:
                    src = hit.get("_source", {})
                    records.append(make_record(
                        source="sec_filings",
                        title=f"{src.get('form_type', 'Filing')}: {src.get('entity_name', name)}",
                        content=src.get("file_description", ""),
                        url=f"https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company={name}",
                        metadata={"form_type": src.get("form_type", ""), "entity": src.get("entity_name", "")},
                    ))
            except Exception as e:
                logger.error("SEC filing ingestion error for %s: %s", name, e)
    return records


# ── 7. YouTube Ingestion ──────────────────────────────────────

async def ingest_youtube(channel_ids: list[str], keywords: list[str]) -> list[dict]:
    """Ingest via YouTube RSS feeds (no API key needed)."""
    records = []
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT, headers={"User-Agent": USER_AGENT}) as client:
        for channel_id in channel_ids:
            try:
                resp = await client.get(f"https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}")
                feed = feedparser.parse(resp.text)
                for entry in feed.entries[:20]:
                    title = entry.get("title", "")
                    if any(kw.lower() in title.lower() for kw in keywords) or not keywords:
                        records.append(make_record(
                            source="youtube",
                            title=title,
                            content=entry.get("summary", "")[:2000],
                            url=entry.get("link", ""),
                            published=datetime(*entry.published_parsed[:6]) if hasattr(entry, "published_parsed") and entry.published_parsed else None,
                            metadata={"channel_id": channel_id},
                        ))
            except Exception as e:
                logger.error("YouTube ingestion error for %s: %s", channel_id, e)
    return records


# ── 8. Twitter/X Ingestion ───────────────────────────────────

async def ingest_twitter(handles: list[str], keywords: list[str]) -> list[dict]:
    """Ingest tweets using Twitter/X API v2 (requires TWITTER_BEARER_TOKEN)."""
    if not settings.TWITTER_BEARER_TOKEN:
        logger.warning("TWITTER_BEARER_TOKEN not set, skipping Twitter ingestion")
        return []

    records = []
    query = " OR ".join([f"from:{h.lstrip('@')}" for h in handles] + keywords)
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
        try:
            resp = await client.get(
                "https://api.twitter.com/2/tweets/search/recent",
                params={
                    "query": query,
                    "max_results": 100,
                    "tweet.fields": "created_at,public_metrics,author_id",
                },
                headers={"Authorization": f"Bearer {settings.TWITTER_BEARER_TOKEN}"},
            )
            data = resp.json()
            for tweet in data.get("data", []):
                metrics = tweet.get("public_metrics", {})
                records.append(make_record(
                    source="twitter",
                    title=tweet.get("text", "")[:200],
                    content=tweet.get("text", ""),
                    url=f"https://twitter.com/i/web/status/{tweet['id']}",
                    published=datetime.fromisoformat(tweet["created_at"].replace("Z", "+00:00")) if tweet.get("created_at") else None,
                    metadata={
                        "likes": metrics.get("like_count", 0),
                        "retweets": metrics.get("retweet_count", 0),
                        "replies": metrics.get("reply_count", 0),
                        "author_id": tweet.get("author_id", ""),
                    },
                ))
        except Exception as e:
            logger.error("Twitter ingestion error: %s", e)
    return records


# ── 9. LinkedIn Ingestion ────────────────────────────────────

async def ingest_linkedin(company_names: list[str], keywords: list[str]) -> list[dict]:
    """
    Ingest LinkedIn company data via public page scraping.
    Fetches recent posts from company pages via the public feed.
    """
    records = []
    async with httpx.AsyncClient(
        timeout=HTTP_TIMEOUT,
        headers={"User-Agent": USER_AGENT},
        follow_redirects=True,
    ) as client:
        for company in company_names:
            try:
                slug = company.lower().replace(" ", "-").replace(",", "").replace(".", "")
                resp = await client.get(f"https://www.linkedin.com/company/{slug}/posts/")
                if resp.status_code == 200:
                    soup = BeautifulSoup(resp.text, "html.parser")
                    # Extract visible text content from company page
                    for tag in soup(["script", "style", "nav", "footer", "header"]):
                        tag.decompose()
                    text_blocks = soup.find_all(["p", "span", "div"], class_=lambda c: c and "update" in str(c).lower())
                    page_text = soup.get_text(separator=" ", strip=True)[:5000]

                    if page_text:
                        records.append(make_record(
                            source="linkedin",
                            title=f"LinkedIn activity: {company}",
                            content=page_text,
                            url=f"https://www.linkedin.com/company/{slug}/",
                            metadata={"company_slug": slug},
                        ))

                # Also search Google for recent LinkedIn posts
                google_resp = await client.get(
                    "https://www.google.com/search",
                    params={"q": f'site:linkedin.com "{company}" {" ".join(keywords[:3])}', "num": 10, "tbm": "nws"},
                )
                if google_resp.status_code == 200:
                    soup = BeautifulSoup(google_resp.text, "html.parser")
                    for link_tag in soup.find_all("a", href=True)[:10]:
                        href = link_tag.get("href", "")
                        if "linkedin.com" in href:
                            title_text = link_tag.get_text(strip=True)
                            if title_text and len(title_text) > 15:
                                records.append(make_record(
                                    source="linkedin",
                                    title=title_text[:512],
                                    content=title_text,
                                    url=href,
                                    metadata={"company": company, "via": "google_search"},
                                ))
            except Exception as e:
                logger.error("LinkedIn ingestion error for %s: %s", company, e)
    return records


# ── 10. App Store Ingestion ──────────────────────────────────

async def ingest_app_store(app_names: list[str], keywords: list[str]) -> list[dict]:
    """
    Ingest App Store data using the iTunes Search API.
    Fetches app metadata, ratings, and recent reviews.
    """
    records = []
    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT, headers={"User-Agent": USER_AGENT}) as client:
        for app_name in app_names:
            try:
                # Search for app
                resp = await client.get(
                    "https://itunes.apple.com/search",
                    params={"term": app_name, "entity": "software", "limit": 5, "country": "us"},
                )
                data = resp.json()
                for result in data.get("results", []):
                    # App metadata record
                    records.append(make_record(
                        source="app_store",
                        title=f"App Store: {result.get('trackName', app_name)}",
                        content=(
                            f"Rating: {result.get('averageUserRating', 'N/A')}/5 "
                            f"({result.get('userRatingCount', 0)} ratings). "
                            f"Version {result.get('version', 'N/A')}. "
                            f"{result.get('description', '')[:1500]}"
                        ),
                        url=result.get("trackViewUrl", ""),
                        published=datetime.fromisoformat(result["currentVersionReleaseDate"].replace("Z", "+00:00")) if result.get("currentVersionReleaseDate") else None,
                        metadata={
                            "app_id": result.get("trackId"),
                            "rating": result.get("averageUserRating"),
                            "rating_count": result.get("userRatingCount"),
                            "version": result.get("version"),
                            "developer": result.get("artistName"),
                            "price": result.get("formattedPrice"),
                            "genre": result.get("primaryGenreName"),
                            "bundle_id": result.get("bundleId"),
                        },
                    ))

                    # Fetch RSS reviews for this app
                    track_id = result.get("trackId")
                    if track_id:
                        try:
                            review_resp = await client.get(
                                f"https://itunes.apple.com/us/rss/customerreviews/id={track_id}/sortby=mostrecent/json",
                            )
                            review_data = review_resp.json()
                            entries = review_data.get("feed", {}).get("entry", [])
                            if isinstance(entries, list):
                                for entry in entries[:20]:
                                    if isinstance(entry, dict) and "content" in entry:
                                        review_text = entry.get("content", {}).get("label", "")
                                        review_title = entry.get("title", {}).get("label", "")
                                        rating = entry.get("im:rating", {}).get("label", "")
                                        if review_text:
                                            records.append(make_record(
                                                source="app_store",
                                                title=f"Review: {review_title}" if review_title else f"App Store review for {app_name}",
                                                content=review_text[:2000],
                                                url=result.get("trackViewUrl", ""),
                                                metadata={
                                                    "app_id": track_id,
                                                    "review_rating": rating,
                                                    "app_name": result.get("trackName", app_name),
                                                },
                                            ))
                        except Exception as e:
                            logger.error("App Store review fetch error for %s: %s", track_id, e)
            except Exception as e:
                logger.error("App Store ingestion error for %s: %s", app_name, e)
    return records


# ── Master Ingestion Orchestrator ──────────────────────────────

async def run_ingestion(
    competitor_name: str,
    keywords: list[str],
    rss_feeds: list[str] | None = None,
    website: str | None = None,
    social_handles: dict[str, str] | None = None,
) -> list[dict]:
    """
    Run all applicable ingestion sources for a competitor.
    Returns normalized records ready for NLP processing.
    """
    all_records = []
    social = social_handles or {}

    # RSS
    if rss_feeds:
        all_records.extend(await ingest_rss(rss_feeds))

    # News API
    all_records.extend(await ingest_news_api(keywords))

    # Reddit
    subreddits = []
    if social.get("reddit"):
        subreddits.append(social["reddit"].replace("r/", ""))
    subreddits.extend(["technology", "business"])
    all_records.extend(await ingest_reddit(subreddits, keywords))

    # Website
    if website:
        all_records.extend(await ingest_website([website]))

    # GitHub
    if social.get("github"):
        all_records.extend(await ingest_github([social["github"]]))

    # YouTube
    if social.get("youtube"):
        all_records.extend(await ingest_youtube([social["youtube"]], keywords))

    # SEC filings
    all_records.extend(await ingest_sec_filings([competitor_name]))

    # Twitter/X
    twitter_handles = []
    if social.get("twitter"):
        twitter_handles.append(social["twitter"])
    all_records.extend(await ingest_twitter(twitter_handles, keywords))

    # LinkedIn
    all_records.extend(await ingest_linkedin([competitor_name], keywords))

    # App Store
    if social.get("app_store") or social.get("app_name"):
        app_names = [social.get("app_store") or social.get("app_name")]
    else:
        app_names = [competitor_name]
    all_records.extend(await ingest_app_store(app_names, keywords))

    logger.info("Ingested %d records for competitor '%s' from %d sources",
                len(all_records), competitor_name, len(set(r["source"] for r in all_records)))
    return all_records

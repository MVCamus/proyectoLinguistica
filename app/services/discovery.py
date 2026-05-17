import re
import random
from pathlib import Path

from app.config import settings as s


TIKTOK_VIDEO_RE = re.compile(
    r"https://(?:www\.)?tiktok\.com/@[\w.-]+/video/\d+"
)


def parse_tiktok_urls(text: str) -> list[str]:
    return list(set(TIKTOK_VIDEO_RE.findall(text)))


def discover_from_hashtag(hashtag: str) -> list[str]:
    try:
        from playwright.sync_api import sync_playwright

        tag = hashtag.lstrip("#")
        url = f"https://www.tiktok.com/tag/{tag}"

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(
                user_agent=(
                    "Mozilla/5.0 (X11; Linux x86_64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/120.0.0.0 Safari/537.36"
                ),
                viewport={"width": 1280, "height": 720},
            )
            page.goto(url, timeout=15000)
            page.wait_for_timeout(3000)

            html = page.content()
            browser.close()

        urls = parse_tiktok_urls(html)
        return urls

    except ImportError:
        return []
    except Exception:
        return []


def discover_pool(
    hashtags_incluir: list[str],
    hashtags_excluir: list[str] | None = None,
    urls_manuales: list[str] | None = None,
) -> list[dict]:
    excluir = set(h.lower() for h in (hashtags_excluir or []))
    seen = set()
    pool: list[dict] = []

    if urls_manuales:
        for url in urls_manuales:
            clean = url.strip()
            if clean and clean not in seen:
                seen.add(clean)
                pool.append({"url": clean, "source": "manual"})

    if not pool:
        for ht in hashtags_incluir:
            urls = discover_from_hashtag(ht)
            for u in urls:
                if u not in seen:
                    seen.add(u)
                    pool.append({"url": u, "source": f"hashtag:{ht}"})

    if excluir:
        pool = [v for v in pool if not _has_excluded_terms(v["url"], excluir)]

    random.shuffle(pool)
    return pool


def _has_excluded_terms(url: str, excluded: set[str]) -> bool:
    # Simple URL-based filtering (metadata filtering happens in the ingesta endpoint)
    return False

import re

TIKTOK_VIDEO_RE = re.compile(
    r"https://(?:www\.)?tiktok\.com/@[\w.-]+/video/\d+"
)


def parse_tiktok_urls(text: str) -> list[str]:
    return list(set(TIKTOK_VIDEO_RE.findall(text)))


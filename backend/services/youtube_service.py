import re
from dataclasses import dataclass

import httpx

from config import settings

YOUTUBE_API_URL = "https://www.googleapis.com/youtube/v3/videos"


@dataclass
class VideoInfo:
    youtube_id: str
    title: str
    artist: str
    thumbnail_url: str
    duration: int


def _extract_video_id(url: str) -> str:
    patterns = [
        r"(?:v=|youtu\.be/)([A-Za-z0-9_-]{11})",
        r"(?:embed/|shorts/)([A-Za-z0-9_-]{11})",
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    raise ValueError(f"無法從網址中解析 YouTube video ID：{url}")


def _parse_duration(iso: str) -> int:
    """PT1H3M30S → 3810 秒"""
    match = re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", iso or "")
    if not match:
        return 0
    h = int(match.group(1) or 0)
    m = int(match.group(2) or 0)
    s = int(match.group(3) or 0)
    return h * 3600 + m * 60 + s


def extract_video_info(url: str) -> VideoInfo:
    video_id = _extract_video_id(url)

    params = {
        "part": "snippet,contentDetails",
        "id": video_id,
        "key": settings.youtube_api_key,
    }

    with httpx.Client(timeout=15) as client:
        resp = client.get(YOUTUBE_API_URL, params=params)
        resp.raise_for_status()

    data = resp.json()
    items = data.get("items", [])
    if not items:
        raise ValueError(f"找不到 YouTube 影片：{video_id}")

    item = items[0]
    snippet = item["snippet"]
    content = item["contentDetails"]

    # 取最高畫質縮圖
    thumbnails = snippet.get("thumbnails", {})
    thumbnail_url = (
        thumbnails.get("maxres", {}).get("url")
        or thumbnails.get("high", {}).get("url")
        or thumbnails.get("default", {}).get("url")
        or ""
    )

    return VideoInfo(
        youtube_id=video_id,
        title=snippet.get("title", ""),
        artist=snippet.get("channelTitle", ""),
        thumbnail_url=thumbnail_url,
        duration=_parse_duration(content.get("duration", "")),
    )

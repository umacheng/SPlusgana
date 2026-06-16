from dataclasses import dataclass

import yt_dlp


@dataclass
class VideoInfo:
    youtube_id: str
    title: str
    artist: str
    thumbnail_url: str
    duration: int


def extract_video_info(url: str) -> VideoInfo:
    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)

    youtube_id: str = info.get("id", "")
    title: str = info.get("title", "")

    # 優先使用 artist，退而求其次取 uploader
    artist: str = (
        info.get("artist")
        or info.get("creator")
        or info.get("uploader")
        or ""
    )

    # 取最高畫質縮圖
    thumbnails: list[dict] = info.get("thumbnails") or []
    thumbnail_url: str = info.get("thumbnail", "")
    if thumbnails:
        best = max(
            (t for t in thumbnails if t.get("url")),
            key=lambda t: (t.get("width") or 0) * (t.get("height") or 0),
            default=None,
        )
        if best:
            thumbnail_url = best["url"]

    duration: int = int(info.get("duration") or 0)

    return VideoInfo(
        youtube_id=youtube_id,
        title=title,
        artist=artist,
        thumbnail_url=thumbnail_url,
        duration=duration,
    )

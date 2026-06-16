from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, HttpUrl

from config import settings
from services.youtube_service import extract_video_info
from services.scraper_service import search_lyrics_url, fetch_lyrics_from_url
from services.ai_service import bulk_annotate_lyrics
from supabase import create_client, Client

router = APIRouter()


def _get_supabase() -> Client:
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


class ProcessVideoRequest(BaseModel):
    url: str


class LyricLineOut(BaseModel):
    line_number: int
    raw_text: str
    html_text: str
    time_marker: float = 0.0


class ProcessVideoResponse(BaseModel):
    song_id: int
    youtube_id: str
    title: str
    artist: str
    thumbnail_url: str
    duration: int
    source_url: str | None
    lyrics_lines: list[LyricLineOut]


@router.post("/process-video", response_model=ProcessVideoResponse)
async def process_video(body: ProcessVideoRequest):
    """
    主流程：
    1. yt-dlp 提取影片資訊
    2. 搜尋並爬取歌詞
    3. Gemini AI 標注平假名
    4. 存入 Supabase（songs + lyrics_lines）
    5. 回傳完整資料給前端
    """
    supabase = _get_supabase()

    # Step 1: 擷取 YouTube 資訊
    try:
        video = extract_video_info(body.url)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"無法解析 YouTube 連結：{e}")

    # Step 2: 檢查 Supabase 是否已存在此影片（避免重複處理）
    existing = (
        supabase.table("songs")
        .select("id, youtube_id, title, artist, thumbnail_url, duration, source_url")
        .eq("youtube_id", video.youtube_id)
        .maybe_single()
        .execute()
    )

    if existing.data:
        song = existing.data
        lines_res = (
            supabase.table("lyrics_lines")
            .select("line_number, raw_text, html_text, time_marker")
            .eq("song_id", song["id"])
            .order("line_number")
            .execute()
        )
        return ProcessVideoResponse(
            song_id=song["id"],
            youtube_id=song["youtube_id"],
            title=song["title"],
            artist=song["artist"],
            thumbnail_url=song["thumbnail_url"],
            duration=song["duration"],
            source_url=song["source_url"],
            lyrics_lines=lines_res.data or [],
        )

    # Step 3: 爬取歌詞
    source_url: str | None = None
    raw_lyrics = ""
    try:
        source_url = search_lyrics_url(video.title, video.artist)
        if source_url:
            raw_lyrics = fetch_lyrics_from_url(source_url)
    except Exception:
        raw_lyrics = ""  # 爬蟲失敗時讓前端提示手動貼上

    # Step 4: AI 標注（有歌詞才送 AI）
    lyrics_lines: list[dict] = []
    if raw_lyrics:
        try:
            lyrics_lines = bulk_annotate_lyrics(raw_lyrics)
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"AI 標注失敗：{e}")

    # Step 5: 寫入 Supabase
    song_res = (
        supabase.table("songs")
        .insert({
            "youtube_id": video.youtube_id,
            "title": video.title,
            "artist": video.artist,
            "thumbnail_url": video.thumbnail_url,
            "duration": video.duration,
            "source_url": source_url,
        })
        .execute()
    )
    song_id: int = song_res.data[0]["id"]

    if lyrics_lines:
        rows = [{"song_id": song_id, **line} for line in lyrics_lines]
        supabase.table("lyrics_lines").insert(rows).execute()

    return ProcessVideoResponse(
        song_id=song_id,
        youtube_id=video.youtube_id,
        title=video.title,
        artist=video.artist,
        thumbnail_url=video.thumbnail_url,
        duration=video.duration,
        source_url=source_url,
        lyrics_lines=lyrics_lines,
    )

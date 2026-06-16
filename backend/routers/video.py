from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

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

    if existing and existing.data:
        song = existing.data
        lines_res = (
            supabase.table("lyrics_lines")
            .select("line_number, raw_text, html_text, time_marker")
            .eq("song_id", song["id"])
            .order("line_number")
            .execute()
        )
        cached_lines = lines_res.data or []

        # 如果已有歌詞就直接回傳，不重複處理
        if cached_lines:
            return ProcessVideoResponse(
                song_id=song["id"],
                youtube_id=song["youtube_id"],
                title=song["title"],
                artist=song["artist"],
                thumbnail_url=song["thumbnail_url"],
                duration=song["duration"],
                source_url=song["source_url"],
                lyrics_lines=cached_lines,
            )

        # 歌曲存在但沒有歌詞（上次爬取失敗），重新嘗試爬取
        song_id: int = song["id"]
        source_url: str | None = song.get("source_url")
    else:
        # Step 5a: 歌曲不存在，先建立
        song_res = (
            supabase.table("songs")
            .insert({
                "youtube_id": video.youtube_id,
                "title": video.title,
                "artist": video.artist,
                "thumbnail_url": video.thumbnail_url,
                "duration": video.duration,
                "source_url": None,
            })
            .execute()
        )
        song_id = song_res.data[0]["id"]
        source_url = None

    # Step 3: 爬取歌詞
    raw_lyrics = ""
    try:
        if not source_url:
            source_url = search_lyrics_url(video.title, video.artist)
        if source_url:
            raw_lyrics = fetch_lyrics_from_url(source_url)
            # 更新 source_url
            supabase.table("songs").update({"source_url": source_url}).eq("id", song_id).execute()
    except Exception as e:
        print(f"[video] scrape failed: {e}")
        raw_lyrics = ""

    # Step 4: AI 標注（有歌詞才送 AI）
    lyrics_lines: list[dict] = []
    if raw_lyrics:
        try:
            lyrics_lines = bulk_annotate_lyrics(raw_lyrics)
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"AI 標注失敗：{e}")

    # Step 5b: 寫入歌詞行
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

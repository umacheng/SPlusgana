from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from config import settings
from services.scraper_service import fetch_lyrics_from_url
from services.ai_service import bulk_annotate_lyrics
from supabase import create_client

router = APIRouter()


def _get_supabase():
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


class AnnotateManualRequest(BaseModel):
    song_id: int
    lyrics_text: str


class RefetchFromUrlRequest(BaseModel):
    song_id: int
    lyrics_url: str


class LyricLineOut(BaseModel):
    line_number: int
    raw_text: str
    html_text: str
    time_marker: float = 0.0


class LyricsResponse(BaseModel):
    lyrics_lines: list[LyricLineOut]


class UpdateTimeMarkerRequest(BaseModel):
    song_id: int
    line_id: int
    time_marker: float


@router.post("/annotate-lyrics", response_model=LyricsResponse)
async def annotate_manual_lyrics(body: AnnotateManualRequest):
    """手動貼上歌詞文字 → AI 重新標注 → 更新資料庫"""
    supabase = _get_supabase()

    try:
        lyrics_lines = bulk_annotate_lyrics(body.lyrics_text)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI 標注失敗：{e}")

    # 刪除舊的歌詞行，重新寫入
    supabase.table("lyrics_lines").delete().eq("song_id", body.song_id).execute()
    rows = [{"song_id": body.song_id, **line} for line in lyrics_lines]
    supabase.table("lyrics_lines").insert(rows).execute()

    return LyricsResponse(lyrics_lines=lyrics_lines)


@router.post("/refetch-lyrics", response_model=LyricsResponse)
async def refetch_lyrics_from_url(body: RefetchFromUrlRequest):
    """指定歌詞網址 → 重新爬取 → AI 標注 → 更新資料庫"""
    supabase = _get_supabase()

    try:
        raw_lyrics = fetch_lyrics_from_url(body.lyrics_url)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"爬取失敗：{e}")

    try:
        lyrics_lines = bulk_annotate_lyrics(raw_lyrics)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI 標注失敗：{e}")

    # 更新資料庫 source_url
    supabase.table("songs").update({"source_url": body.lyrics_url}).eq("id", body.song_id).execute()

    # 重新寫入歌詞行
    supabase.table("lyrics_lines").delete().eq("song_id", body.song_id).execute()
    rows = [{"song_id": body.song_id, **line} for line in lyrics_lines]
    supabase.table("lyrics_lines").insert(rows).execute()

    return LyricsResponse(lyrics_lines=lyrics_lines)


@router.patch("/time-marker")
async def update_time_marker(body: UpdateTimeMarkerRequest):
    """打點器：更新單行歌詞的 time_marker"""
    supabase = _get_supabase()

    res = (
        supabase.table("lyrics_lines")
        .update({"time_marker": body.time_marker})
        .eq("id", body.line_id)
        .eq("song_id", body.song_id)  # 防止跨歌曲篡改
        .execute()
    )

    if not res.data:
        raise HTTPException(status_code=404, detail="找不到對應的歌詞行")

    return {"ok": True, "time_marker": body.time_marker}

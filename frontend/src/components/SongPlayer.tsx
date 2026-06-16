"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { annotateManualLyrics, refetchLyricsFromUrl } from "@/lib/api";
import type { Song, LyricLine } from "@/types/database";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

interface Props {
  song: Song;
  lyrics: LyricLine[];
}

export default function SongPlayer({ song, lyrics: initialLyrics }: Props) {
  const [lyrics, setLyrics] = useState<LyricLine[]>(initialLyrics);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [playerReady, setPlayerReady] = useState(false);
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualText, setManualText] = useState("");
  const [manualUrl, setManualUrl] = useState("");
  const [processing, setProcessing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLParagraphElement>(null);
  const supabase = createClient();

  const hasTimeMarkers = lyrics.some((l) => l.time_marker > 0);

  // 取得目前登入使用者
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    // 檢查是否已收藏
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: pl } = await (supabase as any)
        .from("playlists")
        .select("id")
        .eq("user_id", data.user.id)
        .eq("song_id", song.id)
        .maybeSingle();
      setSaved(!!pl);
    });
  }, []);

  // 初始化 YouTube IFrame API
  useEffect(() => {
    const loadPlayer = () => {
      if (!containerRef.current) return;
      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId: song.youtube_id,
        playerVars: { rel: 0, modestbranding: 1 },
        events: {
          onReady: () => setPlayerReady(true),
        },
      });
    };

    if (window.YT?.Player) {
      loadPlayer();
    } else {
      const existing = document.getElementById("yt-iframe-api");
      if (!existing) {
        const tag = document.createElement("script");
        tag.id = "yt-iframe-api";
        tag.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(tag);
      }
      window.onYouTubeIframeAPIReady = loadPlayer;
    }

    return () => { playerRef.current?.destroy?.(); };
  }, [song.youtube_id]);

  // 時間軸同步
  useEffect(() => {
    if (!playerReady || !hasTimeMarkers) return;
    const interval = setInterval(() => {
      const time: number = playerRef.current?.getCurrentTime?.() ?? 0;
      let active = 0;
      for (let i = 0; i < lyrics.length; i++) {
        if (lyrics[i].time_marker <= time) active = i;
      }
      setActiveIndex(active);
    }, 200);
    return () => clearInterval(interval);
  }, [playerReady, hasTimeMarkers, lyrics]);

  // 自動捲動到 active 歌詞
  useEffect(() => {
    if (activeIndex >= 0) {
      activeLineRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeIndex]);

  // 打點器：Space 鍵捕捉時間
  const handleKeyDown = useCallback(async (e: KeyboardEvent) => {
    if (!isEditingTime || e.code !== "Space") return;
    e.preventDefault();
    const time: number = playerRef.current?.getCurrentTime?.() ?? 0;
    setActiveIndex((prev) => {
      const next = prev + 1;
      if (next >= lyrics.length) return prev;
      // 更新 Supabase
      const line = lyrics[next];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from("lyrics_lines") as any).update({ time_marker: time }).eq("id", line.id).then(() => {
        setLyrics((ls) =>
          ls.map((l, i) => (i === next ? { ...l, time_marker: time } : l))
        );
      });
      return next;
    });
  }, [isEditingTime, lyrics]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // 點歌詞跳轉
  function seekTo(time: number) {
    playerRef.current?.seekTo?.(time, true);
  }

  // 收藏 / 取消收藏
  async function toggleSave() {
    if (!userId) { alert("請先登入才能收藏歌曲"); return; }
    if (saved) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("playlists") as any).delete().eq("user_id", userId).eq("song_id", song.id);
      setSaved(false);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("playlists") as any).insert({ user_id: userId, song_id: song.id });
      setSaved(true);
    }
  }

  // 手動送出歌詞文字
  async function submitManualText() {
    if (!manualText.trim()) return;
    setProcessing(true);
    try {
      const res = await annotateManualLyrics(song.id, manualText);
      setLyrics(res.lyrics_lines as any);
      setShowManualInput(false);
      setManualText("");
    } finally { setProcessing(false); }
  }

  // 手動送出歌詞網址
  async function submitManualUrl() {
    if (!manualUrl.trim()) return;
    setProcessing(true);
    try {
      const res = await refetchLyricsFromUrl(song.id, manualUrl);
      setLyrics(res.lyrics_lines as any);
      setShowManualInput(false);
      setManualUrl("");
    } finally { setProcessing(false); }
  }

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
      {/* ── 左側 / 上方：播放器 ── */}
      <div className="md:w-[45%] flex flex-col gap-4 p-4 md:p-6 shrink-0 md:overflow-y-auto">
        {/* 影片 */}
        <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-gray-900">
          <div ref={containerRef} className="w-full h-full" />
        </div>

        {/* 歌曲資訊 */}
        <div className="flex items-start gap-3">
          <img src={song.thumbnail_url} alt={song.title} className="w-14 h-14 rounded-lg object-cover shrink-0" />
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-white text-base leading-tight truncate">{song.title}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{song.artist}</p>
          </div>
          <button
            onClick={toggleSave}
            className={`shrink-0 px-3 py-1.5 rounded-full border text-sm transition-colors ${
              saved
                ? "bg-yellow-400 border-yellow-400 text-gray-950 font-medium"
                : "border-gray-700 text-gray-400 hover:border-yellow-600 hover:text-yellow-400"
            }`}
          >
            {saved ? "✓ 已收藏" : "+ 收藏"}
          </button>
        </div>

        {/* 打點器 */}
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-300">時間軸打點</span>
            <button
              onClick={() => { setIsEditingTime(!isEditingTime); setActiveIndex(-1); }}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                isEditingTime ? "bg-yellow-400 text-gray-950" : "border border-gray-700 text-gray-400 hover:border-yellow-600 hover:text-yellow-400"
              }`}
            >
              {isEditingTime ? "完成打點" : "開始打點"}
            </button>
          </div>
          {isEditingTime && (
            <p className="text-xs text-gray-500 leading-relaxed">
              播放歌曲，唱到每句時按{" "}
              <kbd className="px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700 text-gray-300 font-mono">Space</kbd>{" "}
              自動記錄時間戳，系統將依序往下打點。
            </p>
          )}
        </div>

        {/* 手動修正歌詞 */}
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-300">歌詞不對？手動修正</span>
            <button
              onClick={() => setShowManualInput(!showManualInput)}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              {showManualInput ? "收起" : "展開"}
            </button>
          </div>
          {showManualInput && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs text-gray-500">貼上歌詞網址</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={manualUrl}
                    onChange={(e) => setManualUrl(e.target.value)}
                    placeholder="https://www.uta-net.com/..."
                    className="flex-1 px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-white placeholder-gray-600 text-xs focus:outline-none focus:border-yellow-500"
                  />
                  <button
                    onClick={submitManualUrl}
                    disabled={processing || !manualUrl.trim()}
                    className="px-3 py-2 rounded-lg bg-yellow-400 text-gray-950 text-xs font-medium disabled:opacity-50"
                  >
                    {processing ? "…" : "抓取"}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-gray-500">或直接貼上歌詞文字</label>
                <textarea
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  rows={6}
                  placeholder={"一行一句歌詞…"}
                  className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-white placeholder-gray-600 text-xs focus:outline-none focus:border-yellow-500 resize-none"
                />
                <button
                  onClick={submitManualText}
                  disabled={processing || !manualText.trim()}
                  className="w-full py-2 rounded-lg bg-yellow-400 text-gray-950 text-xs font-medium disabled:opacity-50"
                >
                  {processing ? "AI 標注中…" : "重新標注"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 右側 / 下方：歌詞面板 ── */}
      <div className="lyrics-panel flex-1 overflow-y-auto p-4 md:p-6 border-t md:border-t-0 md:border-l border-gray-800">
        {lyrics.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-3 text-gray-600">
            <p className="text-4xl">🎵</p>
            <p>歌詞尚未載入，請使用左側「手動修正」功能貼上歌詞</p>
          </div>
        ) : (
          <div className="max-w-lg mx-auto md:mx-0 space-y-1">
            {!hasTimeMarkers && (
              <p className="text-xs text-gray-600 mb-4 px-3">
                歌詞已載入。使用左側「時間軸打點」功能設定同步時間點。
              </p>
            )}
            {lyrics.map((line, i) => (
              <p
                key={line.id}
                ref={i === activeIndex ? activeLineRef : null}
                onClick={() => hasTimeMarkers && seekTo(line.time_marker)}
                className={`text-xl md:text-2xl leading-loose py-2 px-3 rounded-lg transition-all duration-200 ${
                  i === activeIndex
                    ? "lyric-active cursor-default"
                    : hasTimeMarkers
                    ? "text-gray-500 hover:text-gray-300 cursor-pointer"
                    : "text-gray-400"
                }`}
                dangerouslySetInnerHTML={{ __html: line.html_text || line.raw_text }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

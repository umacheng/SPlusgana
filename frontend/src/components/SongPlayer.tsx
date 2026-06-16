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

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function SongPlayer({ song, lyrics: initialLyrics }: Props) {
  const [lyrics, setLyrics] = useState<LyricLine[]>(initialLyrics);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [playerReady, setPlayerReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [markIndex, setMarkIndex] = useState(0);
  const [saved, setSaved] = useState(false);
  const [showManualInput, setShowManualInput] = useState(initialLyrics.length === 0);
  const [manualText, setManualText] = useState("");
  const [manualUrl, setManualUrl] = useState("");
  const [processing, setProcessing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);
  const editPanelRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  const hasTimeMarkers = lyrics.some((l) => l.time_marker > 0);

  // --- Auth & saved state ---
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      setUserId(data.user?.id ?? null);
      if (!data.user) return;
      const { data: pl } = await supabase
        .from("playlists").select("id")
        .eq("user_id", data.user.id).eq("song_id", song.id).maybeSingle();
      setSaved(!!pl);
    });
  }, []);

  // --- YouTube IFrame API ---
  useEffect(() => {
    const loadPlayer = () => {
      if (!containerRef.current) return;
      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId: song.youtube_id,
        playerVars: { rel: 0, modestbranding: 1 },
        events: {
          onReady: () => setPlayerReady(true),
          onStateChange: (e: any) => {
            // 1 = playing, 2 = paused, 0 = ended
            setIsPlaying(e.data === 1);
          },
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

  // --- Lyrics sync interval (playback mode) ---
  useEffect(() => {
    if (!playerReady || !hasTimeMarkers || isEditingTime) return;
    const id = setInterval(() => {
      const t: number = playerRef.current?.getCurrentTime?.() ?? 0;
      let active = 0;
      for (let i = 0; i < lyrics.length; i++) {
        if (lyrics[i].time_marker > 0 && lyrics[i].time_marker <= t) active = i;
      }
      setActiveIndex(active);
    }, 200);
    return () => clearInterval(id);
  }, [playerReady, hasTimeMarkers, isEditingTime, lyrics]);

  // --- Current time counter (marking mode) ---
  useEffect(() => {
    if (!isEditingTime) return;
    const id = setInterval(() => {
      const t: number = playerRef.current?.getCurrentTime?.() ?? 0;
      setCurrentTime(t);
    }, 100);
    return () => clearInterval(id);
  }, [isEditingTime]);

  // --- Auto-scroll active lyric line ---
  useEffect(() => {
    if (activeIndex >= 0 && !isEditingTime) {
      activeLineRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeIndex, isEditingTime]);

  // --- Enter / exit marking mode ---
  useEffect(() => {
    if (isEditingTime) {
      setMarkIndex(0);
      editPanelRef.current?.focus();
    } else {
      setCurrentTime(0);
    }
  }, [isEditingTime]);

  // --- Mark current time for the next lyric line ---
  const markTime = useCallback(() => {
    const time: number = playerRef.current?.getCurrentTime?.() ?? 0;
    setMarkIndex((prev) => {
      if (prev >= lyrics.length) return prev;
      const line = lyrics[prev];
      supabase.from("lyrics_lines")
        .update({ time_marker: time })
        .eq("id", line.id)
        .then(() => {
          setLyrics((ls) => ls.map((l, i) => i === prev ? { ...l, time_marker: time } : l));
        });
      return prev + 1;
    });
  }, [lyrics]);

  const handlePanelKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.code !== "Space") return;
    e.preventDefault();
    markTime();
  }, [markTime]);

  // --- Custom play / pause (keeps focus outside iframe) ---
  function togglePlay() {
    if (!playerReady) return;
    if (isPlaying) {
      playerRef.current?.pauseVideo?.();
    } else {
      playerRef.current?.playVideo?.();
    }
  }

  function seekTo(time: number) {
    playerRef.current?.seekTo?.(time, true);
  }

  // --- Playlist save / unsave ---
  async function toggleSave() {
    if (!userId) { alert("請先登入才能收藏歌曲"); return; }
    if (saved) {
      await supabase.from("playlists").delete().eq("user_id", userId).eq("song_id", song.id);
      setSaved(false);
    } else {
      await supabase.from("playlists").insert({ user_id: userId, song_id: song.id });
      setSaved(true);
    }
  }

  // --- Manual lyrics input ---
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

      {/* ===== Left panel ===== */}
      <div className="md:w-[45%] flex flex-col gap-4 p-4 md:p-6 shrink-0 md:overflow-y-auto">

        {/* YouTube embed */}
        <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-gray-900">
          <div ref={containerRef} className="w-full h-full" />
        </div>

        {/* Song info + save */}
        <div className="flex items-start gap-3">
          <img src={song.thumbnail_url} alt={song.title} className="w-14 h-14 rounded-lg object-cover shrink-0" />
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-white text-base leading-tight truncate">{song.title}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{song.artist}</p>
          </div>
          <button
            onClick={toggleSave}
            className={`shrink-0 px-3 py-1.5 rounded-full border text-sm transition-colors ${
              saved ? "bg-yellow-400 border-yellow-400 text-gray-950 font-medium"
                    : "border-gray-700 text-gray-400 hover:border-yellow-600 hover:text-yellow-400"
            }`}
          >
            {saved ? "✓ 已收藏" : "+ 收藏"}
          </button>
        </div>

        {/* ===== Time-marker panel ===== */}
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-300">時間軸打點</span>
            <button
              onClick={() => setIsEditingTime(!isEditingTime)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                isEditingTime ? "bg-yellow-400 text-gray-950"
                              : "border border-gray-700 text-gray-400 hover:border-yellow-600 hover:text-yellow-400"
              }`}
            >
              {isEditingTime ? "完成打點" : "開始打點"}
            </button>
          </div>

          {isEditingTime && (
            <div
              ref={editPanelRef}
              tabIndex={0}
              onKeyDown={handlePanelKeyDown}
              className="outline-none space-y-3"
            >
              {/* Custom play/pause — keeps focus off the iframe */}
              <div className="flex items-center gap-3">
                <button
                  onClick={togglePlay}
                  disabled={!playerReady}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 ${
                    isPlaying ? "bg-gray-700 text-white hover:bg-gray-600"
                              : "bg-white/10 text-white hover:bg-white/20"
                  }`}
                >
                  {isPlaying ? "⏸ 暫停" : "▶ 播放"}
                </button>
                <span className={`font-mono text-sm tabular-nums ${isPlaying ? "text-yellow-400" : "text-gray-600"}`}>
                  {formatTime(currentTime)}
                </span>
                {!isPlaying && playerReady && (
                  <span className="text-xs text-gray-600">播放後即可打點</span>
                )}
              </div>

              <p className="text-xs text-gray-600">
                點擊「打點」按鈕（或先點此區域再按{" "}
                <kbd className="px-1 py-0.5 rounded bg-gray-800 border border-gray-700 text-gray-400 font-mono text-xs">Space</kbd>
                ）依序標記每句開始時間。
              </p>

              {/* Mark button */}
              <button
                onClick={markTime}
                disabled={markIndex >= lyrics.length}
                className="w-full py-3 rounded-xl bg-yellow-400 text-gray-950 font-semibold text-sm hover:bg-yellow-300 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ⏱ 打點（Space）
              </button>

              {/* Progress + undo */}
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500">
                  {markIndex < lyrics.length
                    ? `第 ${markIndex + 1} / ${lyrics.length} 句：${lyrics[markIndex]?.raw_text ?? ""}`
                    : "全部打點完成 🎉"}
                </p>
                <button
                  onClick={() => setMarkIndex(Math.max(0, markIndex - 1))}
                  disabled={markIndex === 0}
                  className="text-xs text-gray-600 hover:text-gray-400 disabled:opacity-30 shrink-0 ml-2"
                >
                  ← 退一句
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ===== Manual lyrics panel ===== */}
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-gray-300">歌詞來源</span>
              {lyrics.length === 0 && (
                <span className="ml-2 text-xs text-amber-500">自動搜尋失敗，請手動輸入</span>
              )}
            </div>
            <button onClick={() => setShowManualInput(!showManualInput)} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
              {showManualInput ? "收起" : "展開"}
            </button>
          </div>
          {showManualInput && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs text-gray-500">貼上歌詞網址（uta-net.com 等）</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={manualUrl}
                    onChange={(e) => setManualUrl(e.target.value)}
                    placeholder="https://www.uta-net.com/song/..."
                    className="flex-1 px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-white placeholder-gray-600 text-xs focus:outline-none focus:border-yellow-500"
                  />
                  <button onClick={submitManualUrl} disabled={processing || !manualUrl.trim()} className="px-3 py-2 rounded-lg bg-yellow-400 text-gray-950 text-xs font-medium disabled:opacity-50">
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
                  placeholder="一行一句歌詞…"
                  className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-white placeholder-gray-600 text-xs focus:outline-none focus:border-yellow-500 resize-none"
                />
                <button onClick={submitManualText} disabled={processing || !manualText.trim()} className="w-full py-2 rounded-lg bg-yellow-400 text-gray-950 text-xs font-medium disabled:opacity-50">
                  {processing ? "AI 標注中…" : "重新標注"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ===== Right panel — lyrics ===== */}
      <div className="lyrics-panel flex-1 overflow-y-auto p-4 md:p-6 border-t md:border-t-0 md:border-l border-gray-800">
        {lyrics.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-3 text-gray-600 py-16">
            <p className="text-3xl">🎵</p>
            <p className="text-sm">歌詞自動搜尋失敗</p>
            <p className="text-xs text-gray-700">請使用左側「歌詞來源」貼上 uta-net.com 網址或直接貼文字</p>
          </div>
        ) : (
          <div className="max-w-lg mx-auto md:mx-0 space-y-1">
            {!hasTimeMarkers && !isEditingTime && (
              <p className="text-xs text-gray-700 mb-4 px-3">歌詞已載入，可使用左側「時間軸打點」設定同步。</p>
            )}
            {lyrics.map((line, i) => (
              <div
                key={line.id}
                ref={i === activeIndex && !isEditingTime ? activeLineRef : null}
                onClick={() => !isEditingTime && hasTimeMarkers && seekTo(line.time_marker)}
                className={`flex items-baseline gap-2 py-2 px-3 rounded-lg transition-all duration-200 ${
                  isEditingTime && i === markIndex
                    ? "bg-yellow-400/10 border border-yellow-400/30"
                    : i === activeIndex && !isEditingTime
                    ? "lyric-active"
                    : hasTimeMarkers && !isEditingTime
                    ? "cursor-pointer"
                    : ""
                }`}
              >
                <p
                  className={`flex-1 text-xl md:text-2xl leading-loose ${
                    isEditingTime && i === markIndex ? "text-yellow-300"
                    : isEditingTime && i < markIndex  ? "text-gray-600"
                    : i === activeIndex && !isEditingTime ? "text-white"
                    : "text-gray-500"
                  }`}
                  dangerouslySetInnerHTML={{ __html: line.html_text || line.raw_text }}
                />
                {isEditingTime && line.time_marker > 0 && (
                  <span className="shrink-0 text-xs text-yellow-600 font-mono tabular-nums">
                    {formatTime(line.time_marker)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

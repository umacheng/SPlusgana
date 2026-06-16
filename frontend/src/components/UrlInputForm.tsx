"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { processVideo } from "@/lib/api";

const STEPS = [
  { after: 0,  text: "正在解析 YouTube 影片…" },
  { after: 5,  text: "正在搜尋歌詞…" },
  { after: 15, text: "AI 標注假名中，約需 30 秒…" },
  { after: 50, text: "還在努力處理中，請稍候…" },
];

export default function UrlInputForm() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [stepText, setStepText] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (!loading) { setStepText(""); return; }
    const start = Date.now();
    const id = setInterval(() => {
      const elapsed = (Date.now() - start) / 1000;
      const step = [...STEPS].reverse().find((s) => elapsed >= s.after);
      setStepText(step?.text ?? "");
    }, 500);
    return () => clearInterval(id);
  }, [loading]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setError("");
    setLoading(true);
    try {
      const result = await processVideo(url.trim());
      router.push(`/song/${result.song_id}`);
    } catch (err: any) {
      setError(err.message ?? "處理失敗，請確認 YouTube 網址是否正確");
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-xl mx-auto space-y-3">
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="貼上 YouTube 網址，例如 https://youtu.be/..."
          disabled={loading}
          className="flex-1 px-4 py-3 rounded-xl bg-gray-900 border border-gray-700 text-white placeholder-gray-600 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-colors text-sm disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="px-6 py-3 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-gray-950 font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              處理中
            </span>
          ) : "開始學習"}
        </button>
      </form>

      {loading && stepText && (
        <p className="text-center text-sm text-gray-500 animate-pulse">{stepText}</p>
      )}
      {error && (
        <p className="text-red-400 text-sm text-center">{error}</p>
      )}
    </div>
  );
}

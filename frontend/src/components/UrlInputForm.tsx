"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function UrlInputForm() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    // 實際功能上線後會呼叫 processVideo(url)，這裡先導向 demo 頁
    setLoading(true);
    router.push("/demo");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 w-full max-w-xl mx-auto">
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="貼上 YouTube 網址，例如 https://youtu.be/..."
        className="flex-1 px-4 py-3 rounded-xl bg-gray-900 border border-gray-700 text-white placeholder-gray-600 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-colors text-sm"
      />
      <button
        type="submit"
        disabled={loading || !url.trim()}
        className="px-6 py-3 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-gray-950 font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
      >
        {loading ? "處理中…" : "開始學習"}
      </button>
    </form>
  );
}

"use client";

import { useState, useRef, useEffect } from "react";

// 示意用的靜態歌詞（帶 ruby 標籤的 HTML）
const DEMO_LYRICS = [
  { id: 1, html: "<ruby>輝<rt>かがや</rt></ruby>く<ruby>光<rt>ひかり</rt></ruby>の<ruby>中<rt>なか</rt></ruby>で", time: 0 },
  { id: 2, html: "ほら、<ruby>飛<rt>と</rt></ruby>べるよ<ruby>今<rt>いま</rt></ruby>こそ", time: 5 },
  { id: 3, html: "<ruby>風<rt>かぜ</rt></ruby>に<ruby>乗<rt>の</rt></ruby>って<ruby>高<rt>たか</rt></ruby>く<ruby>舞<rt>ま</rt></ruby>い<ruby>上<rt>あ</rt></ruby>がれ", time: 10 },
  { id: 4, html: "<ruby>残<rt>ざん</rt></ruby><ruby>酷<rt>こく</rt></ruby>な<ruby>天<rt>てん</rt></ruby><ruby>使<rt>し</rt></ruby>のテーゼ", time: 15 },
  { id: 5, html: "<ruby>窓<rt>まど</rt></ruby><ruby>辺<rt>べ</rt></ruby>から<ruby>やがて</ruby><ruby>旅<rt>たび</rt></ruby><ruby>立<rt>だ</rt></ruby>つ", time: 20 },
  { id: 6, html: "ほとばしる<ruby>熱<rt>あつ</rt></ruby>い<ruby>パトス<rt>ぱとす</rt></ruby>で", time: 25 },
  { id: 7, html: "<ruby>思<rt>おも</rt></ruby>い<ruby>出<rt>で</rt></ruby>を<ruby>裏<rt>うら</rt></ruby><ruby>切<rt>ぎ</rt></ruby>って", time: 30 },
  { id: 8, html: "<ruby>少<rt>しょう</rt></ruby><ruby>年<rt>ねん</rt></ruby>よ<ruby>神<rt>しん</rt></ruby><ruby>話<rt>わ</rt></ruby>になれ", time: 35 },
  { id: 9, html: "ドキドキしながら", time: 40 },
  { id: 10, html: "<ruby>生<rt>い</rt></ruby>きている<ruby>今<rt>いま</rt></ruby>を", time: 45 },
  { id: 11, html: "<ruby>全<rt>すべ</rt></ruby>てを<ruby>抱<rt>だ</rt></ruby>きしめて", time: 50 },
  { id: 12, html: "<ruby>夢<rt>ゆめ</rt></ruby>の<ruby>中<rt>なか</rt></ruby>で<ruby>踊<rt>おど</rt></ruby>ろう", time: 55 },
];

export default function DemoPlayer() {
  const [activeIndex, setActiveIndex] = useState(3);
  const [isEditing, setIsEditing] = useState(false);
  const lyricsRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLParagraphElement>(null);

  // 示意用：每 5 秒自動切換 active 歌詞
  useEffect(() => {
    if (isEditing) return;
    const timer = setInterval(() => {
      setActiveIndex((i) => (i + 1) % DEMO_LYRICS.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [isEditing]);

  // 自動捲動到 active 歌詞
  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeIndex]);

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
      {/* ── 左側：播放器 ── */}
      <div className="md:w-[45%] flex flex-col gap-4 p-4 md:p-6 shrink-0">
        {/* YouTube 播放器佔位 */}
        <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-gray-900 flex items-center justify-center border border-gray-800">
          <div className="text-center space-y-2 text-gray-600">
            <div className="text-5xl">▶</div>
            <p className="text-sm">YouTube 播放器</p>
            <p className="text-xs">（實際使用時嵌入影片）</p>
          </div>
          <div className="absolute bottom-3 left-3 right-3 h-1 bg-gray-800 rounded-full">
            <div className="h-full bg-yellow-400 rounded-full" style={{ width: "42%" }} />
          </div>
        </div>

        {/* 打點器說明 */}
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-300">時間軸打點模式</span>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                isEditing
                  ? "bg-yellow-400 text-gray-950"
                  : "border border-gray-700 text-gray-400 hover:border-yellow-600 hover:text-yellow-400"
              }`}
            >
              {isEditing ? "✓ 編輯中" : "開啟打點"}
            </button>
          </div>
          {isEditing && (
            <p className="text-xs text-gray-500 leading-relaxed">
              播放歌曲時，唱到每句的瞬間按下{" "}
              <kbd className="px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700 text-gray-300 font-mono">Space</kbd>{" "}
              即可打點，系統自動記錄時間戳。
            </p>
          )}
        </div>
      </div>

      {/* ── 右側：歌詞面板 ── */}
      <div
        ref={lyricsRef}
        className="lyrics-panel flex-1 overflow-y-auto p-4 md:p-6 border-t md:border-t-0 md:border-l border-gray-800"
      >
        <div className="max-w-lg mx-auto md:mx-0 space-y-1">
          {DEMO_LYRICS.map((line, i) => (
            <p
              key={line.id}
              ref={i === activeIndex ? activeRef : null}
              onClick={() => setActiveIndex(i)}
              className={`text-xl md:text-2xl leading-loose py-2 px-3 rounded-lg cursor-pointer transition-all duration-300 ${
                i === activeIndex
                  ? "lyric-active"
                  : "text-gray-500 hover:text-gray-300"
              }`}
              dangerouslySetInnerHTML={{ __html: line.html }}
            />
          ))}
        </div>

        <div className="mt-8 pt-6 border-t border-gray-800 text-xs text-gray-700 text-center space-y-1">
          <p>以上為示意歌詞（非真實版權內容）</p>
          <p>實際使用時歌詞由 AI 自動抓取並標注平假名</p>
        </div>
      </div>
    </div>
  );
}

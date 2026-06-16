import Link from "next/link";
import DemoPlayer from "@/components/DemoPlayer";

export default function DemoPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between shrink-0">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-bold tracking-tight text-white">
            SPlus <span className="text-yellow-400">がな</span>
          </span>
        </Link>
        <div className="flex items-center gap-3 text-sm text-gray-400">
          <span className="px-2 py-0.5 rounded bg-yellow-400/10 text-yellow-400 text-xs font-medium">Demo 模式</span>
          <Link href="/" className="hover:text-white transition-colors">返回首頁</Link>
        </div>
      </header>

      {/* 歌曲標題列 */}
      <div className="border-b border-gray-800 px-6 py-3 flex items-center gap-4">
        <img
          src="https://placehold.co/56x56/1e293b/facc15?text=♪"
          alt="thumbnail"
          className="w-14 h-14 rounded-lg object-cover"
        />
        <div>
          <h2 className="font-semibold text-white text-base leading-tight">
            <ruby>残<rt>ざん</rt></ruby><ruby>酷<rt>こく</rt></ruby>な<ruby>天<rt>てん</rt></ruby><ruby>使<rt>し</rt></ruby>のテーゼ（示意）
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">高橋洋子 · 3:36</p>
        </div>
        <button className="ml-auto px-4 py-1.5 rounded-full border border-gray-700 text-gray-400 hover:text-yellow-400 hover:border-yellow-600 text-sm transition-colors">
          ＋ 加入歌單
        </button>
      </div>

      {/* 主內容 */}
      <DemoPlayer />
    </div>
  );
}

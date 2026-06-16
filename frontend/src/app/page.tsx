import Link from "next/link";
import UrlInputForm from "@/components/UrlInputForm";

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold tracking-tight text-white">
            SPlus <span className="text-yellow-400">がな</span>
          </span>
        </div>
        <nav className="flex items-center gap-4 text-sm text-gray-400">
          <Link href="/demo" className="hover:text-white transition-colors">
            Demo
          </Link>
          <button className="px-4 py-1.5 rounded-full border border-gray-600 hover:border-gray-400 transition-colors text-gray-300 hover:text-white">
            登入
          </button>
        </nav>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center">
        <div className="max-w-2xl mx-auto space-y-8">
          <div className="space-y-4">
            <h1 className="text-5xl font-bold tracking-tight text-white leading-tight">
              日文歌詞，
              <br />
              <span className="text-yellow-400">一鍵</span>標上平假名
            </h1>
            <p className="text-lg text-gray-400 leading-relaxed">
              貼上 YouTube 日文歌曲連結，系統自動抓取歌詞、AI 標注讀音，
              <br />
              並與影片完美同步捲動。邊聽歌邊學日文。
            </p>
          </div>

          {/* URL Input */}
          <UrlInputForm />

          {/* Demo hint */}
          <p className="text-sm text-gray-600">
            沒有帳號也可以查詢 ·{" "}
            <Link href="/demo" className="text-yellow-500 hover:text-yellow-400 underline underline-offset-4">
              先看 Demo 效果
            </Link>
          </p>
        </div>
      </main>

      {/* Features */}
      <section className="border-t border-gray-800 py-16 px-6">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          <div className="space-y-2">
            <div className="text-3xl">🎵</div>
            <h3 className="font-semibold text-white">自動歌詞同步</h3>
            <p className="text-sm text-gray-500">歌詞跟著音樂捲動，當前句自動高亮</p>
          </div>
          <div className="space-y-2">
            <div className="text-3xl">📖</div>
            <h3 className="font-semibold text-white">AI 平假名標注</h3>
            <p className="text-sm text-gray-500">Gemini AI 為所有漢字標上讀音，不錯過任何生字</p>
          </div>
          <div className="space-y-2">
            <div className="text-3xl">📱</div>
            <h3 className="font-semibold text-white">手機電腦通用</h3>
            <p className="text-sm text-gray-500">響應式設計，手機上影片置頂固定不消失</p>
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-800 py-6 px-6 text-center text-xs text-gray-700">
        SPlus がな · 零成本日文歌詞學習系統
      </footer>
    </div>
  );
}

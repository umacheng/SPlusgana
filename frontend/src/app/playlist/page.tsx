import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import type { Song } from "@/types/database";

export default async function PlaylistPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const { data: playlists } = await supabase
    .from("playlists")
    .select("song_id, created_at, songs(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const songs = (playlists ?? []).map((p: any) => p.songs as Song).filter(Boolean);

  return (
    <div className="flex flex-col min-h-screen">
      <header className="border-b border-gray-800 px-6 py-4 flex items-center gap-4">
        <Link href="/" className="text-xl font-bold tracking-tight text-white">
          SPlus <span className="text-yellow-400">がな</span>
        </Link>
        <span className="text-gray-700">/</span>
        <h1 className="text-sm text-gray-400">我的歌單</h1>
      </header>

      <main className="flex-1 p-6">
        {songs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-24 space-y-4">
            <p className="text-4xl">🎵</p>
            <p className="text-gray-500">還沒有收藏任何歌曲</p>
            <Link
              href="/"
              className="px-5 py-2 rounded-full bg-yellow-400 text-gray-950 font-medium text-sm hover:bg-yellow-300 transition-colors"
            >
              去搜尋歌曲
            </Link>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            <p className="text-sm text-gray-500 mb-6">{songs.length} 首歌曲</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {songs.map((song) => (
                <Link
                  key={song.id}
                  href={`/song/${song.id}`}
                  className="flex items-center gap-3 p-3 rounded-xl border border-gray-800 hover:border-gray-600 bg-gray-900/30 hover:bg-gray-900/60 transition-all"
                >
                  <img
                    src={song.thumbnail_url}
                    alt={song.title}
                    className="w-16 h-12 rounded-lg object-cover shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{song.title}</p>
                    <p className="text-xs text-gray-500 truncate mt-0.5">{song.artist}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

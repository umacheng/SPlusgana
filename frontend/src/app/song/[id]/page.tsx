import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SongPlayer from "@/components/SongPlayer";
import Link from "next/link";
import type { Song, LyricLine } from "@/types/database";

export default async function SongPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const songId = Number(id);
  if (isNaN(songId)) notFound();

  const supabase = await createClient();

  const { data: song } = await supabase
    .from("songs")
    .select("*")
    .eq("id", songId)
    .single();

  if (!song) notFound();

  const { data: lyrics } = await supabase
    .from("lyrics_lines")
    .select("*")
    .eq("song_id", songId)
    .order("line_number");

  return (
    <div className="flex flex-col min-h-screen">
      <header className="border-b border-gray-800 px-6 py-4 flex items-center gap-4 shrink-0">
        <Link href="/" className="text-xl font-bold tracking-tight text-white">
          SPlus <span className="text-yellow-400">がな</span>
        </Link>
        <span className="text-gray-700">/</span>
        <h1 className="text-sm text-gray-400 truncate">{song.title}</h1>
      </header>
      <SongPlayer song={song as Song} lyrics={(lyrics ?? []) as LyricLine[]} />
    </div>
  );
}

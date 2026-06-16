export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          display_name: string
          avatar_url: string | null
          created_at: string
        }
        Insert: {
          id: string
          display_name: string
          avatar_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          display_name?: string
          avatar_url?: string | null
          created_at?: string
        }
      }
      songs: {
        Row: {
          id: number
          youtube_id: string
          title: string
          artist: string
          thumbnail_url: string
          duration: number
          source_url: string | null
          created_at: string
        }
        Insert: {
          youtube_id: string
          title: string
          artist: string
          thumbnail_url: string
          duration: number
          source_url?: string | null
          created_at?: string
        }
        Update: {
          youtube_id?: string
          title?: string
          artist?: string
          thumbnail_url?: string
          duration?: number
          source_url?: string | null
          created_at?: string
        }
      }
      lyrics_lines: {
        Row: {
          id: number
          song_id: number
          line_number: number
          time_marker: number
          raw_text: string
          html_text: string
        }
        Insert: {
          song_id: number
          line_number: number
          time_marker?: number
          raw_text: string
          html_text: string
        }
        Update: {
          song_id?: number
          line_number?: number
          time_marker?: number
          raw_text?: string
          html_text?: string
        }
      }
      playlists: {
        Row: {
          id: number
          user_id: string
          song_id: number
          created_at: string
        }
        Insert: {
          user_id: string
          song_id: number
          created_at?: string
        }
        Update: {
          user_id?: string
          song_id?: number
          created_at?: string
        }
      }
    }
  }
}

// 方便使用的型別快捷方式
export type User = Database['public']['Tables']['users']['Row']
export type Song = Database['public']['Tables']['songs']['Row']
export type LyricLine = Database['public']['Tables']['lyrics_lines']['Row']
export type Playlist = Database['public']['Tables']['playlists']['Row']

// 後端回傳的歌曲處理結果
export interface ProcessVideoResponse {
  song_id: number
  youtube_id: string
  title: string
  artist: string
  thumbnail_url: string
  duration: number
  source_url: string | null
  lyrics_lines: {
    line_number: number
    raw_text: string
    html_text: string
    time_marker: number
  }[]
}

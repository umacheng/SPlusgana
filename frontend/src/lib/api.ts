import type { ProcessVideoResponse } from '@/types/database'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message)
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }))
    throw new ApiError(body.detail ?? res.statusText, res.status)
  }

  return res.json()
}

// 提前喚醒 Render 後端（冷啟動 pre-warm）
export function pingBackend(): void {
  fetch(`${BACKEND_URL}/health`).catch(() => {})
}

// 提交 YouTube URL 讓後端處理（抓資訊 + 爬歌詞 + AI 標注）
export async function processVideo(youtubeUrl: string): Promise<ProcessVideoResponse> {
  return request<ProcessVideoResponse>('/api/process-video', {
    method: 'POST',
    body: JSON.stringify({ url: youtubeUrl }),
  })
}

// 手動提交歌詞文字重新標注
export async function annotateManualLyrics(
  songId: number,
  lyricsText: string
): Promise<{ lyrics_lines: ProcessVideoResponse['lyrics_lines'] }> {
  return request('/api/annotate-lyrics', {
    method: 'POST',
    body: JSON.stringify({ song_id: songId, lyrics_text: lyricsText }),
  })
}

// 手動提交歌詞網址讓後端重新爬取並標注
export async function refetchLyricsFromUrl(
  songId: number,
  lyricsUrl: string
): Promise<{ lyrics_lines: ProcessVideoResponse['lyrics_lines'] }> {
  return request('/api/refetch-lyrics', {
    method: 'POST',
    body: JSON.stringify({ song_id: songId, lyrics_url: lyricsUrl }),
  })
}

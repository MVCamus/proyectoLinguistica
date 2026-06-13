const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export interface ApiSegment {
  start: number
  end: number
  text: string
}

export interface ApiVideo {
  id: string
  url: string
  username: string | null
  description: string | null
  hashtags: string[] | null
  duration_sec: number | null
  status: string
  transcript_original: ApiSegment[] | null
  transcript_editada: ApiSegment[] | null
  drive_url: string | null
  error_message: string | null
  corpus_number: number | null
  shuffle_order: number | null
  created_at: string
  approved_at: string | null
}

interface ApiVideoList {
  videos: ApiVideo[]
  total: number
}

function apiSegmentToFrontend(seg: ApiSegment, index: number) {
  return {
    id: `seg-${index}`,
    startTime: seg.start,
    endTime: seg.end,
    text: seg.text,
  }
}

export function apiVideoToFrontend(v: ApiVideo) {
  const segments = (v.transcript_original || []).map(apiSegmentToFrontend)
  return {
    id: v.id,
    url: v.url,
    thumbnail: `https://picsum.photos/seed/${v.id}/320/480`,
    transcript: segments.map((s: { text: string }) => s.text).join(' '),
    segments,
    duration: v.duration_sec || 0,
    author: v.username || 'desconocido',
    likes: 0,
    description: v.description || '',
    hashtags: v.hashtags || [],
    status: v.status,
    corpus_number: v.corpus_number,
  }
}

export async function fetchVideos(
  status: string = 'listo_para_triage',
  limit: number = 20,
  offset: number = 0
) {
  const params = new URLSearchParams({ status, limit: String(limit), offset: String(offset) })
  const res = await fetch(`${API_BASE}/api/videos?${params}`)
  if (!res.ok) throw new Error(`Error ${res.status} al obtener videos`)
  const data: ApiVideoList = await res.json()
  return {
    videos: data.videos.map(apiVideoToFrontend),
    total: data.total,
    rawVideos: data.videos,
  }
}

export async function ingestarPool(
  hashtagsIncluir: string[],
  urlsManuales?: string[],
  hashtagsExcluir: string[] = []
) {
  const res = await fetch(`${API_BASE}/api/ingesta`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      hashtags_incluir: hashtagsIncluir,
      hashtags_excluir: hashtagsExcluir,
      urls_manuales: urlsManuales?.length ? urlsManuales : undefined,
    }),
  })
  if (!res.ok) throw new Error(`Error ${res.status} al ingestar`)
  return (await res.json()) as { total_candidatos: number; mensaje: string }
}

export async function approveVideo(videoId: string, transcriptEditada: ApiSegment[]) {
  const res = await fetch(`${API_BASE}/api/videos/${videoId}/aprobar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript_editada: transcriptEditada }),
  })
  if (!res.ok) throw new Error(`Error ${res.status} al aprobar`)
  return res.json()
}

export async function rejectVideo(videoId: string) {
  const res = await fetch(`${API_BASE}/api/videos/${videoId}/rechazar`, {
    method: 'POST',
  })
  if (!res.ok) throw new Error(`Error ${res.status} al rechazar`)
  return res.json()
}

export async function deleteVideo(videoId: string) {
  const res = await fetch(`${API_BASE}/api/videos/${videoId}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error(`Error ${res.status} al eliminar`)
  return res.json()
}

export async function fetchDriveSyncStatus() {
  const res = await fetch(`${API_BASE}/api/tasks/drive-sync-status`)
  if (!res.ok) throw new Error('Error al obtener estado de sincronización de Drive')
  return res.json() as Promise<{ active: boolean; current: number; total: number; message: string }>
}

export async function cancelarCola(videoId: string) {
  const res = await fetch(`${API_BASE}/api/videos/${videoId}/cancelar-cola`, {
    method: 'POST',
  })
  if (!res.ok) throw new Error(`Error ${res.status} al cancelar`)
  return res.json()
}

export async function reintentarVideo(videoId: string) {
  const res = await fetch(`${API_BASE}/api/videos/${videoId}/reintentar`, {
    method: 'POST',
  })
  if (!res.ok) throw new Error(`Error ${res.status} al reintentar`)
  return res.json()
}

export async function fetchOembed(url: string) {
  try {
    const res = await fetch(`${API_BASE}/api/oembed?url=${encodeURIComponent(url)}`, {
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    return (await res.json()) as { html: string }
  } catch {
    return null
  }
}

export async function fetchCorpusVideos() {
  return fetchVideos('aprobado', 400, 0)
}

export function getVideoFileUrl(videoId: string) {
  return `${API_BASE}/api/video-file/${videoId}`
}

export interface ProcessingItem {
  id: string
  url: string
  status: string  // 'pendiente' | 'descargando' | 'transcribiendo' | 'error'
  errorMessage?: string
}

export async function fetchProcessingQueue() {
  const res = await fetch(
    `${API_BASE}/api/videos?status=pendiente,descargando,transcribiendo,error&limit=50&offset=0`
  )
  if (!res.ok) throw new Error(`Error ${res.status} al obtener cola`)
  const data: ApiVideoList = await res.json()
  return {
    items: data.videos.map((v) => ({
      id: v.id,
      url: v.url,
      status: v.status,
      errorMessage: v.error_message,
    })),
    total: data.total,
  }
}

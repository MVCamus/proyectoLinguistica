export interface TranscriptSegment {
  id: string
  startTime: number
  endTime: number
  text: string
}

export interface Video {
  id: string
  url: string
  thumbnail: string
  transcript: string
  segments: TranscriptSegment[]
  duration: number
  author: string
  likes: number
  description: string
  hashtags: string[]
  status?: string
  corpus_number?: number | null
  dateAdded?: Date
}

export interface CorpusVideo extends Video {
  dateAdded: Date
  notes?: string
}

export type NavigationView = 'discovery' | 'corpus'

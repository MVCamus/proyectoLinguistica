'use client'

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { Check, X, Loader2 } from 'lucide-react'
import { Video, TranscriptSegment } from '@/lib/types'
import { Button } from '@/components/ui/button'

interface VideoCardProps {
  video: Video
  onApprove: (video: Video) => void
  onReject: (videoId: string) => void
}

const PRONOUNS = ['tú', 'vos', 'usted', 'ustedes', 'te', 'ti', 'contigo', 'os', 'les', 'le']

function highlightPronouns(text: string) {
  const regex = new RegExp(`\\b(${PRONOUNS.join('|')})\\b`, 'gi')
  const parts: (string | JSX.Element)[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    parts.push(
      <span key={match.index} className="bg-highlight text-highlight-foreground font-bold px-0.5 rounded">
        {match[0]}
      </span>
    )
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }
  return parts.length > 0 ? parts : text
}

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function VideoCard({ video, onApprove, onReject }: VideoCardProps) {
  const [segments, setSegments] = useState<TranscriptSegment[]>(video.segments)
  const initializedRef = useRef(false)
  const isProcessing = video.status === 'descargando' || video.status === 'transcribiendo' || video.status === 'pendiente'

  // Solo inicializar segments la primera vez que se monta el componente,
  // ignorar actualizaciones posteriores del polling para no perder ediciones
  useEffect(() => {
    if (!initializedRef.current) {
      setSegments(video.segments)
      initializedRef.current = true
    }
  }, [video.segments])

  const fullTranscript = useMemo(() => {
    return segments.map(s => s.text).join(' ')
  }, [segments])

  const handleSegmentEdit = useCallback((segmentId: string, newText: string) => {
    setSegments(prev => prev.map(seg =>
      seg.id === segmentId ? { ...seg, text: newText } : seg
    ))
  }, [])

  const handleApprove = useCallback(() => {
    onApprove({ ...video, transcript: fullTranscript, segments })
  }, [video, fullTranscript, segments, onApprove])

  if (isProcessing) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-card rounded-lg border border-border">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground font-mono">
          {video.author}
        </span>
        <span className="text-xs text-muted-foreground ml-auto">
          {video.status === 'descargando' ? 'Descargando...' :
           video.status === 'transcribiendo' ? 'Transcribiendo...' :
           'En cola...'}
        </span>
      </div>
    )
  }

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      {/* Header: username + description */}
      <div className="px-4 py-3 border-b border-border bg-secondary/30">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">
            {video.author}
          </span>
          <span className="text-xs text-muted-foreground">
            {video.duration > 0 && `${Math.floor(video.duration / 60)}:${String(Math.floor(video.duration % 60)).padStart(2, '0')}`}
          </span>
          <a
            href={video.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline ml-auto"
          >
            Ver en TikTok ↗
          </a>
        </div>
        {video.description && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {video.description}
          </p>
        )}
      </div>

      {/* Transcript segments */}
      <div className="p-3 max-h-[200px] overflow-y-auto">
        {segments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Sin transcripción
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            {segments.map((segment) => (
              <div
                key={segment.id}
                className="flex gap-2 p-2 rounded-md transition-colors group"
              >
                <span className="shrink-0 font-mono text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                  {formatTimestamp(segment.startTime)}
                </span>
                <textarea
                  className="flex-1 text-sm leading-relaxed bg-transparent border-none resize-none focus:outline-none focus:ring-1 focus:ring-primary/30 rounded p-0.5 min-h-[1.25rem]"
                  value={segment.text}
                  onChange={(e) => handleSegmentEdit(segment.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      e.currentTarget.blur()
                    }
                  }}
                  rows={1}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 p-3 border-t border-border bg-secondary/10">
        <Button
          onClick={handleApprove}
          variant="outline"
          size="sm"
          className="flex-1 bg-success/10 border-success/30 text-success hover:bg-success hover:text-success-foreground"
        >
          <Check className="h-4 w-4 mr-1.5" />
          Aprobar
        </Button>
        <Button
          onClick={() => onReject(video.id)}
          variant="outline"
          size="sm"
          className="flex-1 bg-destructive/10 border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground"
        >
          <X className="h-4 w-4 mr-1.5" />
          Rechazar
        </Button>
      </div>
    </div>
  )
}

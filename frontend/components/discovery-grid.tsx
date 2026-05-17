'use client'

import { useState, useCallback } from 'react'
import { Search, Hash, X, RefreshCw, Link, Loader2, Download, Mic, Clock, CheckCircle2, ListOrdered, Trash2 } from 'lucide-react'
import { Video } from '@/lib/types'
import { ProcessingItem } from '@/lib/api'
import { VideoCard } from '@/components/video-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

interface DiscoveryGridProps {
  videos: Video[]
  processingQueue: ProcessingItem[]
  onApprove: (video: Video) => void
  onReject: (videoId: string) => void
  onCancelQueue?: (videoId: string) => void
  onFetchVideos?: (hashtags: string[]) => void
  onSubmitUrls?: (urls: string[]) => void
  loading?: boolean
}

export function DiscoveryGrid({ videos, processingQueue, onApprove, onReject, onCancelQueue, onFetchVideos, onSubmitUrls, loading }: DiscoveryGridProps) {
  const [hashtagInput, setHashtagInput] = useState('')
  const [activeHashtags, setActiveHashtags] = useState<string[]>(['#storytime', '#vlog'])
  const [urlInput, setUrlInput] = useState('')
  const [showUrlInput, setShowUrlInput] = useState(false)

  const handleAddHashtag = useCallback(() => {
    if (!hashtagInput.trim()) return
    const tag = hashtagInput.trim().startsWith('#')
      ? hashtagInput.trim()
      : `#${hashtagInput.trim()}`
    if (!activeHashtags.includes(tag.toLowerCase())) {
      const newTags = [...activeHashtags, tag.toLowerCase()]
      setActiveHashtags(newTags)
      onFetchVideos?.(newTags)
    }
    setHashtagInput('')
  }, [hashtagInput, activeHashtags, onFetchVideos])

  const handleRemoveHashtag = useCallback((tag: string) => {
    const newTags = activeHashtags.filter(t => t !== tag)
    setActiveHashtags(newTags)
    onFetchVideos?.(newTags)
  }, [activeHashtags, onFetchVideos])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddHashtag()
    }
  }, [handleAddHashtag])

  const handleFetch = useCallback(() => {
    onFetchVideos?.(activeHashtags)
  }, [activeHashtags, onFetchVideos])

  const shortUrl = (url: string) => {
    try {
      const u = new URL(url)
      const parts = u.pathname.split('/')
      return '@' + (parts[parts.indexOf('video') - 1] || '...')
    } catch {
      return url.slice(0, 40)
    }
  }

  const pendientes = processingQueue.filter((i) => i.status === 'pendiente')
  const descargando = processingQueue.filter((i) => i.status === 'descargando')
  const transcribiendo = processingQueue.filter((i) => i.status === 'transcribiendo')

  const statusRow = (item: ProcessingItem) => {
    const icons: Record<string, { icon: JSX.Element; label: string; color: string }> = {
      pendiente: { icon: <Clock className="h-4 w-4" />, label: 'En cola', color: 'text-muted-foreground' },
      descargando: { icon: <Download className="h-4 w-4" />, label: 'Descargando...', color: 'text-blue-500' },
      transcribiendo: { icon: <Mic className="h-4 w-4" />, label: 'Transcribiendo...', color: 'text-yellow-500' },
    }
    const info = icons[item.status] || icons.pendiente
    return (
      <div key={item.id} className="flex items-center gap-3 px-3 py-2 rounded-md bg-secondary/30 border border-border/50 text-sm">
        <div className={info.color + ' animate-pulse'}>{info.icon}</div>
        <span className="flex-1 text-muted-foreground truncate font-mono text-xs">
          {shortUrl(item.url)}
        </span>
        <span className={`text-xs font-medium ${info.color}`}>{info.label}</span>
        <button
          onClick={() => onCancelQueue?.(item.id)}
          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive flex items-center justify-center rounded hover:bg-destructive/10 transition-colors"
          title="Cancelar"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto">
      {/* Search Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-6 py-4">
          <h1 className="text-xl font-semibold text-foreground">
            Transcripciones - Corpus Lingüístico
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Revisa y aprueba transcripciones para tu corpus de investigación
          </p>
        </div>

        <div className="px-6 pb-4 space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Agregar hashtag semilla (ej: storytime, vlog, español)"
                value={hashtagInput}
                onChange={(e) => setHashtagInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="pl-9 bg-secondary/50 border-border"
              />
            </div>
            <Button variant="secondary" onClick={handleAddHashtag} disabled={!hashtagInput.trim()}>
              <Search className="h-4 w-4 mr-2" />Agregar
            </Button>
            <Button variant="default" onClick={handleFetch} disabled={activeHashtags.length === 0}>
              <RefreshCw className="h-4 w-4 mr-2" />Buscar Videos
            </Button>
          </div>

          {activeHashtags.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground font-medium">Filtros activos:</span>
              {activeHashtags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => handleRemoveHashtag(tag)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
                >
                  {tag}
                  <X className="h-3 w-3" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Manual URL Input */}
      <div className="px-6 pb-4 pt-4">
        <button
          onClick={() => setShowUrlInput(!showUrlInput)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
        >
          <Link className="h-3 w-3" />
          {showUrlInput ? 'Ocultar' : 'Pegar URLs manuales de TikTok'}
        </button>
        {showUrlInput && (
          <div className="mt-2 space-y-2">
            <Textarea
              placeholder="Pegá las URLs de TikTok aquí (una por línea)"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className="bg-secondary/50 border-border text-sm min-h-[80px]"
            />
            <Button
              variant="secondary" size="sm"
              onClick={() => {
                const urls = urlInput.split('\n').map((u) => u.trim()).filter((u) => u.startsWith('http'))
                if (urls.length > 0) onSubmitUrls?.(urls)
              }}
              disabled={!urlInput.trim()}
            >
              <RefreshCw className="h-3 w-3 mr-1.5" />
              Procesar URLs ({urlInput.split('\n').filter((u) => u.trim().startsWith('http')).length})
            </Button>
          </div>
        )}
      </div>

      {/* Processing Queue */}
      {processingQueue.length > 0 && (
        <div className="px-6 pb-6">
          <div className="flex items-center gap-2 mb-3">
            <ListOrdered className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Procesando</h2>
            <span className="text-xs text-muted-foreground">({processingQueue.length} videos)</span>
          </div>
          <div className="space-y-2">
            {descargando.map((item) => (
              <div key={item.id}>
                {descargando.indexOf(item) === 0 && <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Download className="h-3 w-3 text-blue-500" /> Descargando audio ({descargando.length})</p>}
                {statusRow(item)}
              </div>
            ))}
            {transcribiendo.map((item) => (
              <div key={item.id}>
                {transcribiendo.indexOf(item) === 0 && <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Mic className="h-3 w-3 text-yellow-500" /> Transcribiendo ({transcribiendo.length})</p>}
                {statusRow(item)}
              </div>
            ))}
            {pendientes.map((item) => (
              <div key={item.id}>
                {pendientes.indexOf(item) === 0 && <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Clock className="h-3 w-3" /> En cola ({pendientes.length})</p>}
                {statusRow(item)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ready for Review */}
      <div className="px-6 pb-6">
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle2 className="h-5 w-5 text-green-500" />
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Listos para revisar</h2>
          <span className="text-xs text-muted-foreground">({videos.length} transcripciones)</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            <p className="text-lg">Cargando...</p>
          </div>
        ) : videos.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground border border-dashed border-border rounded-lg">
            <p className="text-lg">No hay transcripciones listas. Envía URLs desde la extensión de TikTok.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {videos.map((video) => (
              <VideoCard
                key={video.id}
                video={video}
                onApprove={onApprove}
                onReject={onReject}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

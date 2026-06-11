'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { AppSidebar } from '@/components/app-sidebar'
import { DiscoveryGrid } from '@/components/discovery-grid'
import { CorpusView } from '@/components/corpus-view'
import { NavigationView, Video, CorpusVideo } from '@/lib/types'
import { fetchVideos, approveVideo, rejectVideo, deleteVideo, ingestarPool, fetchCorpusVideos, fetchProcessingQueue, cancelarCola, reintentarVideo, ProcessingItem, apiVideoToFrontend } from '@/lib/api'
import { toast } from '@/hooks/use-toast'

export default function Home() {
  const [currentView, setCurrentView] = useState<NavigationView>('discovery')
  const [discoveryVideos, setDiscoveryVideos] = useState<Video[]>([])
  const [processingQueue, setProcessingQueue] = useState<ProcessingItem[]>([])
  const [corpus, setCorpus] = useState<CorpusVideo[]>([])
  const [loading, setLoading] = useState(true)
  const [corpusTotal, setCorpusTotal] = useState(0)
  const pollingRef = useRef<ReturnType<typeof setInterval>>()
  const failuresRef = useRef(0)
  const MAX_FAILURES = 10

  const totalTarget = 400

  const loadDiscoveryVideos = useCallback(async () => {
    try {
      const { videos } = await fetchVideos('listo_para_triage', 24, 0)
      setDiscoveryVideos(videos)
      failuresRef.current = 0
    } catch (err) {
      console.error('Error al obtener discovery videos:', err)
      failuresRef.current++
    } finally {
      setLoading(false)
    }
  }, [])

  const loadProcessingQueue = useCallback(async () => {
    try {
      const { items } = await fetchProcessingQueue()
      setProcessingQueue(items)
      failuresRef.current = 0
    } catch (err) {
      console.error('Error al obtener cola de procesamiento:', err)
      failuresRef.current++
    }
  }, [])

  const loadCorpus = useCallback(async () => {
    try {
      const { videos, total, rawVideos } = await fetchCorpusVideos()
      const corpusVideos: CorpusVideo[] = rawVideos.map((v) => {
        const frontend = apiVideoToFrontend(v)
        return {
          ...frontend,
          dateAdded: v.approved_at ? new Date(v.approved_at) : new Date(),
        }
      })
      setCorpus(corpusVideos)
      setCorpusTotal(total)
    } catch (err) {
      console.error('Error al obtener corpus:', err)
    }
  }, [])

  useEffect(() => {
    loadDiscoveryVideos()
    loadProcessingQueue()
    loadCorpus()
    pollingRef.current = setInterval(() => {
      if (failuresRef.current >= MAX_FAILURES) {
        console.warn(`Polling detenido tras ${MAX_FAILURES} fallos consecutivos`)
        clearInterval(pollingRef.current)
        pollingRef.current = undefined
        return
      }
      loadDiscoveryVideos()
      loadProcessingQueue()
    }, 15000)
    return () => clearInterval(pollingRef.current)
  }, [loadDiscoveryVideos, loadProcessingQueue, loadCorpus])

  useEffect(() => {
    if (currentView === 'corpus') {
      loadCorpus()
    }
  }, [currentView, loadCorpus])

  const handleApprove = useCallback(async (video: Video) => {
    const editada = video.segments.map((seg, i) => ({
      start: seg.startTime,
      end: seg.endTime,
      text: seg.text,
    }))
    try {
      const resp = await approveVideo(video.id, editada)
      setDiscoveryVideos((prev) => prev.filter((v) => v.id !== video.id))
      setCorpusTotal((prev) => prev + 1)
      setCorpus((prev) => [
        ...prev,
        { ...video, dateAdded: new Date() },
      ])
      toast({ title: 'Video aprobado', description: 'La transcripción se agregó al corpus' })
    } catch (err) {
      console.error('Error al aprobar:', err)
      toast({ title: 'Error al aprobar', description: String(err), variant: 'destructive' })
    }
  }, [])

  const handleReject = useCallback(async (videoId: string) => {
    try {
      await rejectVideo(videoId)
      setDiscoveryVideos((prev) => prev.filter((v) => v.id !== videoId))
      toast({ title: 'Video rechazado', description: 'El video fue eliminado del pool' })
    } catch (err) {
      console.error('Error al rechazar:', err)
      toast({ title: 'Error al rechazar', description: String(err), variant: 'destructive' })
    }
  }, [])

  const handleRemoveFromCorpus = useCallback(async (videoId: string) => {
    try {
      await deleteVideo(videoId)
      setCorpus((prev) => prev.filter((v) => v.id !== videoId))
      setCorpusTotal((prev) => Math.max(0, prev - 1))
      toast({ title: 'Video eliminado', description: 'El video se eliminó del corpus' })
    } catch (err) {
      console.error('Error al eliminar video:', err)
      toast({ title: 'Error al eliminar', description: String(err), variant: 'destructive' })
    }
  }, [])

  const handleFetchVideos = useCallback(async (hashtags: string[]) => {
    try {
      setLoading(true)
      const incluir = hashtags.map((t) => t.replace(/^#/, ''))
      await ingestarPool(incluir)
      setTimeout(() => {
        loadDiscoveryVideos()
        loadProcessingQueue()
      }, 1000)
    } catch (err) {
      console.error('Error al ingestar:', err)
      setLoading(false)
      toast({ title: 'Error al buscar videos', description: String(err), variant: 'destructive' })
    }
  }, [loadDiscoveryVideos, loadProcessingQueue])

  const handleCancelQueue = useCallback(async (videoId: string) => {
    try {
      await cancelarCola(videoId)
      setProcessingQueue((prev) => prev.filter((i) => i.id !== videoId))
    } catch (err) {
      console.error('Error al cancelar:', err)
      toast({ title: 'Error al cancelar', description: String(err), variant: 'destructive' })
    }
  }, [])

  const handleReintentar = useCallback(async (videoId: string) => {
    try {
      await reintentarVideo(videoId)
      setProcessingQueue((prev) =>
        prev.map((i) => (i.id === videoId ? { ...i, status: 'pendiente' } : i))
      )
    } catch (err) {
      console.error('Error al reintentar:', err)
      toast({ title: 'Error al reintentar', description: String(err), variant: 'destructive' })
    }
  }, [])

  const handleSubmitUrls = useCallback(async (urls: string[]) => {
    try {
      setLoading(true)
      await ingestarPool([], urls)
      setTimeout(() => {
        loadDiscoveryVideos()
        loadProcessingQueue()
      }, 1000)
    } catch (err) {
      console.error('Error al procesar URLs:', err)
      setLoading(false)
      toast({ title: 'Error al procesar URLs', description: String(err), variant: 'destructive' })
    }
  }, [loadDiscoveryVideos, loadProcessingQueue])

  return (
    <div className="flex h-screen bg-background">
      <AppSidebar
        currentView={currentView}
        onViewChange={setCurrentView}
        totalTarget={totalTarget}
        currentProgress={corpusTotal}
      />

      <main className="flex-1 flex flex-col overflow-hidden">
        {currentView === 'discovery' ? (
          <DiscoveryGrid
            videos={discoveryVideos}
            processingQueue={processingQueue}
            onApprove={handleApprove}
            onReject={handleReject}
            onCancelQueue={handleCancelQueue}
            onReintentar={handleReintentar}
            onFetchVideos={handleFetchVideos}
            onSubmitUrls={handleSubmitUrls}
            loading={loading}
          />
        ) : (
          <CorpusView
            corpus={corpus}
            onRemove={handleRemoveFromCorpus}
          />
        )}
      </main>
    </div>
  )
}

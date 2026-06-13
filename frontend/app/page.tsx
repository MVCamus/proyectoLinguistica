'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { AppSidebar } from '@/components/app-sidebar'
import { DiscoveryGrid } from '@/components/discovery-grid'
import { CorpusView } from '@/components/corpus-view'
import { NavigationView, Video, CorpusVideo } from '@/lib/types'
import { fetchVideos, approveVideo, rejectVideo, deleteVideo, ingestarPool, fetchCorpusVideos, fetchProcessingQueue, cancelarCola, reintentarVideo, ProcessingItem, apiVideoToFrontend, fetchDriveSyncStatus } from '@/lib/api'
import { toast } from '@/hooks/use-toast'

export default function Home() {
  const [currentView, setCurrentView] = useState<NavigationView>('discovery')
  const [discoveryVideos, setDiscoveryVideos] = useState<Video[]>([])
  const [processingQueue, setProcessingQueue] = useState<ProcessingItem[]>([])
  const [corpus, setCorpus] = useState<CorpusVideo[]>([])
  const [loading, setLoading] = useState(true)
  const [corpusTotal, setCorpusTotal] = useState(0)
  const [driveSyncStatus, setDriveSyncStatus] = useState<{ active: boolean; current: number; total: number; message: string } | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval>>()
  const failuresRef = useRef(0)
  const MAX_FAILURES = 10

  const totalTarget = 400

  // Polling para el estado de sincronización de Drive en segundo plano
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined

    const checkStatus = async () => {
      try {
        const status = await fetchDriveSyncStatus()
        setDriveSyncStatus(status)
        if (!status.active && interval) {
          clearInterval(interval)
          interval = undefined
        }
      } catch (err) {
        console.error('Error al obtener estado de Drive:', err)
      }
    }

    if (driveSyncStatus?.active) {
      interval = setInterval(checkStatus, 1500)
    } else {
      interval = setInterval(checkStatus, 10000)
    }

    checkStatus()

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [driveSyncStatus?.active])

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
      toast({ title: 'Video eliminado', description: 'El video se eliminó del corpus. Sincronizando en segundo plano...' })
      setDriveSyncStatus({
        active: true,
        current: 0,
        total: 1,
        message: 'Iniciando sincronización con Google Drive...'
      })
    } catch (err) {
      console.error('Error al eliminar video:', err)
      toast({ title: 'Error al eliminar', description: String(err), variant: 'destructive' })
    }
  }, [])


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
        {/* Banner de Sincronización de Drive */}
        {driveSyncStatus?.active && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-3 animate-in fade-in slide-in-from-top-2 duration-300 shrink-0">
            <div className="max-w-4xl flex items-center justify-between gap-6">
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between text-xs font-semibold text-amber-500 mb-1.5">
                  <span className="truncate">{driveSyncStatus.message}</span>
                  <span className="tabular-nums shrink-0 ml-2">
                    {driveSyncStatus.current} / {driveSyncStatus.total} ({Math.round((driveSyncStatus.current / (driveSyncStatus.total || 1)) * 100)}%)
                  </span>
                </div>
                <div className="w-full bg-amber-500/20 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-amber-500 h-1.5 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${(driveSyncStatus.current / (driveSyncStatus.total || 1)) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {currentView === 'discovery' ? (
          <DiscoveryGrid
            videos={discoveryVideos}
            processingQueue={processingQueue}
            onApprove={handleApprove}
            onReject={handleReject}
            onCancelQueue={handleCancelQueue}
            onReintentar={handleReintentar}
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

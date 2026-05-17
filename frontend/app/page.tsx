'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { AppSidebar } from '@/components/app-sidebar'
import { DiscoveryGrid } from '@/components/discovery-grid'
import { CorpusView } from '@/components/corpus-view'
import { NavigationView, Video, CorpusVideo } from '@/lib/types'
import { fetchVideos, approveVideo, rejectVideo, deleteVideo, ingestarPool, fetchCorpusVideos, fetchProcessingQueue, cancelarCola, ProcessingItem } from '@/lib/api'

export default function Home() {
  const [currentView, setCurrentView] = useState<NavigationView>('discovery')
  const [discoveryVideos, setDiscoveryVideos] = useState<Video[]>([])
  const [processingQueue, setProcessingQueue] = useState<ProcessingItem[]>([])
  const [corpus, setCorpus] = useState<CorpusVideo[]>([])
  const [loading, setLoading] = useState(true)
  const [corpusTotal, setCorpusTotal] = useState(0)
  const pollingRef = useRef<ReturnType<typeof setInterval>>()

  const totalTarget = 400

  const loadDiscoveryVideos = useCallback(async () => {
    try {
      const { videos } = await fetchVideos('listo_para_triage', 24, 0)
      setDiscoveryVideos(videos)
    } catch {
      // silently fail, retry on next poll
    } finally {
      setLoading(false)
    }
  }, [])

  const loadProcessingQueue = useCallback(async () => {
    try {
      const { items } = await fetchProcessingQueue()
      setProcessingQueue(items)
    } catch {
      // silently fail
    }
  }, [])

  const loadCorpus = useCallback(async () => {
    try {
      const { videos, total } = await fetchCorpusVideos()
      const corpusVideos: CorpusVideo[] = videos.map((v) => ({
        ...v,
        dateAdded: new Date(),
      }))
      setCorpus(corpusVideos)
      setCorpusTotal(total)
    } catch {
      // silently fail
    }
  }, [])

  useEffect(() => {
    loadDiscoveryVideos()
    loadProcessingQueue()
    loadCorpus()
    pollingRef.current = setInterval(() => {
      loadDiscoveryVideos()
      loadProcessingQueue()
    }, 3000)
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
      await approveVideo(video.id, editada)
      setDiscoveryVideos((prev) => prev.filter((v) => v.id !== video.id))
      setCorpusTotal((prev) => prev + 1)
      setCorpus((prev) => [
        ...prev,
        { ...video, dateAdded: new Date() },
      ])
    } catch (err) {
      console.error('Error al aprobar:', err)
    }
  }, [])

  const handleReject = useCallback(async (videoId: string) => {
    try {
      await rejectVideo(videoId)
      setDiscoveryVideos((prev) => prev.filter((v) => v.id !== videoId))
    } catch (err) {
      console.error('Error al rechazar:', err)
    }
  }, [])

  const handleRemoveFromCorpus = useCallback(async (videoId: string) => {
    try {
      await deleteVideo(videoId)
      setCorpus((prev) => prev.filter((v) => v.id !== videoId))
      setCorpusTotal((prev) => Math.max(0, prev - 1))
    } catch (err) {
      console.error('Error al eliminar video:', err)
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
    }
  }, [loadDiscoveryVideos, loadProcessingQueue])

  const handleCancelQueue = useCallback(async (videoId: string) => {
    try {
      await cancelarCola(videoId)
      setProcessingQueue((prev) => prev.filter((i) => i.id !== videoId))
    } catch (err) {
      console.error('Error al cancelar:', err)
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

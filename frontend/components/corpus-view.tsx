'use client'

import { useState, useMemo } from 'react'
import { Search, Download, Cloud, Trash2, Hash } from 'lucide-react'
import { CorpusVideo } from '@/lib/types'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog'
import { toast } from '@/hooks/use-toast'

// Spanish 2nd person pronouns to highlight
const PRONOUNS = ['tú', 'vos', 'usted', 'ustedes', 'te', 'ti', 'contigo', 'os', 'les', 'le']

function highlightPronouns(text: string, searchTerm: string) {
  // Combine pronouns and search term for highlighting
  const terms = [...PRONOUNS]
  if (searchTerm) {
    terms.push(searchTerm)
  }
  
  const escaped = terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const regex = new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi')
  const parts = text.split(regex)

  return parts.map((part, i) => {
    const isPronoun = PRONOUNS.some((p) => p.toLowerCase() === part.toLowerCase())
    const isSearchMatch = searchTerm && part.toLowerCase() === searchTerm.toLowerCase()
    
    if (isPronoun) {
      return (
        <span key={i} className="bg-highlight text-highlight-foreground font-bold px-0.5 rounded">
          {part}
        </span>
      )
    }
    if (isSearchMatch) {
      return (
        <span key={i} className="bg-primary/30 text-foreground font-semibold px-0.5 rounded">
          {part}
        </span>
      )
    }
    return part
  })
}

interface CorpusViewProps {
  corpus: CorpusVideo[]
  onRemove: (videoId: string) => void
}

export function CorpusView({ corpus, onRemove }: CorpusViewProps) {
  const [searchTerm, setSearchTerm] = useState('')

  const filteredCorpus = useMemo(() => {
    const sorted = [...corpus].sort((a, b) => (a.corpus_number ?? 0) - (b.corpus_number ?? 0))
    if (!searchTerm) return sorted
    const lower = searchTerm.toLowerCase()
    return sorted.filter(
      (video) =>
        video.transcript.toLowerCase().includes(lower) ||
        video.author.toLowerCase().includes(lower)
    )
  }, [corpus, searchTerm])

  const handleExportCSV = () => {
    const headers = ['#', 'video_id', 'url', 'username', 'description', 'hashtags', 'transcript', 'duration_sec', 'date_added']
    const rows = corpus.map((v, i) => [
      v.corpus_number ?? i + 1,
      v.id,
      v.url,
      v.author,
      `"${(v.description || '').replace(/"/g, '""')}"`,
      `"${(v.hashtags || []).join(';')}"`,
      `"${v.transcript.replace(/"/g, '""')}"`,
      v.duration,
      v.dateAdded.toISOString(),
    ])
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv; charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'corpus-export.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleSyncDrive = () => {
    toast({
      title: 'Google Drive Sync',
      description: 'La sincronización se ejecuta automáticamente al aprobar cada video',
    })
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Selected Corpus</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {corpus.length} videos aprobados
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleSyncDrive}>
              <Cloud className="h-4 w-4 mr-1.5" />
              Sync to Drive
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Download className="h-4 w-4 mr-1.5" />
              Download CSV
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar en transcripciones (ej: usted, tú, vos...)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {filteredCorpus.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            {corpus.length === 0 ? (
              <>
                <p className="text-lg font-medium">No hay videos en el corpus</p>
                <p className="text-sm mt-1">Aprueba videos desde Discovery & Triage</p>
              </>
            ) : (
              <>
                <p className="text-lg font-medium">Sin resultados</p>
                <p className="text-sm mt-1">No se encontraron videos con {`"${searchTerm}"`}</p>
              </>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="w-[50px] text-center">#</TableHead>
                <TableHead className="w-[120px]">Author</TableHead>
                <TableHead>Transcripción</TableHead>
                <TableHead className="w-[80px] text-right">Duración</TableHead>
                <TableHead className="w-[100px] text-right">Fecha</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCorpus.map((video, idx) => (
                <TableRow key={video.id} className="border-border">
                  <TableCell className="text-center font-mono text-sm font-bold text-foreground">
                    {video.corpus_number ?? idx + 1}
                  </TableCell>
                  <TableCell className="font-medium text-sm">
                    {video.author}
                  </TableCell>
                  <TableCell className="text-sm leading-relaxed whitespace-normal max-w-md">
                    {highlightPronouns(video.transcript, searchTerm)}
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {video.duration}s
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {video.dateAdded.toLocaleDateString('es-ES', {
                      day: '2-digit',
                      month: 'short',
                    })}
                  </TableCell>
                  <TableCell>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Eliminar video #{video.corpus_number ?? ''}</AlertDialogTitle>
                          <AlertDialogDescription>
                            ¿Estás segura de que quieres eliminar este video del corpus?<br />
                            Se borrará la transcripción local y la carpeta en Drive.
                            Los videos siguientes se renumerarán automáticamente.
                            Esta acción no se puede deshacer.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>
                            Cancelar
                          </AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => onRemove(video.id)}
                          >
                            Eliminar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}

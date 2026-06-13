'use client'

import { useState, useMemo } from 'react'
import { Search, Trash2 } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface CorpusViewProps {
  corpus: CorpusVideo[]
  onRemove: (videoId: string) => void
}

export function CorpusView({ corpus, onRemove }: CorpusViewProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [sortOption, setSortOption] = useState('corpus_asc')

  const filteredCorpus = useMemo(() => {
    // 1. Filtrar los videos según el término de búsqueda
    let result = [...corpus]
    if (searchTerm) {
      const lower = searchTerm.toLowerCase()
      const searchNum = Number(lower.trim())
      const isNumericSearch = !isNaN(searchNum) && lower.trim() !== ''

      if (isNumericSearch) {
        result = result.filter((video) => video.corpus_number === searchNum)
      } else {
        result = result.filter(
          (video) =>
            video.transcript.toLowerCase().includes(lower) ||
            video.author.toLowerCase().includes(lower) ||
            (lower.length >= 5 && video.id.toLowerCase().includes(lower))
        )
      }
    }

    // 2. Ordenar según el criterio seleccionado
    result.sort((a, b) => {
      switch (sortOption) {
        case 'corpus_desc':
          return (b.corpus_number ?? 0) - (a.corpus_number ?? 0)
        case 'date_desc':
          return new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime()
        case 'date_asc':
          return new Date(a.dateAdded).getTime() - new Date(b.dateAdded).getTime()
        case 'duration_desc':
          return (b.duration ?? 0) - (a.duration ?? 0)
        case 'duration_asc':
          return (a.duration ?? 0) - (b.duration ?? 0)
        case 'author_asc':
          return (a.author || '').localeCompare(b.author || '')
        case 'author_desc':
          return (b.author || '').localeCompare(a.author || '')
        case 'corpus_asc':
        default:
          return (a.corpus_number ?? 0) - (b.corpus_number ?? 0)
      }
    })

    return result
  }, [corpus, searchTerm, sortOption])

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
        </div>

        {/* Search & Sort Dropdown */}
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por ID de video, transcripción o usuario..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="w-[280px] shrink-0">
            <Select value={sortOption} onValueChange={setSortOption}>
              <SelectTrigger className="bg-secondary/50 border-border">
                <SelectValue placeholder="Ordenar por..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="corpus_asc">Corpus # (Menor a Mayor)</SelectItem>
                <SelectItem value="corpus_desc">Corpus # (Mayor a Menor)</SelectItem>
                <SelectItem value="date_desc">Fecha Aprobación (Más reciente primero)</SelectItem>
                <SelectItem value="date_asc">Fecha Aprobación (Más antiguo primero)</SelectItem>
                <SelectItem value="duration_desc">Duración (Mayor a Menor)</SelectItem>
                <SelectItem value="duration_asc">Duración (Menor a Mayor)</SelectItem>
                <SelectItem value="author_asc">Usuario (A-Z)</SelectItem>
                <SelectItem value="author_desc">Usuario (Z-A)</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
                    {video.transcript}
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

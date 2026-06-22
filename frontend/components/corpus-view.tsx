'use client'

import { useState, useMemo } from 'react'
import { Search, Trash2, RefreshCw, X, CheckCircle2, ArrowLeftRight } from 'lucide-react'
import { CorpusVideo } from '@/lib/types'
import { CorpusVerifyResult } from '@/lib/api'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

interface CorpusViewProps {
  corpus: CorpusVideo[]
  onRemove: (videoId: string) => void
  onSyncTxt: () => void
  syncStatus: { active: boolean; current: number; total: number; message: string; created: number; ok: number; deleted: number } | null
  onDismissSync: () => void
  onVerifyTxt: () => Promise<CorpusVerifyResult>
  onFixNumbering: () => void
  fixNumberingStatus: { active: boolean; current: number; total: number; message: string; renumbered: number; deleted_drive: number } | null
  onDismissFixNumbering: () => void
  onSyncDrive: () => void
  syncDriveStatus: { active: boolean; current: number; total: number; message: string; renamed: number; deleted: number; moved: number } | null
  onDismissSyncDrive: () => void
}

export function CorpusView({ corpus, onRemove, onSyncTxt, syncStatus, onDismissSync, onVerifyTxt, onFixNumbering, fixNumberingStatus, onDismissFixNumbering, onSyncDrive, syncDriveStatus, onDismissSyncDrive }: CorpusViewProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [sortOption, setSortOption] = useState('corpus_asc')
  const [verifyResult, setVerifyResult] = useState<CorpusVerifyResult | null>(null)
  const [verifyOpen, setVerifyOpen] = useState(false)
  const [verifying, setVerifying] = useState(false)

  const filteredCorpus = useMemo(() => {
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

  const percent = syncStatus && syncStatus.total > 0
    ? Math.round((syncStatus.current / syncStatus.total) * 100)
    : 0

  const percentFix = fixNumberingStatus && fixNumberingStatus.total > 0
    ? Math.round((fixNumberingStatus.current / fixNumberingStatus.total) * 100)
    : 0

  const percentDrive = syncDriveStatus && syncDriveStatus.total > 0
    ? Math.round((syncDriveStatus.current / syncDriveStatus.total) * 100)
    : 0

  const handleVerify = async () => {
    setVerifying(true)
    try {
      const result = await onVerifyTxt()
      setVerifyResult(result)
      setVerifyOpen(true)
    } catch {
    } finally {
      setVerifying(false)
    }
  }

  const hasIssues = verifyResult && (!verifyResult.ok)

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
            <Button
              variant="outline"
              size="sm"
              onClick={handleVerify}
              disabled={verifying || syncStatus?.active}
              className="gap-2"
            >
              <CheckCircle2 className="h-4 w-4" />
              Verificar TXT
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onSyncTxt}
              disabled={syncStatus?.active}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${syncStatus?.active ? 'animate-spin' : ''}`} />
              Sincronizar TXT
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onFixNumbering}
              disabled={fixNumberingStatus?.active || syncStatus?.active}
              className="gap-2"
            >
              <ArrowLeftRight className={`h-4 w-4 ${fixNumberingStatus?.active ? 'animate-spin' : ''}`} />
              Corregir Numeración
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onSyncDrive}
              disabled={syncDriveStatus?.active || syncStatus?.active}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${syncDriveStatus?.active ? 'animate-spin' : ''}`} />
              Sincronizar Drive
            </Button>
          </div>
        </div>

        {/* Sync Progress Banner */}
        {syncStatus?.active && (
          <div className="mb-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-3 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-emerald-600 truncate flex-1">
                {syncStatus.message}
              </span>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                <span className="text-xs tabular-nums text-emerald-600 font-medium">
                  {syncStatus.current} / {syncStatus.total} ({percent}%)
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-emerald-600 hover:text-emerald-700"
                  onClick={onDismissSync}
                  disabled
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div className="w-full bg-emerald-500/20 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        )}

        {/* Completed Sync Banner */}
        {syncStatus && !syncStatus.active && (
          <div className="mb-3 bg-blue-500/10 border border-blue-500/20 rounded-lg px-4 py-3 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-blue-600 truncate flex-1">
                {syncStatus.message}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-blue-600 hover:text-blue-700 shrink-0 ml-3"
                onClick={onDismissSync}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* Fix Numbering Progress Banner */}
        {fixNumberingStatus?.active && (
          <div className="mb-3 bg-violet-500/10 border border-violet-500/20 rounded-lg px-4 py-3 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-violet-600 truncate flex-1">
                {fixNumberingStatus.message}
              </span>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                <span className="text-xs tabular-nums text-violet-600 font-medium">
                  {fixNumberingStatus.current} / {fixNumberingStatus.total} ({percentFix}%)
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-violet-600 hover:text-violet-700"
                  onClick={onDismissFixNumbering}
                  disabled
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div className="w-full bg-violet-500/20 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-violet-500 h-1.5 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${percentFix}%` }}
              />
            </div>
          </div>
        )}

        {/* Completed Fix Numbering Banner */}
        {fixNumberingStatus && !fixNumberingStatus.active && (
          <div className="mb-3 bg-blue-500/10 border border-blue-500/20 rounded-lg px-4 py-3 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-blue-600 truncate flex-1">
                {fixNumberingStatus.message}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-blue-600 hover:text-blue-700 shrink-0 ml-3"
                onClick={onDismissFixNumbering}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* Sync Drive Progress Banner */}
        {syncDriveStatus?.active && (
          <div className="mb-3 bg-violet-500/10 border border-violet-500/20 rounded-lg px-4 py-3 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-violet-600 truncate flex-1">
                {syncDriveStatus.message}
              </span>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                <span className="text-xs tabular-nums text-violet-600 font-medium">
                  {syncDriveStatus.current} / {syncDriveStatus.total} ({percentDrive}%)
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-violet-600 hover:text-violet-700"
                  onClick={onDismissSyncDrive}
                  disabled
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div className="w-full bg-violet-500/20 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-violet-500 h-1.5 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${percentDrive}%` }}
              />
            </div>
          </div>
        )}

        {/* Completed Sync Drive Banner */}
        {syncDriveStatus && !syncDriveStatus.active && (
          <div className="mb-3 bg-blue-500/10 border border-blue-500/20 rounded-lg px-4 py-3 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-blue-600 truncate flex-1">
                {syncDriveStatus.message}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-blue-600 hover:text-blue-700 shrink-0 ml-3"
                onClick={onDismissSyncDrive}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

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

      {/* Verify Dialog */}
      <Dialog open={verifyOpen} onOpenChange={setVerifyOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {verifyResult?.ok ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              ) : (
                <X className="h-5 w-5 text-destructive" />
              )}
              Verificación del Corpus
            </DialogTitle>
            <DialogDescription>
              {verifyResult?.ok
                ? `Todo correcto: ${verifyResult.total_aprobados} aprobados en DB, ${verifyResult.total_txt} archivos .txt.`
                : `Se encontraron ${(verifyResult?.missing.length ?? 0) + (verifyResult?.orphans.length ?? 0) + (verifyResult?.duplicates.length ?? 0)} problemas.`}
            </DialogDescription>
          </DialogHeader>

          {verifyResult && (
            <div className="space-y-4 mt-2">
              {verifyResult.missing.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-amber-600 mb-1.5">
                    Faltantes ({verifyResult.missing.length})
                  </p>
                  <div className="bg-amber-500/10 rounded-md p-2 max-h-32 overflow-auto">
                    {verifyResult.missing.slice(0, 10).map((m) => (
                      <p key={m.corpus_number} className="text-xs text-amber-700 font-mono">
                        #{m.corpus_number} → {m.expected_file}
                      </p>
                    ))}
                    {verifyResult.missing.length > 10 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        ...y {verifyResult.missing.length - 10} más
                      </p>
                    )}
                  </div>
                </div>
              )}

              {verifyResult.duplicates.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-orange-600 mb-1.5">
                    Duplicados ({verifyResult.duplicates.length})
                  </p>
                  <div className="bg-orange-500/10 rounded-md p-2 max-h-32 overflow-auto">
                    {verifyResult.duplicates.map((d) => (
                      <p key={d.file} className="text-xs text-orange-700 font-mono">
                        {d.file} → esperado: {d.expected}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {verifyResult.orphans.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-red-600 mb-1.5">
                    Huérfanos ({verifyResult.orphans.length})
                  </p>
                  <div className="bg-red-500/10 rounded-md p-2 max-h-32 overflow-auto">
                    {verifyResult.orphans.slice(0, 10).map((o) => (
                      <p key={o} className="text-xs text-red-700 font-mono">{o}</p>
                    ))}
                    {verifyResult.orphans.length > 10 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        ...y {verifyResult.orphans.length - 10} más
                      </p>
                    )}
                  </div>
                </div>
              )}

              {verifyResult.ok && (
                <div className="flex items-center justify-center py-4">
                  <p className="text-sm text-emerald-600 font-medium">
                    No hay archivos faltantes, duplicados ni huérfanos.
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

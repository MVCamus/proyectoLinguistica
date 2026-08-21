'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  fetchDriveAuthStatus,
  startDriveOAuth,
  uploadDriveClientSecret,
  setDriveClientKeys,
  setDriveFolder,
  disconnectDrive,
  DriveStatus,
} from '@/lib/api'
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  FolderSync,
  LogOut,
  Upload,
  Sparkles,
  ExternalLink,
  KeyRound,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

interface DriveModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onStatusUpdated?: (status: DriveStatus) => void
}

export function DriveModal({ open, onOpenChange, onStatusUpdated }: DriveModalProps) {
  const [status, setStatus] = useState<DriveStatus | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [folderInput, setFolderInput] = useState<string>('')
  const [clientIdInput, setClientIdInput] = useState<string>('')
  const [clientSecretInput, setClientSecretInput] = useState<string>('')
  const [showConfigKeys, setShowConfigKeys] = useState<boolean>(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const loadStatus = async () => {
    try {
      setLoading(true)
      const data = await fetchDriveAuthStatus()
      setStatus(data)
      setFolderInput(data.folder_id || '')
      onStatusUpdated?.(data)
    } catch {
      setStatus(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      setMsg(null)
      loadStatus()
    }
  }, [open])

  const cleanedFolderId = useMemo(() => {
    if (!folderInput) return ''
    const val = folderInput.trim()
    const match = val.match(/folders\/([a-zA-Z0-9_-]+)/)
    if (match) return match[1]
    return val.split('?')[0].split('#')[0].trim()
  }, [folderInput])

  const handleStartOAuth = async () => {
    try {
      setActionLoading('oauth')
      setMsg(null)
      await startDriveOAuth()
      setMsg({ type: 'success', text: '¡Sesión iniciada con éxito en Google Drive!' })
      await loadStatus()
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Error al conectar con Google'
      setMsg({ type: 'error', text: errMsg })
      if (errMsg.includes('gdrive_client_id.json')) {
        setShowConfigKeys(true)
      }
    } finally {
      setActionLoading(null)
    }
  }

  const handleUploadCredentials = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      setActionLoading('upload')
      setMsg(null)
      await uploadDriveClientSecret(file)
      setMsg({ type: 'success', text: 'Archivo JSON guardado con éxito. Ahora presiona "Iniciar sesión con Google".' })
      setShowConfigKeys(false)
      await loadStatus()
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Error al subir archivo'
      setMsg({ type: 'error', text: errMsg })
    } finally {
      setActionLoading(null)
    }
  }

  const handleSaveClientKeys = async () => {
    if (!clientIdInput.trim() || !clientSecretInput.trim()) {
      setMsg({ type: 'error', text: 'Debes ingresar el ID de cliente y el Secreto de cliente' })
      return
    }
    try {
      setActionLoading('save_keys')
      setMsg(null)
      await setDriveClientKeys(clientIdInput, clientSecretInput)
      setMsg({ type: 'success', text: 'Credenciales guardadas. Ahora presiona "Iniciar sesión con Google".' })
      setShowConfigKeys(false)
      await loadStatus()
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Error al guardar credenciales'
      setMsg({ type: 'error', text: errMsg })
    } finally {
      setActionLoading(null)
    }
  }

  const handleSaveFolder = async () => {
    if (!cleanedFolderId) return
    try {
      setActionLoading('folder')
      setMsg(null)
      await setDriveFolder(cleanedFolderId)
      setMsg({ type: 'success', text: 'Carpeta de Google Drive configurada correctamente' })
      await loadStatus()
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Error al guardar carpeta'
      setMsg({ type: 'error', text: errMsg })
    } finally {
      setActionLoading(null)
    }
  }

  const handleDisconnect = async () => {
    try {
      setActionLoading('disconnect')
      setMsg(null)
      await disconnectDrive()
      setMsg({ type: 'success', text: 'Cuenta de Google Drive desconectada.' })
      await loadStatus()
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Error al desconectar'
      setMsg({ type: 'error', text: errMsg })
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <FolderSync className="h-5 w-5 text-primary" />
            Configuración de Google Drive
          </DialogTitle>
          <DialogDescription>
            Conecta tu cuenta de Google Drive para respaldar automáticamente las transcripciones, videos y metadata.
          </DialogDescription>
        </DialogHeader>

        {msg && (
          <div
            className={`p-3 rounded-md text-xs flex items-center gap-2 border ${
              msg.type === 'success'
                ? 'bg-green-500/10 text-green-500 border-green-500/20'
                : 'bg-destructive/10 text-destructive border-destructive/20'
            }`}
          >
            {msg.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span>{msg.text}</span>
          </div>
        )}

        <div className="flex flex-col gap-5 py-2">
          <div className="p-4 rounded-lg border border-border bg-secondary/20 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold text-foreground">1. Cuenta de Google Drive</Label>
              {status?.connected && (
                <span className="text-[11px] font-semibold text-green-500 bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20">
                  Conectada
                </span>
              )}
            </div>

            {loading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                Verificando estado de la cuenta...
              </div>
            ) : status?.connected ? (
              <div className="flex items-center justify-between gap-2 p-2.5 rounded-md bg-green-500/10 border border-green-500/20">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-green-500">Conectado exitosamente</span>
                    <span className="text-xs text-muted-foreground font-mono">{status.email || status.display_name || 'Cuenta Google activa'}</span>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDisconnect}
                  disabled={actionLoading === 'disconnect'}
                  className="h-7 text-xs text-destructive hover:bg-destructive/10 border-destructive/30"
                >
                  {actionLoading === 'disconnect' ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <>
                      <LogOut className="h-3 w-3 mr-1" />
                      Desconectar
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-muted-foreground">
                  Presiona el botón para abrir la pantalla de Google y autorizar el acceso a tu Drive con tu correo.
                </p>
                <Button
                  type="button"
                  onClick={handleStartOAuth}
                  disabled={actionLoading === 'oauth'}
                  className="w-full bg-white hover:bg-zinc-100 text-zinc-900 border border-zinc-300 font-semibold text-xs shadow-sm h-10 flex items-center justify-center gap-2"
                >
                  {actionLoading === 'oauth' ? (
                    <Loader2 className="h-4 w-4 animate-spin text-zinc-900" />
                  ) : (
                    <svg className="h-4 w-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                  )}
                  Iniciar sesión con Google
                </Button>

                <div className="pt-1 border-t border-border/50">
                  <button
                    type="button"
                    onClick={() => setShowConfigKeys(!showConfigKeys)}
                    className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 font-medium transition-colors"
                  >
                    <KeyRound className="h-3 w-3" />
                    <span>¿Necesitas cambiar o cargar credenciales OAuth?</span>
                    {showConfigKeys ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>

                  {showConfigKeys && (
                    <div className="flex flex-col gap-2.5 mt-2.5 p-3 rounded-md bg-secondary/40 border border-border text-xs">
                      <p className="text-[11px] text-muted-foreground">
                        Sube el archivo JSON descargado de Google Cloud o copia y pega tus claves:
                      </p>
                      
                      <div className="flex items-center gap-2">
                        <label className="cursor-pointer flex-1">
                          <input
                            type="file"
                            accept=".json"
                            onChange={handleUploadCredentials}
                            className="hidden"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            asChild
                            className="w-full text-xs h-8"
                            disabled={actionLoading === 'upload'}
                          >
                            <span>
                              {actionLoading === 'upload' ? (
                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                              ) : (
                                <Upload className="h-3 w-3 mr-1" />
                              )}
                              Subir archivo JSON
                            </span>
                          </Button>
                        </label>
                      </div>

                      <div className="flex flex-col gap-1.5 pt-1">
                        <Label htmlFor="client-id" className="text-[11px] text-muted-foreground">O pega el ID de cliente:</Label>
                        <Input
                          id="client-id"
                          placeholder="ej. 451754727032-...apps.googleusercontent.com"
                          value={clientIdInput}
                          onChange={(e) => setClientIdInput(e.target.value)}
                          className="text-xs font-mono h-8"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="client-secret" className="text-[11px] text-muted-foreground">Secreto de cliente:</Label>
                        <Input
                          id="client-secret"
                          type="password"
                          placeholder="ej. GOCSPX-..."
                          value={clientSecretInput}
                          onChange={(e) => setClientSecretInput(e.target.value)}
                          className="text-xs font-mono h-8"
                        />
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleSaveClientKeys}
                        disabled={actionLoading === 'save_keys'}
                        className="text-xs h-8"
                      >
                        {actionLoading === 'save_keys' ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : (
                          'Guardar claves'
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="p-4 rounded-lg border border-border bg-secondary/20 flex flex-col gap-3">
            <Label htmlFor="folder-link" className="text-sm font-semibold text-foreground">
              2. Carpeta de Google Drive
            </Label>
            <p className="text-xs text-muted-foreground">
              Pega el enlace completo de la carpeta de Drive o su ID. El sistema limpiará y extraerá el ID automáticamente.
            </p>

            <div className="flex gap-2">
              <Input
                id="folder-link"
                placeholder="https://drive.google.com/drive/folders/1w8ZyD9HQOyedfLp..."
                value={folderInput}
                onChange={(e) => setFolderInput(e.target.value)}
                className="text-xs font-mono"
              />
              <Button
                size="sm"
                onClick={handleSaveFolder}
                disabled={!cleanedFolderId || actionLoading === 'folder'}
                className="text-xs shrink-0"
              >
                {actionLoading === 'folder' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                ) : (
                  'Guardar'
                )}
              </Button>
            </div>

            {cleanedFolderId && (
              <div className="flex items-center gap-1.5 p-2 rounded bg-primary/10 border border-primary/20 text-xs">
                <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="text-muted-foreground">ID extraído:</span>
                <span className="font-mono font-semibold text-foreground truncate">{cleanedFolderId}</span>
                <a
                  href={`https://drive.google.com/drive/folders/${cleanedFolderId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto text-primary hover:underline flex items-center gap-0.5 shrink-0"
                >
                  Abrir <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="sm:justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

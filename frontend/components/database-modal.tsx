'use client'

import React, { useState, useEffect } from 'react'
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
  fetchDatabaseStatus,
  configureDatabase,
  DatabaseStatus,
} from '@/lib/api'
import {
  Database,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  Sparkles,
} from 'lucide-react'

interface DatabaseModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onStatusUpdated?: (status: DatabaseStatus) => void
}

export function DatabaseModal({ open, onOpenChange, onStatusUpdated }: DatabaseModalProps) {
  const [status, setStatus] = useState<DatabaseStatus | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [saving, setSaving] = useState<boolean>(false)
  const [urlInput, setUrlInput] = useState<string>('')
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const loadStatus = async () => {
    try {
      setLoading(true)
      const data = await fetchDatabaseStatus()
      setStatus(data)
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

  const handleConnect = async () => {
    if (!urlInput.trim()) {
      setMsg({ type: 'error', text: 'Debes ingresar la URL de conexión de Supabase' })
      return
    }
    try {
      setSaving(true)
      setMsg(null)
      const res = await configureDatabase(urlInput)
      setMsg({
        type: 'success',
        text: `¡Conexión exitosa! Tablas creadas/verificadas. Total videos: ${res.total_videos || 0}`,
      })
      setUrlInput('')
      await loadStatus()
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Error al conectar con la base de datos'
      setMsg({ type: 'error', text: errMsg })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Database className="h-5 w-5 text-primary" />
            Configuración de Base de Datos (Supabase)
          </DialogTitle>
          <DialogDescription>
            Conecta tu propio proyecto de Supabase / PostgreSQL para almacenar el corpus, videos y transcripciones.
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

        <div className="flex flex-col gap-4 py-2">
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Verificando conexión con Supabase...
            </div>
          ) : status?.connected ? (
            <div className="flex items-center justify-between gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-green-500">Supabase Conectado</span>
                  <span className="text-[11px] text-muted-foreground font-mono truncate max-w-[320px]">
                    {status.host || 'Base de datos activa'}
                  </span>
                  <span className="text-[10px] text-green-600 dark:text-green-400 mt-0.5">
                    {status.total_videos} videos en la base de datos
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-500">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>Base de datos no conectada. Ingresa tu URL de Supabase para comenzar.</span>
            </div>
          )}

          <div className="p-4 rounded-lg border border-border bg-secondary/20 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="supabase-url" className="text-xs font-semibold text-foreground">
                {status?.connected ? 'Cambiar URL de conexión de Supabase:' : 'URL de conexión (Connection String - URI):'}
              </Label>
              <a
                href="https://supabase.com/dashboard"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-primary hover:underline flex items-center gap-1"
              >
                Panel de Supabase <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            <Input
              id="supabase-url"
              type="password"
              placeholder="postgresql://postgres.xxx:password@aws-0-xx.pooler.supabase.com:6543/postgres"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className="text-xs font-mono"
            />

            <div className="flex items-center justify-between pt-1">
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-primary" />
                Se creará la tabla <code>videos</code> automáticamente.
              </p>
              <Button
                type="button"
                size="sm"
                onClick={handleConnect}
                disabled={!urlInput.trim() || saving}
                className="text-xs"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                    Probando conexión...
                  </>
                ) : (
                  '🔌 Probar y Conectar'
                )}
              </Button>
            </div>
          </div>

          <div className="p-3 rounded-md bg-secondary/30 border border-border text-[11px] text-muted-foreground flex flex-col gap-1">
            <span className="font-semibold text-foreground">¿Dónde encuentro esta URL en Supabase?</span>
            <span>1. Entra a tu proyecto en <strong>Supabase Dashboard</strong>.</span>
            <span>2. Ve a <strong>Project Settings ⚙️</strong> (abajo a la izquierda) &rarr; <strong>Database</strong>.</span>
            <span>3. En la sección <strong>Connection String</strong>, copia la pestaña <strong>URI</strong> (o Connection Pooling) y reemplaza <code>[YOUR-PASSWORD]</code> con tu contraseña.</span>
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

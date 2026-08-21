'use client'

import { useState, useEffect } from 'react'
import { FolderSearch, Library, Target, FolderSync, CheckCircle2, AlertCircle, Database } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NavigationView } from '@/lib/types'
import { DriveModal } from '@/components/drive-modal'
import { DatabaseModal } from '@/components/database-modal'
import { fetchDriveAuthStatus, DriveStatus, fetchDatabaseStatus, DatabaseStatus } from '@/lib/api'

interface AppSidebarProps {
  currentView: NavigationView
  onViewChange: (view: NavigationView) => void
  corpusTotal: number
}

export function AppSidebar({
  currentView,
  onViewChange,
  corpusTotal,
}: AppSidebarProps) {
  const [driveModalOpen, setDriveModalOpen] = useState(false)
  const [driveStatus, setDriveStatus] = useState<DriveStatus | null>(null)
  const [dbModalOpen, setDbModalOpen] = useState(false)
  const [dbStatus, setDbStatus] = useState<DatabaseStatus | null>(null)

  useEffect(() => {
    fetchDriveAuthStatus()
      .then((data) => setDriveStatus(data))
      .catch(() => setDriveStatus(null))

    fetchDatabaseStatus()
      .then((data) => setDbStatus(data))
      .catch(() => setDbStatus(null))
  }, [])

  return (
    <>
      <aside className="flex h-screen w-64 flex-col bg-sidebar border-r border-sidebar-border">
        <div className="flex items-center gap-3 px-4 py-6 border-b border-sidebar-border">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Target className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-sidebar-foreground">TikTok Scraping</span>
            <span className="text-xs text-muted-foreground">Corpus & Analysis</span>
          </div>
        </div>

        <div className="px-4 py-5 border-b border-sidebar-border">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
            Videos en Corpus
          </p>
          <p className="text-lg font-semibold text-sidebar-foreground">
            {corpusTotal}
          </p>
        </div>

        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          <div className="mb-2">
            <p className="px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
              Navigation
            </p>
          </div>
          <button
            onClick={() => onViewChange('discovery')}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              currentView === 'discovery'
                ? 'bg-sidebar-accent text-sidebar-primary'
                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
            )}
          >
            <FolderSearch className="h-4 w-4" />
            Discovery & Triage
          </button>
          <button
            onClick={() => onViewChange('corpus')}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              currentView === 'corpus'
                ? 'bg-sidebar-accent text-sidebar-primary'
                : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
            )}
          >
            <Library className="h-4 w-4" />
            Selected Corpus
          </button>

          <div className="mt-6 mb-2">
            <p className="px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
              Configuración & Conexiones
            </p>
          </div>
          <button
            onClick={() => setDbModalOpen(true)}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs font-medium transition-all bg-secondary/40 hover:bg-secondary border border-border/50 text-sidebar-foreground"
          >
            <Database className="h-4 w-4 text-primary shrink-0" />
            <div className="flex flex-col items-start text-left truncate flex-1">
              <span className="font-semibold truncate">Base de Datos</span>
              <span className="text-[10px] text-muted-foreground truncate">
                {dbStatus?.connected ? 'Supabase Conectado' : 'No configurada'}
              </span>
            </div>
            {dbStatus?.connected ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
            ) : (
              <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            )}
          </button>

          <button
            onClick={() => setDriveModalOpen(true)}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs font-medium transition-all bg-secondary/40 hover:bg-secondary border border-border/50 text-sidebar-foreground mt-1"
          >
            <FolderSync className="h-4 w-4 text-primary shrink-0" />
            <div className="flex flex-col items-start text-left truncate flex-1">
              <span className="font-semibold truncate">Google Drive</span>
              <span className="text-[10px] text-muted-foreground truncate">
                {driveStatus?.connected
                  ? (driveStatus.email || 'Conectado')
                  : 'No conectado'}
              </span>
            </div>
            {driveStatus?.connected ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
            ) : (
              <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            )}
          </button>
        </nav>

        <div className="px-4 py-3 border-t border-sidebar-border">
          <p className="text-xs text-muted-foreground text-center">
            2nd Person Analysis Tool
          </p>
        </div>
      </aside>

      <DriveModal
        open={driveModalOpen}
        onOpenChange={setDriveModalOpen}
        onStatusUpdated={(st) => setDriveStatus(st)}
      />

      <DatabaseModal
        open={dbModalOpen}
        onOpenChange={setDbModalOpen}
        onStatusUpdated={(st) => setDbStatus(st)}
      />
    </>
  )
}

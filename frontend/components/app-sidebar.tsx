'use client'

import { FolderSearch, Library, Target } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NavigationView } from '@/lib/types'

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

  return (
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

      <nav className="flex-1 px-3 py-4">
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
            'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors mt-1',
            currentView === 'corpus'
              ? 'bg-sidebar-accent text-sidebar-primary'
              : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
          )}
        >
          <Library className="h-4 w-4" />
          Selected Corpus
        </button>
      </nav>

      <div className="px-4 py-3 border-t border-sidebar-border">
        <p className="text-xs text-muted-foreground text-center">
          2nd Person Analysis Tool
        </p>
      </div>
    </aside>
  )
}

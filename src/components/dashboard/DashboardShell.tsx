'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Sparkles, Archive, CreditCard, Share2, Menu, X } from 'lucide-react'

interface ShellProps {
  children: React.ReactNode
  userEmail: string
  userName: string
  creditsBalance: number
  vaultCount: number
}

export function DashboardShell({
  children,
  userEmail,
  userName,
  creditsBalance,
  vaultCount
}: ShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const pathname = usePathname()

  const navItems = [
    { name: 'Generador AI', href: '/dashboard', icon: Sparkles },
    { name: 'Bóveda de Contenido', href: '/dashboard/history', icon: Archive },
    { name: 'Canales Conectados', href: '/dashboard/integrations', icon: Share2 },
    { name: 'Créditos y Facturación', href: '/dashboard/billing', icon: CreditCard },
  ]

  const initial = (userName || userEmail || 'B').charAt(0).toUpperCase()

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 overflow-hidden font-sans">
      
      {/* 1. NAVBAR MÓVIL (Visible únicamente en < md) */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-16 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800/80 flex items-center justify-between px-4 z-40">
        <Link className="flex items-center gap-1.5" href="/dashboard">
          <h1 className="text-xl font-black text-white tracking-wider">
            BLITZR <span className="text-blue-500">IA</span>
          </h1>
        </Link>
        <button
          type="button"
          onClick={() => setIsSidebarOpen(true)}
          className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-900 transition-colors"
          aria-label="Abrir menú"
        >
          <Menu className="w-6 h-6" />
        </button>
      </header>

      {/* 2. OVERLAY OSCURO (Para cerrar al tocar fuera en móvil) */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 md:hidden animate-in fade-in duration-200"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* 3. SIDEBAR / DRAWER */}
      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-50 w-72 bg-zinc-950 border-r border-zinc-800/80 flex flex-col justify-between p-6 flex-shrink-0
          transform transition-transform duration-300 ease-in-out
          ${isSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'}
        `}
      >
        <div>
          {/* Header de la marca */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-black text-white tracking-wider">
                BLITZR <span className="text-blue-500">IA</span>
              </h1>
              <p className="text-[11px] font-medium text-zinc-500 tracking-wide mt-0.5">
                Enciende tu alcance
              </p>
            </div>
            {/* Botón X de cierre solo en móvil */}
            <button
              type="button"
              onClick={() => setIsSidebarOpen(false)}
              className="md:hidden p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-900 transition-colors"
              aria-label="Cerrar menú"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navegación */}
          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const isActive = pathname === item.href
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-blue-600/15 text-blue-400 border border-blue-500/20 shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-zinc-500'}`} />
                  {item.name}
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Footer: Perfil y Contadores */}
        <div className="space-y-3 pt-6 border-t border-zinc-900">
          <div className="flex items-center gap-3 p-2.5 bg-zinc-900/60 border border-zinc-800/80 rounded-xl">
            <div className="w-9 h-9 rounded-full bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-bold text-sm flex-shrink-0">
              {initial}
            </div>
            <div className="overflow-hidden min-w-0">
              <p className="text-xs font-semibold text-zinc-200 truncate capitalize">
                {userName || 'Usuario Blitzr'}
              </p>
              <p className="text-[11px] text-zinc-500 truncate">{userEmail}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-xl p-2.5 text-center">
              <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider mb-0.5">Bóveda</p>
              <p className="text-lg font-bold text-zinc-200">{vaultCount}</p>
            </div>
            <div className="bg-emerald-950/20 border border-emerald-900/40 rounded-xl p-2.5 text-center">
              <p className="text-[9px] text-emerald-500 font-bold uppercase tracking-wider mb-0.5">Créditos AI</p>
              <p className="text-lg font-bold text-emerald-400">{creditsBalance}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* 4. CONTENIDO PRINCIPAL */}
      <main className="flex-1 overflow-y-auto bg-zinc-950 pt-20 md:pt-10 p-4 md:p-10">
        <div className="max-w-5xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}

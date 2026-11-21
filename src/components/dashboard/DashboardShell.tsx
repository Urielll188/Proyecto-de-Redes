'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Sparkles,
  Archive,
  CreditCard,
  Share2,
  X,
  Crosshair,
  Bot,
  Truck,
  RefreshCw,
  Camera,
  Menu,
} from 'lucide-react'
import { CinematicWarpTransition } from '@/components/transitions/CinematicWarpTransition'
import { NichoProvider, OWNER_EMAIL_MALLAS } from '@/context/NichoContext'

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
  vaultCount,
}: ShellProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [showArrivalWarp, setShowArrivalWarp] = useState(false)
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pathname = usePathname()
  const isRootDashboard = pathname === '/dashboard'

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && sessionStorage.getItem('blitzr_transition_warp') === 'true') {
        setShowArrivalWarp(true)
        sessionStorage.removeItem('blitzr_transition_warp')
      }
    } catch {
      // ignore
    }
  }, [])

  // Auto-close on route change
  useEffect(() => {
    setIsDrawerOpen(false)
  }, [pathname])

  // ESC key listener to close drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsDrawerOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleMouseEnter = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }
    setIsDrawerOpen(true)
  }

  const handleMouseLeave = () => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current)
    closeTimeoutRef.current = setTimeout(() => {
      setIsDrawerOpen(false)
    }, 280) // 280ms grace period debounce
  }

  const navItems = [
    { name: 'Generador AI', href: '/dashboard', icon: Sparkles },
    { name: 'Bóveda de Contenido', href: '/dashboard/history', icon: Archive },
    { name: 'Canales Conectados', href: '/dashboard/integrations', icon: Share2 },
    { name: 'Créditos y Facturación', href: '/dashboard/billing', icon: CreditCard },
  ]

  const vpsModuleItems = [
    { name: '1. Cazador DENUE/Maps', href: '/dashboard/cazador', icon: Crosshair },
    { name: '2. Ventas IA (Cerradora)', href: '/dashboard/ventas-ia', icon: Bot },
    { name: '3. Logística y Comisiones', href: '/dashboard/logistica', icon: Truck },
    { name: '4. Seguimiento VIP', href: '/dashboard/seguimiento', icon: RefreshCw },
    { name: '5. Mkt Realista', href: '/dashboard/marketing-realista', icon: Camera },
  ]

  const initial = (userName || userEmail || 'B').charAt(0).toUpperCase()

  return (
    <div className="relative w-full h-screen bg-[#050507] text-zinc-100 overflow-hidden font-sans select-none">
      
      {/* ================= 1. ZONA SENSIBLE TRIGGER STRIP (BORDE IZQUIERDO) ================= */}
      <div
        className="fixed inset-y-0 left-0 w-5 z-50 flex items-center justify-start cursor-pointer pointer-events-auto"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={() => setIsDrawerOpen((prev) => !prev)}
        aria-label="Abrir menú de navegación"
      >
        <div
          className={`w-[3px] h-24 my-auto rounded-r-full bg-gradient-to-b from-cyan-400 via-purple-500 to-emerald-400 transition-all duration-300 ${
            isDrawerOpen
              ? 'opacity-0 scale-y-75'
              : 'opacity-60 hover:opacity-100 hover:scale-y-110 shadow-[0_0_12px_rgba(34,211,238,0.5)]'
          }`}
        />
      </div>

      {/* ================= 1.1 BOTÓN DE MARCA / MENÚ HAMBURGUESA (SUPERIOR IZQUIERDO) ================= */}
      <button
        type="button"
        onClick={() => setIsDrawerOpen((prev) => !prev)}
        className="fixed top-4 left-4 lg:top-6 lg:left-8 z-40 flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/[0.04] hover:bg-white/[0.08] backdrop-blur-xl border border-white/10 transition-all cursor-pointer pointer-events-auto shadow-[0_4px_24px_rgba(0,0,0,0.4)] group"
        aria-label="Abrir menú de navegación"
      >
        <Menu className="w-4 h-4 text-zinc-300 group-hover:text-white transition-colors" />
        <span className="font-bold text-sm tracking-wider text-white">
          BLITZR
        </span>
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow-[0_0_8px_rgba(34,211,238,0.3)]">
          IA
        </span>
      </button>

      {/* Overlay backdrop en móvil para cerrar drawer */}
      {isDrawerOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ================= 2. DRAWER MAGNÉTICO FLOTANTE ================= */}
      <motion.aside
        initial={false}
        animate={{ x: isDrawerOpen ? 0 : -320 }}
        transition={{ type: 'spring', damping: 26, stiffness: 240 }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="fixed inset-y-0 left-0 z-50 w-72 md:w-80 bg-[#09090d]/90 backdrop-blur-2xl border-r border-white/10 shadow-[20px_0_50px_rgba(0,0,0,0.8)] flex flex-col justify-between p-6 pointer-events-auto"
      >
        <div className="flex-1 overflow-y-auto pr-1">
          {/* Header de la marca */}
          <div className="flex items-center justify-between mb-6">
            <Link
              href="/dashboard"
              onClick={() => setIsDrawerOpen(false)}
              className="group"
            >
              <h1 className="text-2xl font-black text-white tracking-wider flex items-center gap-1.5">
                BLITZR{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 group-hover:from-cyan-300 group-hover:to-blue-400 transition-all">
                  IA
                </span>
              </h1>
              <p className="text-[11px] font-medium text-zinc-500 tracking-wide mt-0.5">
                Enciende tu alcance
              </p>
            </Link>
            <button
              type="button"
              onClick={() => setIsDrawerOpen(false)}
              className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
              aria-label="Cerrar menú"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navegación Principal */}
          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href === '/dashboard/integrations' && pathname === '/dashboard/channels')
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsDrawerOpen(false)}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-zinc-500'}`} />
                  {item.name}
                </Link>
              )
            })}
          </nav>

          {/* Separador Módulos VPS */}
          <div className="mt-6 pt-5 border-t border-white/10">
            <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              {(userEmail || '').toLowerCase().trim() === OWNER_EMAIL_MALLAS
                ? 'Módulos VPS Tlaxcalli'
                : 'Módulos Operativos IA'}
            </p>
            <nav className="space-y-1">
              {vpsModuleItems.map((item) => {
                const isActive = pathname === item.href
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsDrawerOpen(false)}
                    className={`flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-zinc-500'}`} />
                    {item.name}
                  </Link>
                )
              })}
            </nav>
          </div>
        </div>

        {/* Footer: Perfil en Drawer */}
        <div className="space-y-3 pt-6 border-t border-white/10">
          <div className="flex items-center gap-3 p-2.5 bg-white/[0.03] border border-white/10 rounded-xl">
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
        </div>
      </motion.aside>

      {/* ================= 3. WIDGET FLOTANTE SUPERIOR DERECHO ================= */}
      <div className="fixed top-6 right-6 z-40 flex items-center gap-3 px-4 py-2 rounded-full bg-white/[0.04] backdrop-blur-xl border border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.4)] pointer-events-auto">
        {/* Indicador de Bóveda */}
        <Link
          href="/dashboard/history"
          className="flex items-center gap-1.5 text-xs text-zinc-300 hover:text-white transition-colors"
          title="Bóveda de Contenido"
        >
          <Archive className="w-3.5 h-3.5 text-zinc-400" />
          <span className="font-semibold text-zinc-200">{vaultCount}</span>
        </Link>

        {/* Divisor vertical */}
        <div className="w-[1px] h-3.5 bg-white/15" />

        {/* Créditos AI */}
        <Link
          href="/dashboard/billing"
          className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 font-semibold transition-colors"
          title="Créditos y Facturación"
        >
          <span>{creditsBalance}</span>
          <span className="text-emerald-400">⚡</span>
        </Link>

        {/* Divisor vertical */}
        <div className="w-[1px] h-3.5 bg-white/15" />

        {/* Avatar y Nombre */}
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 text-white flex items-center justify-center font-bold text-xs ring-1 ring-white/20">
            {initial}
          </div>
          <span className="text-xs font-medium text-zinc-200 hidden sm:inline max-w-[120px] truncate">
            {userName}
          </span>
        </div>
      </div>

      {/* Transición cinemática */}
      <CinematicWarpTransition
        active={showArrivalWarp}
        mode="arrival"
        durationMs={850}
        onComplete={() => setShowArrivalWarp(false)}
      />

      {/* ================= 4. CONTENIDO PRINCIPAL ================= */}
      <NichoProvider userEmail={userEmail}>
        <main
          className={`w-full h-full relative transition-all duration-700 ${
            showArrivalWarp ? 'opacity-90 scale-[0.98]' : 'opacity-100 scale-100'
          } ${
            isRootDashboard
              ? 'overflow-y-auto overflow-x-hidden lg:overflow-hidden'
              : 'overflow-y-auto pt-24 pb-12 px-4 md:px-8 max-w-6xl mx-auto'
          }`}
        >
          {children}
        </main>
      </NichoProvider>
    </div>
  )
}

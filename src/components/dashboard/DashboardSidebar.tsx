'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Sparkles, Archive, CreditCard, Share2 } from 'lucide-react'

interface SidebarProps {
  userEmail: string
  userName: string
  creditsBalance: number
  vaultCount: number
}

export function DashboardSidebar({ userEmail, userName, creditsBalance, vaultCount }: SidebarProps) {
  const pathname = usePathname()

  const navItems = [
    { name: 'Generador AI', href: '/dashboard', icon: Sparkles },
    { name: 'Bóveda de Contenido', href: '/dashboard/history', icon: Archive },
    { name: 'Canales Conectados', href: '/dashboard/integrations', icon: Share2 },
    { name: 'Créditos y Facturación', href: '/dashboard/billing', icon: CreditCard },
  ]

  const initial = (userName || userEmail || 'B').charAt(0).toUpperCase()

  return (
    <aside className="hidden md:flex w-72 bg-zinc-950 border-r border-zinc-800/80 flex-col justify-between p-6 flex-shrink-0 min-h-screen">
      {/* 1. Header & Brand */}
      <div>
        <div className="mb-8">
          <Link className="inline-block" href="/dashboard">
            <h1 className="text-2xl font-black text-white tracking-wider flex items-center gap-1.5">
              BLITZR <span className="text-blue-500">IA</span>
            </h1>
            <p className="text-[11px] font-medium text-zinc-500 tracking-wide mt-0.5">
              Enciende tu alcance
            </p>
          </Link>
        </div>

        {/* 2. Navigation */}
        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
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

      {/* 3. Footer: Profile & Credit Counters */}
      <div className="space-y-3 pt-6 border-t border-zinc-900">
        {/* User Card */}
        <div className="flex items-center gap-3 p-2.5 bg-zinc-900/60 border border-zinc-800/80 rounded-xl">
          <div className="w-9 h-9 rounded-full bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-bold text-sm flex-shrink-0">
            {initial}
          </div>
          <div className="overflow-hidden min-w-0">
            <p className="text-xs font-semibold text-zinc-200 truncate capitalize">{userName || 'Usuario Blitzr'}</p>
            <p className="text-[11px] text-zinc-500 truncate">{userEmail}</p>
          </div>
        </div>

        {/* Counters Widget */}
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
  )
}

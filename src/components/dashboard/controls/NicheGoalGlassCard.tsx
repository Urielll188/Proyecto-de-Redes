'use client'

import React from 'react'

export const NICHE_OPTIONS = [
  'Producto Físico',
  'Servicio Local',
  'E-commerce',
  'Marca Personal',
] as const

export const GOAL_OPTIONS = [
  'Venta Inmediata',
  'Generar Leads / Citas',
  'Autoridad',
] as const

export interface NicheGoalGlassCardProps {
  niche: string
  onNicheChange: (niche: string) => void
  goal: string
  onGoalChange: (goal: string) => void
  disabled?: boolean
  className?: string
}

export function NicheGoalGlassCard({
  niche,
  onNicheChange,
  goal,
  onGoalChange,
  disabled = false,
  className = '',
}: NicheGoalGlassCardProps) {
  return (
    <div
      className={`relative w-full lg:fixed lg:bottom-8 lg:left-8 lg:w-[340px] z-30 rounded-3xl bg-zinc-900/55 backdrop-blur-xl border border-white/10 p-5 space-y-4 shadow-[0_20px_50px_rgba(0,0,0,0.6)] pointer-events-auto select-none ${className}`}
    >
      {/* 1. NICHO DE NEGOCIO */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.9)]" />
          <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-300">
            Nicho de Negocio
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          {NICHE_OPTIONS.map((option) => {
            const active = niche === option
            return (
              <button
                key={option}
                type="button"
                disabled={disabled}
                onClick={() => onNicheChange(option)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer ${
                  active
                    ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/50 shadow-[0_0_14px_rgba(6,182,212,0.4)]'
                    : 'bg-zinc-950/60 text-zinc-400 border border-white/5 hover:border-white/15 hover:text-zinc-200 hover:bg-zinc-900/40'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {option}
              </button>
            )
          })}
        </div>
      </div>

      {/* 2. OBJETIVO DE CONVERSIÓN */}
      <div className="space-y-2.5 pt-3 border-t border-white/[0.08]">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.9)]" />
          <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-300">
            Objetivo de Conversión
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          {GOAL_OPTIONS.map((option) => {
            const active = goal === option
            return (
              <button
                key={option}
                type="button"
                disabled={disabled}
                onClick={() => onGoalChange(option)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer ${
                  active
                    ? 'bg-purple-500/20 text-purple-200 border border-purple-400/50 shadow-[0_0_14px_rgba(168,85,247,0.4)]'
                    : 'bg-zinc-950/60 text-zinc-400 border border-white/5 hover:border-white/15 hover:text-zinc-200 hover:bg-zinc-900/40'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {option}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

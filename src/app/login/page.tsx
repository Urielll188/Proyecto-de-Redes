'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { createClient } from '@/utils/supabase/client'
import { CinematicWarpTransition } from '@/components/transitions/CinematicWarpTransition'

interface Particle {
  x: number
  y: number
  baseX: number
  baseY: number
  size: number
  opacity: number
  depth: number // 1: lejano, 2: medio, 3: cercano
  speedX: number
  speedY: number
}

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [isWarpActive, setIsWarpActive] = useState(false)
  const [flashDone, setFlashDone] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const mousePos = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 })

  const supabase = createClient()

  // Manejador OAuth oficial conservado al 100%
  const handleGoogleLogin = async () => {
    setIsLoading(true)
    setErrorMessage(null)

    try {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('blitzr_transition_warp', 'true')
      }
    } catch {
      // ignore
    }

    setTimeout(() => {
      setIsWarpActive(true)
    }, 450)

    setTimeout(async () => {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback`,
        },
      })

      if (error) {
        setErrorMessage(error.message)
        setIsLoading(false)
        setIsWarpActive(false)
      }
    }, 1100)
  }

  // Partículas en <canvas> 2D con 3 planos de profundidad y paralaje suave
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    let w = (canvas.width = window.innerWidth)
    let h = (canvas.height = window.innerHeight)

    const handleResize = () => {
      if (!canvas) return
      w = canvas.width = window.innerWidth
      h = canvas.height = window.innerHeight
    }
    window.addEventListener('resize', handleResize)

    const handleMouseMove = (e: MouseEvent) => {
      mousePos.current.targetX = (e.clientX - w / 2) / (w / 2)
      mousePos.current.targetY = (e.clientY - h / 2) / (h / 2)
    }
    window.addEventListener('mousemove', handleMouseMove)

    const numParticles = 65
    const particles: Particle[] = []

    for (let i = 0; i < numParticles; i++) {
      const depth = (i % 3) + 1
      const size = depth === 1 ? 1 : depth === 2 ? 1.8 : 2.6
      const opacity = depth === 1 ? 0.22 : depth === 2 ? 0.45 : 0.75
      const posX = Math.random() * w
      const posY = Math.random() * h

      particles.push({
        x: posX,
        y: posY,
        baseX: posX,
        baseY: posY,
        size,
        opacity,
        depth,
        speedX: (Math.random() - 0.5) * 0.25 * depth,
        speedY: (Math.random() - 0.5) * 0.25 * depth,
      })
    }

    const render = () => {
      mousePos.current.x += (mousePos.current.targetX - mousePos.current.x) * 0.05
      mousePos.current.y += (mousePos.current.targetY - mousePos.current.y) * 0.05

      ctx.clearRect(0, 0, w, h)

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]

        p.baseX += p.speedX
        p.baseY += p.speedY

        if (p.baseX < 0) p.baseX = w
        if (p.baseX > w) p.baseX = 0
        if (p.baseY < 0) p.baseY = h
        if (p.baseY > h) p.baseY = 0

        const parallaxFactor = p.depth * 28
        p.x = p.baseX - mousePos.current.x * parallaxFactor
        p.y = p.baseY - mousePos.current.y * parallaxFactor

        ctx.save()
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)

        if (p.depth === 3) {
          ctx.shadowBlur = 12
          ctx.shadowColor = 'rgba(56, 189, 248, 0.65)'
          ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`
        } else if (p.depth === 2) {
          ctx.shadowBlur = 6
          ctx.shadowColor = 'rgba(168, 85, 247, 0.45)'
          ctx.fillStyle = `rgba(224, 231, 255, ${p.opacity})`
        } else {
          ctx.shadowBlur = 0
          ctx.fillStyle = `rgba(148, 163, 184, ${p.opacity})`
        }

        ctx.fill()
        ctx.restore()
      }

      animId = requestAnimationFrame(render)
    }

    render()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('mousemove', handleMouseMove)
    }
  }, [])

  return (
    <div className="min-h-screen bg-[#030305] relative overflow-hidden flex flex-col items-center justify-center px-4 select-none">
      {/* Salto cinemático de hiperespacio hacia el Dashboard */}
      <CinematicWarpTransition active={isWarpActive} mode="dive" durationMs={1100} />

      {/* 1. ATMÓSFERA CINEMATOGRÁFICA BASE (z-0) */}
      <svg
        className="fixed inset-0 w-full h-full pointer-events-none opacity-[0.035] mix-blend-overlay z-0"
        xmlns="http://www.w3.org/2000/svg"
      >
        <filter id="cinematicFilmGrain">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#cinematicFilmGrain)" />
      </svg>

      {/* Viñeta radial oscura */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background: 'radial-gradient(circle at center, transparent 35%, #000000 100%)',
        }}
      />

      {/* 3. Luces de Colores Envolventes alrededor del conjunto (z-0, desde 0.5s) */}
      <motion.div
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.4, delay: 0.5, ease: 'easeOut' }}
        className="fixed inset-0 flex items-center justify-center pointer-events-none z-0"
      >
        <div className="relative w-[360px] h-[360px] sm:w-[600px] sm:h-[600px] flex items-center justify-center">
          <div className="absolute -left-10 -top-6 w-64 h-64 sm:w-80 sm:h-80 rounded-full bg-cyan-500/20 mix-blend-screen blur-[95px]" />
          <div className="absolute inset-0 m-auto w-72 h-72 sm:w-96 sm:h-96 rounded-full bg-purple-500/25 mix-blend-screen blur-[95px]" />
          <div className="absolute -right-10 -bottom-6 w-64 h-64 sm:w-80 sm:h-80 rounded-full bg-fuchsia-500/15 mix-blend-screen blur-[95px]" />
        </div>
      </motion.div>

      {/* Partículas 2D reactivas al cursor (z-10) */}
      <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-10" />

      {/* 4. REVELACIÓN LIMPIA DE MARCA, ESLOGAN Y ACCIÓN (z-20) */}
      <div className="relative z-20 flex flex-col items-center text-center max-w-4xl w-full my-auto">
        {/* Bloque del Título BLITZR con Prisma Emblema y Destello Efímero detrás */}
        <div className="relative flex items-center justify-center">
          {/* 1. Secuencia de Encendido Efímera (0.0s -> 1.1s — Desaparece por completo al terminar) */}
          {!flashDone && (
            <motion.div
              initial={{ opacity: 0, scale: 0.2 }}
              animate={{ opacity: [0, 0.95, 0], scale: [0.2, 1.15, 0.8] }}
              transition={{ duration: 1.1, times: [0, 0.5, 1], ease: 'easeOut' }}
              onAnimationComplete={() => setFlashDone(true)}
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
            >
              <div className="w-24 h-24 rounded-full bg-white blur-xl mix-blend-screen" />
              <motion.div
                initial={{ scaleX: 0, opacity: 0 }}
                animate={{ scaleX: [0, 1, 0], opacity: [0, 0.85, 0] }}
                transition={{ duration: 1.0, times: [0, 0.45, 1], ease: 'easeOut' }}
                className="absolute w-64 sm:w-96 h-[2px] bg-gradient-to-r from-transparent via-white to-transparent blur-[1px] mix-blend-screen"
              />
            </motion.div>
          )}

          {/* 2. Prisma Triangular Emblema (Exclusivamente detrás de BLITZR) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.88 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 -translate-y-2"
          >
            <svg
              className="w-52 h-52 sm:w-64 sm:h-64 drop-shadow-[0_0_25px_rgba(168,85,247,0.35)]"
              viewBox="0 0 200 200"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <polygon
                points="100,22 182,164 18,164"
                stroke="rgba(255,255,255,0.28)"
                strokeWidth="1.5"
                fill="rgba(255,255,255,0.02)"
              />
            </svg>
          </motion.div>

          {/* Título BLITZR */}
          <motion.h1
            initial={{ opacity: 0, scale: 0.94, filter: 'blur(10px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            transition={{ duration: 0.85, delay: 0.95, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-20 text-5xl sm:text-7xl md:text-8xl font-black tracking-[0.22em] uppercase text-transparent bg-clip-text bg-gradient-to-b from-white via-zinc-100 to-zinc-400 drop-shadow-[0_0_32px_rgba(255,255,255,0.22)]"
            style={{
              WebkitBackgroundClip: 'text',
            }}
          >
            BLITZR
          </motion.h1>
        </div>

        {/* Eslogan "Tu producto para el mundo" (Fuera del triángulo) */}
        <motion.p
          initial={{ opacity: 0, y: 10, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.75, delay: 1.45, ease: 'easeOut' }}
          className="mt-5 text-sm sm:text-lg font-light tracking-[0.26em] uppercase text-zinc-300/90 text-center"
        >
          Tu producto para el mundo
        </motion.p>

        {/* Error si ocurre */}
        {errorMessage && (
          <div className="mt-6 px-4 py-2 rounded-full bg-red-950/70 border border-red-500/40 text-red-300 text-xs tracking-wide">
            {errorMessage}
          </div>
        )}

        {/* Botón "Continuar con Google" */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 1.85, ease: 'easeOut' }}
          className="mt-11"
        >
          <button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="
              group relative flex items-center justify-center gap-3.5 px-8 py-3.5 rounded-full
              bg-[#08080f]/90 hover:bg-[#0e0e1a] text-white text-sm sm:text-base font-semibold tracking-wide
              border border-purple-500/40 hover:border-cyan-400/60
              shadow-[0_0_25px_rgba(147,51,234,0.3),inset_0_0_14px_rgba(168,85,247,0.15)]
              hover:shadow-[0_0_35px_rgba(56,189,248,0.5),inset_0_0_20px_rgba(147,51,234,0.3)]
              transition-all duration-300 transform hover:scale-[1.03] active:scale-[0.98]
              disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer
            "
          >
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>

            <span>{isLoading ? 'Iniciando conexión...' : 'Continuar con Google'}</span>

            <span className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-purple-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
          </button>
        </motion.div>
      </div>

      {/* Enlaces de pie de página */}
      <footer className="relative z-20 text-[11px] text-zinc-600 tracking-[0.25em] uppercase space-x-3 mb-4">
        <a href="#privacidad" className="hover:text-zinc-400 transition-colors">
          Privacidad
        </a>
        <span>·</span>
        <a href="#terminos" className="hover:text-zinc-400 transition-colors">
          Términos
        </a>
      </footer>
    </div>
  )
}

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

  // 3. Partículas en <canvas> 2D con 3 planos de profundidad y paralaje suave
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

    // ~65 partículas en 3 capas de profundidad
    const numParticles = 65
    const particles: Particle[] = []

    for (let i = 0; i < numParticles; i++) {
      const depth = (i % 3) + 1 // 1, 2 o 3
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
      // Suavizado del puntero para paralaje cinemático
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

        // Paralaje diferenciado según la profundidad (capa 3 se mueve más rápido que capa 1)
        const parallaxFactor = p.depth * 28
        p.x = p.baseX - mousePos.current.x * parallaxFactor
        p.y = p.baseY - mousePos.current.y * parallaxFactor

        ctx.save()
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)

        if (p.depth === 3) {
          // Halo de luz en partículas cercanas
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
      {/* Textura de Grano de Película SVG (Film Grain) */}
      <svg
        className="fixed inset-0 w-full h-full pointer-events-none opacity-[0.035] mix-blend-overlay z-0"
        xmlns="http://www.w3.org/2000/svg"
      >
        <filter id="cinematicFilmGrain">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#cinematicFilmGrain)" />
      </svg>

      {/* Viñeta de Lente de Cine Oscura en Bordes */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background: 'radial-gradient(circle at center, transparent 35%, #000000 100%)',
        }}
      />

      {/* 3. Campo de Partículas con Profundidad de Campo y Paralaje (z-10) */}
      <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-10" />

      {/* 2. PRISMA MONUMENTAL Y DESTELLO ANAMÓRFICO (z-10) */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
        
        {/* Nebulosa Espectral Difuminada Respirando */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{
            opacity: [0.18, 0.28, 0.18],
            scale: [0.95, 1.05, 0.95],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="w-[600px] h-[350px] sm:w-[900px] sm:h-[500px] rounded-full blur-[110px] mix-blend-screen bg-gradient-to-r from-cyan-600/20 via-purple-600/25 to-amber-500/15"
        />

        {/* Destello Anamórfico Central (0.0s -> 1.4s) */}
        {/* Núcleo Blanco Suave */}
        <motion.div
          initial={{ scale: 0.1, opacity: 0 }}
          animate={{
            scale: [0.1, 1.3, 0.35],
            opacity: [0, 0.85, 0.14],
          }}
          transition={{
            duration: 1.4,
            times: [0, 0.45, 1],
            ease: 'easeOut',
          }}
          className="absolute w-32 h-32 rounded-full bg-white blur-2xl mix-blend-screen"
        />

        {/* Destello Horizontal de Lente Anamórfica */}
        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{
            scaleX: [0, 1.1, 0.4],
            opacity: [0, 0.9, 0],
          }}
          transition={{
            duration: 1.3,
            times: [0, 0.4, 1],
            ease: 'easeOut',
          }}
          className="absolute w-[85vw] max-w-[900px] h-[2px] bg-gradient-to-r from-transparent via-cyan-200/80 to-transparent blur-[1px] mix-blend-screen"
        />

        {/* PRISMA TRIANGULAR MONUMENTAL CON ABERRACIÓN CROMÁTICA */}
        <motion.div
          initial={{ opacity: 0, scale: 0.88 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
          className="absolute w-[340px] h-[340px] sm:w-[540px] sm:h-[540px] md:w-[680px] md:h-[680px] flex items-center justify-center"
        >
          <svg
            className="w-full h-full overflow-visible"
            viewBox="0 0 400 400"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Trazo fantasma 1: Cian (+2px aberración cromática) */}
            <polygon
              points="200,60 352,320 48,320"
              stroke="rgba(56, 189, 248, 0.18)"
              strokeWidth="1.2"
              transform="translate(-2, -1)"
            />

            {/* Trazo fantasma 2: Magenta (-2px aberración cromática) */}
            <polygon
              points="200,60 352,320 48,320"
              stroke="rgba(232, 121, 249, 0.18)"
              strokeWidth="1.2"
              transform="translate(2, 1)"
            />

            {/* Prisma Principal Equilátero */}
            <polygon
              points="200,60 352,320 48,320"
              stroke="rgba(255, 255, 255, 0.16)"
              strokeWidth="1.2"
              fill="rgba(255, 255, 255, 0.012)"
              className="backdrop-blur-[1px]"
            />

            {/* Haz de luz láser entrando al prisma desde abajo-izquierda */}
            <path
              d="M 20 330 L 200 190"
              stroke="url(#laserIncidenteGrad)"
              strokeWidth="2.2"
              filter="url(#glowLaser)"
            />
            <path
              d="M 20 330 L 200 190"
              stroke="#ffffff"
              strokeWidth="1"
            />

            {/* Refracción interna en el corazón del prisma */}
            <line
              x1="200"
              y1="190"
              x2="235"
              y2="178"
              stroke="#ffffff"
              strokeWidth="1.4"
              strokeDasharray="3 3"
            />

            {/* Haz de refracción espectral saliendo por la cara derecha */}
            <path
              d="M 235 178 L 390 120 L 400 240 Z"
              fill="url(#espectroRefractado)"
              opacity="0.38"
              className="mix-blend-screen blur-[2px]"
            />

            <defs>
              <linearGradient id="laserIncidenteGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
                <stop offset="60%" stopColor="#ffffff" stopOpacity="0.7" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="1" />
              </linearGradient>

              <linearGradient id="espectroRefractado" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
                <stop offset="35%" stopColor="#818cf8" stopOpacity="0.6" />
                <stop offset="70%" stopColor="#c084fc" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#e879f9" stopOpacity="0" />
              </linearGradient>

              <filter id="glowLaser" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
          </svg>
        </motion.div>
      </div>

      {/* 4. REVELACIÓN TIPOGRÁFICA Y ACCIÓN (z-20) */}
      <div className="relative z-20 flex flex-col items-center text-center max-w-4xl w-full my-auto">
        
        {/* Título BLITZR */}
        <motion.h1
          initial={{ opacity: 0, scale: 1.08, filter: 'blur(16px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          transition={{ duration: 1.1, delay: 0.85, ease: [0.16, 1, 0.3, 1] }}
          className="text-5xl sm:text-8xl md:text-9xl font-black tracking-[0.24em] uppercase text-transparent bg-clip-text bg-gradient-to-b from-white via-zinc-100 to-zinc-400 drop-shadow-[0_0_40px_rgba(255,255,255,0.28)]"
          style={{
            WebkitBackgroundClip: 'text',
          }}
        >
          BLITZR
        </motion.h1>

        {/* Eslogan "Tu producto para el mundo" */}
        <motion.p
          initial={{ opacity: 0, y: 10, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.9, delay: 1.45, ease: 'easeOut' }}
          className="mt-5 text-sm sm:text-xl font-light tracking-[0.28em] uppercase text-zinc-300/90 text-center"
          style={{
            textShadow: '0 0 16px rgba(255, 255, 255, 0.22)',
          }}
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
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.95, ease: 'easeOut' }}
          className="mt-12"
        >
          <button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className={`
              group relative flex items-center justify-center gap-3.5 px-8 py-3.5 rounded-full
              bg-[#08080f]/90 hover:bg-[#0e0e1a] text-white text-sm sm:text-base font-semibold tracking-wide
              border border-purple-500/40 hover:border-cyan-400/60
              shadow-[0_0_25px_rgba(147,51,234,0.3),inset_0_0_14px_rgba(168,85,247,0.15)]
              hover:shadow-[0_0_35px_rgba(56,189,248,0.5),inset_0_0_20px_rgba(147,51,234,0.3)]
              transition-all duration-300 transform hover:scale-[1.03] active:scale-[0.98]
              disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer
            `}
          >
            {/* Ícono de Google oficial */}
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

            {/* Brillo reflectivo en el borde */}
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

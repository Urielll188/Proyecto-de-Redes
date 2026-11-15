'use client'

import React, { useState, useEffect, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { CinematicWarpTransition } from '@/components/transitions/CinematicWarpTransition'

interface CinematicPrismLoginProps {
  onLoginSuccess?: () => void
}

export function CinematicPrismLogin({ onLoginSuccess }: CinematicPrismLoginProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isWarpActive, setIsWarpActive] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isHovered, setIsHovered] = useState(false)
  const [introPhase, setIntroPhase] = useState<'laser' | 'prism' | 'reveal' | 'ready'>('laser')

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const supabase = createClient()

  // Secuencia de animación de entrada del prisma cinemático
  useEffect(() => {
    const t1 = setTimeout(() => setIntroPhase('prism'), 400)
    const t2 = setTimeout(() => setIntroPhase('reveal'), 900)
    const t3 = setTimeout(() => setIntroPhase('ready'), 1400)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [])

  // Partículas y destellos dinámicos del prisma en Canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    let w = (canvas.width = window.innerWidth)
    let h = (canvas.height = window.innerHeight)

    const onResize = () => {
      if (!canvas) return
      w = canvas.width = window.innerWidth
      h = canvas.height = window.innerHeight
    }
    window.addEventListener('resize', onResize)

    // Rayos de dispersión cromática (espectro del prisma)
    interface Ray {
      angle: number
      length: number
      speed: number
      color: string
      width: number
      alpha: number
    }

    const colors = [
      'rgba(56, 189, 248, ', // cyan
      'rgba(99, 102, 241, ', // indigo
      'rgba(168, 85, 247, ', // purple
      'rgba(236, 72, 153, ', // pink
      'rgba(147, 51, 234, ', // violet
    ]

    const rays: Ray[] = []
    for (let i = 0; i < 28; i++) {
      rays.push({
        angle: 0.15 + (Math.random() - 0.5) * 0.45,
        length: 260 + Math.random() * 320,
        speed: 0.001 + Math.random() * 0.002,
        color: colors[i % colors.length],
        width: 15 + Math.random() * 30,
        alpha: 0.12 + Math.random() * 0.25,
      })
    }

    let time = 0

    const render = () => {
      time += 0.018
      ctx.clearRect(0, 0, w, h)

      const cx = w / 2
      const cy = h / 2 - 35 // Posición focal del prisma

      if (introPhase !== 'laser') {
        const hoverBoost = isHovered ? 1.6 : 1.0
        const clickBoost = isLoading ? 2.8 : 1.0

        ctx.save()
        ctx.globalCompositeOperation = 'screen'

        // Abanico volumétrico refractado hacia la derecha
        for (let i = 0; i < rays.length; i++) {
          const r = rays[i]
          const currentAngle = r.angle + Math.sin(time + i) * 0.05
          const endX = cx + Math.cos(currentAngle) * r.length * hoverBoost * clickBoost
          const endY = cy + Math.sin(currentAngle) * (r.length * 0.5) * hoverBoost * clickBoost

          const grad = ctx.createLinearGradient(cx + 15, cy, endX, endY)
          grad.addColorStop(0, r.color + (r.alpha * 1.5 * clickBoost) + ')')
          grad.addColorStop(0.6, r.color + (r.alpha * hoverBoost * clickBoost) + ')')
          grad.addColorStop(1, r.color + '0)')

          ctx.fillStyle = grad
          ctx.beginPath()
          ctx.moveTo(cx + 8, cy - 8)
          ctx.lineTo(endX, endY - r.width)
          ctx.lineTo(endX + 30, endY + r.width)
          ctx.closePath()
          ctx.fill()
        }

        ctx.restore()
      }

      animId = requestAnimationFrame(render)
    }

    render()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', onResize)
    }
  }, [introPhase, isHovered, isLoading])

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

    // Salto cinemático hacia adentro ("se mete a la pantalla")
    setTimeout(() => {
      setIsWarpActive(true)
    }, 450)

    // Redirección con Supabase OAuth
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
      } else {
        if (onLoginSuccess) onLoginSuccess()
      }
    }, 1100)
  }

  return (
    <div className="relative min-h-screen w-full bg-[#030305] text-white flex flex-col justify-between items-center p-6 select-none overflow-hidden font-sans">
      
      {/* 1. Capa de túnel de inmersión cuántica (se activa al hacer clic) */}
      <CinematicWarpTransition active={isWarpActive} mode="dive" durationMs={1100} />

      {/* 2. Lienzo reactivo de haces de refracción del prisma */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-0" />

      {/* 3. Resplandor ambiental de fondo */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[450px] bg-gradient-to-r from-blue-900/15 via-purple-900/20 to-cyan-900/15 rounded-full blur-[140px] pointer-events-none" />

      {/* Espaciador superior */}
      <div className="w-full h-8" />

      {/* 4. BLOQUE CENTRAL: LOGOTIPO BLITZR + PRISMA DE CRISTAL + LUZ REFRACTADA */}
      <div
        className={`relative z-10 flex flex-col items-center text-center transition-all duration-700 ${
          isWarpActive ? 'transform scale-[4.5] opacity-0 blur-xl pointer-events-none' : ''
        }`}
      >
        {/* COMPOSICIÓN DEL LOGO Y EL PRISMA */}
        <div className="relative flex items-center justify-center my-6">
          
          {/* SVG DEL HAZ DE LUZ LÁSER INCIDENTE Y EL PRISMA */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
            viewBox="0 0 600 200"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              {/* Filtro de resplandor para el haz láser */}
              <filter id="laserGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="blur1" />
                <feGaussianBlur stdDeviation="10" result="blur2" />
                <feMerge>
                  <feMergeNode in="blur2" />
                  <feMergeNode in="blur1" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              {/* Degradado para el prisma de cristal */}
              <linearGradient id="prismGlass" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
                <stop offset="50%" stopColor="#818cf8" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.35" />
              </linearGradient>

              {/* Degradado del láser blanco incidente */}
              <linearGradient id="laserBeamGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
                <stop offset="40%" stopColor="#ffffff" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="1" />
              </linearGradient>
            </defs>

            {/* Haz láser incidente: entra desde la diagonal izquierda hacia el prisma */}
            <path
              d="M 60 170 L 290 85"
              stroke="url(#laserBeamGrad)"
              strokeWidth={isLoading ? '4' : '2.5'}
              filter="url(#laserGlow)"
              className={`transition-all duration-700 ${
                introPhase === 'laser' ? 'opacity-0' : 'opacity-90'
              }`}
            />
            {/* Núcleo ultra-blanco fino del láser */}
            <path
              d="M 60 170 L 290 85"
              stroke="#ffffff"
              strokeWidth="1.2"
              className={`transition-all duration-700 ${
                introPhase === 'laser' ? 'opacity-0' : 'opacity-100'
              }`}
            />

            {/* Prisma triangular de cristal 3D (ubicado en el centro del logo) */}
            <g transform="translate(280, 50)">
              {/* Cara de fondo del prisma */}
              <polygon
                points="18,0 36,46 0,46"
                fill="url(#prismGlass)"
                stroke="rgba(255, 255, 255, 0.6)"
                strokeWidth="1"
                className="backdrop-blur-sm"
              />
              {/* Borde refractivo interno */}
              <line
                x1="18"
                y1="0"
                x2="24"
                y2="46"
                stroke="rgba(255, 255, 255, 0.4)"
                strokeWidth="0.8"
                strokeDasharray="2 2"
              />
              {/* Refracción interna del rayo */}
              <line
                x1="10"
                y1="35"
                x2="26"
                y2="28"
                stroke="#ffffff"
                strokeWidth="1.5"
                filter="url(#laserGlow)"
              />
            </g>
          </svg>

          {/* TIPOGRAFÍA METÁLICA CROMADA "B L I T Z R" */}
          <h1
            className={`text-6xl sm:text-7xl md:text-8xl font-black tracking-[0.22em] uppercase transition-all duration-1000 ${
              introPhase === 'laser' ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
            }`}
            style={{
              background: 'linear-gradient(180deg, #ffffff 0%, #cbd5e1 45%, #64748b 70%, #94a3b8 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 4px 18px rgba(0, 0, 0, 0.95)) drop-shadow(0 0 25px rgba(255, 255, 255, 0.12))',
            }}
          >
            BLITZR
          </h1>
        </div>

        {/* ES LOGAN ELEGANTE: "Tu producto para el mundo" */}
        <p
          className={`text-xs sm:text-sm font-medium tracking-[0.35em] uppercase text-zinc-400 mt-2 transition-all duration-700 delay-300 ${
            introPhase === 'ready' || introPhase === 'reveal' ? 'opacity-85 translate-y-0' : 'opacity-0 translate-y-2'
          }`}
          style={{
            textShadow: '0 0 12px rgba(148, 163, 184, 0.3)',
          }}
        >
          Tu producto para el mundo
        </p>

        {/* MENSAJE DE ERROR SI OCURRE */}
        {errorMessage && (
          <div className="mt-6 px-4 py-2 rounded-full bg-red-950/60 border border-red-500/40 text-red-300 text-xs tracking-wide">
            {errorMessage}
          </div>
        )}

        {/* BOTÓN PILL DE ACCESO CON RESPLANDOR NEÓN VIOLETA / CIAN */}
        <div
          className={`mt-12 transition-all duration-700 delay-500 ${
            introPhase === 'ready' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          <button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={`
              group relative flex items-center justify-center gap-3.5 px-8 py-3 rounded-full
              bg-[#08080f]/90 hover:bg-[#0f0f1a] text-white text-sm font-semibold tracking-wide
              border border-purple-500/40 hover:border-cyan-400/60
              shadow-[0_0_25px_rgba(147,51,234,0.3),inset_0_0_14px_rgba(168,85,247,0.15)]
              hover:shadow-[0_0_35px_rgba(56,189,248,0.5),inset_0_0_20px_rgba(147,51,234,0.3)]
              transition-all duration-300 transform hover:scale-[1.03] active:scale-[0.98]
              disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer
            `}
          >
            {/* Ícono de Google oficial SVG */}
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
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43-.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>

            <span>{isLoading ? 'Iniciando conexión...' : 'Continuar con Google'}</span>

            {/* Brillo sutil en el borde */}
            <span className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-purple-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
          </button>
        </div>
      </div>

      {/* 5. ENLACES INFERIORES: Privacidad · Términos */}
      <footer className="relative z-10 text-[11px] text-zinc-500 tracking-[0.2em] uppercase space-x-3 mb-2">
        <a href="#privacidad" className="hover:text-zinc-300 transition-colors">
          Privacidad
        </a>
        <span>·</span>
        <a href="#terminos" className="hover:text-zinc-300 transition-colors">
          Términos
        </a>
      </footer>

    </div>
  )
}

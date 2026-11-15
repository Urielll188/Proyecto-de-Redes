'use client'

import React, { useEffect, useRef, useState } from 'react'

interface CinematicWarpTransitionProps {
  active: boolean
  mode?: 'dive' | 'arrival' // 'dive' = se mete hacia adentro; 'arrival' = aterriza en dashboard
  onComplete?: () => void
  durationMs?: number
}

interface Star {
  x: number
  y: number
  z: number
  pz: number
}

export function CinematicWarpTransition({
  active,
  mode = 'dive',
  onComplete,
  durationMs = 1200,
}: CinematicWarpTransitionProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [flashOpacity, setFlashOpacity] = useState(0)
  const [scaleFactor, setScaleFactor] = useState(1)
  const [blurAmount, setBlurAmount] = useState(0)

  useEffect(() => {
    if (!active) return

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationFrameId: number
    let width = (canvas.width = window.innerWidth)
    let height = (canvas.height = window.innerHeight)

    const handleResize = () => {
      if (!canvas) return
      width = canvas.width = window.innerWidth
      height = canvas.height = window.innerHeight
    }
    window.addEventListener('resize', handleResize)

    // Generar campo de estrellas para el túnel de inmersión 3D
    const numStars = 450
    const stars: Star[] = []
    for (let i = 0; i < numStars; i++) {
      stars.push({
        x: (Math.random() - 0.5) * width * 2,
        y: (Math.random() - 0.5) * height * 2,
        z: Math.random() * width,
        pz: Math.random() * width,
      })
    }

    const startTime = performance.now()
    let speed = mode === 'dive' ? 2 : 45

    const render = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(1, elapsed / durationMs)

      // Curva cinemática exponencial
      if (mode === 'dive') {
        speed = 4 + Math.pow(progress, 3) * 75
        setScaleFactor(1 + Math.pow(progress, 2.5) * 4)
        setBlurAmount(Math.pow(progress, 2) * 16)
        if (progress > 0.72) {
          setFlashOpacity((progress - 0.72) / 0.28)
        }
      } else {
        // Modo arrival: desacelera del hiperespacio
        speed = Math.max(2, 60 * (1 - Math.pow(progress, 1.5)))
        setScaleFactor(1.15 - progress * 0.15)
        setBlurAmount(Math.max(0, (1 - progress) * 12))
        setFlashOpacity(Math.max(0, 1 - progress * 2.2))
      }

      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)'
      ctx.fillRect(0, 0, width, height)

      const cx = width / 2
      const cy = height / 2

      for (let i = 0; i < stars.length; i++) {
        const star = stars[i]
        star.pz = star.z
        star.z -= speed

        if (star.z <= 0) {
          star.z = width
          star.pz = width
          star.x = (Math.random() - 0.5) * width * 2
          star.y = (Math.random() - 0.5) * height * 2
        }

        const k = 250 / star.z
        const px = star.x * k + cx
        const py = star.y * k + cy

        const pk = 250 / star.pz
        const ppx = star.x * pk + cx
        const ppy = star.y * pk + cy

        if (px >= 0 && px <= width && py >= 0 && py <= height) {
          const shade = Math.min(255, Math.floor((1 - star.z / width) * 255))
          const isCyan = i % 3 === 0
          ctx.strokeStyle = isCyan
            ? `rgba(56, 189, 248, ${shade / 255})`
            : `rgba(255, 255, 255, ${shade / 255})`
          ctx.lineWidth = Math.min(3.5, (1 - star.z / width) * 4)
          ctx.beginPath()
          ctx.moveTo(ppx, ppy)
          ctx.lineTo(px, py)
          ctx.stroke()
        }
      }

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(render)
      } else {
        if (onComplete) onComplete()
      }
    }

    animationFrameId = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener('resize', handleResize)
    }
  }, [active, mode, durationMs, onComplete])

  if (!active) return null

  return (
    <div
      className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center overflow-hidden transition-all duration-300"
      style={{
        perspective: '1200px',
      }}
    >
      {/* 1. Lienzo de partículas de hiperespacio / túnel cuántico */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{
          transform: `scale(${scaleFactor})`,
          filter: `blur(${blurAmount}px)`,
        }}
      />

      {/* 2. Haz anamórfico central estilo película */}
      <div
        className="absolute w-full h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent blur-[1px] opacity-80"
        style={{
          transform: `scaleY(${scaleFactor * 1.5})`,
        }}
      />

      {/* 3. Viñeta cinematográfica envolvente */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at center, transparent 30%, rgba(0,0,0,0.6) 75%, black 100%)',
        }}
      />

      {/* 4. Leyenda táctica cinemática */}
      <div className="relative z-10 text-center space-y-2 select-none">
        <div className="inline-block px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/40 text-cyan-300 font-mono text-[11px] tracking-[0.25em] uppercase shadow-[0_0_15px_rgba(56,189,248,0.5)]">
          {mode === 'dive' ? 'ACCEDIENDO AL CENTRO DE MANDO...' : 'SISTEMA ONLINE'}
        </div>
      </div>

      {/* 5. Flash anamórfico que funde la escena en el punto de salto */}
      <div
        className="absolute inset-0 bg-gradient-to-b from-blue-100 via-white to-cyan-100 transition-opacity duration-150"
        style={{
          opacity: flashOpacity,
        }}
      />
    </div>
  )
}

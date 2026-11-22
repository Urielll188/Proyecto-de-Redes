'use client'

import React, { useRef } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'

interface BlitzrPrismStageProps {
  className?: string
  children?: React.ReactNode
  attenuated?: boolean
}

export function BlitzrPrismStage({
  className = '',
  children,
  attenuated = false,
}: BlitzrPrismStageProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)

  // Spring physics for natural 60fps inertia without Three.js
  const springX = useSpring(mouseX, { stiffness: 180, damping: 25, mass: 0.8 })
  const springY = useSpring(mouseY, { stiffness: 180, damping: 25, mass: 0.8 })

  // 3D Rotation mappings (-18deg to 18deg)
  const rotateX = useTransform(springY, [-0.5, 0.5], [18, -18])
  const rotateY = useTransform(springX, [-0.5, 0.5], [-18, 18])

  // Parallax offsets for depth layers
  const haloX = useTransform(springX, [-0.5, 0.5], [-30, 30])
  const haloY = useTransform(springY, [-0.5, 0.5], [-30, 30])

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (attenuated) return
    const rect = e.currentTarget.getBoundingClientRect()
    const normX = (e.clientX - rect.left) / rect.width - 0.5
    const normY = (e.clientY - rect.top) / rect.height - 0.5
    mouseX.set(normX)
    mouseY.set(normY)
  }

  const handleMouseLeave = () => {
    mouseX.set(0)
    mouseY.set(0)
  }

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`min-h-screen relative bg-[#050507] overflow-x-hidden ${
        attenuated
          ? 'flex flex-col w-full'
          : 'lg:h-screen lg:overflow-hidden flex flex-col justify-between px-4 pt-20 pb-8 lg:p-0 select-none'
      } ${className}`}
    >
      {/* Background Volumetric Halo & Micro-Particles (contained to prevent horizontal overflow) */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        {/* 1. Volumetric Ambient Glow Halo (Behind Prism) */}
        <motion.div
          style={{ x: haloX, y: haloY }}
          className={`w-[520px] h-[520px] rounded-full bg-gradient-to-tr from-cyan-500/15 via-purple-600/20 to-blue-500/10 blur-[100px] pointer-events-none transition-opacity duration-700 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ${
            attenuated ? 'opacity-20' : 'opacity-100'
          }`}
        />

        {/* 2. Ambient Floating Micro-Particles */}
        <div
          className={`absolute inset-0 pointer-events-none transition-opacity duration-700 ${
            attenuated ? 'opacity-20' : 'opacity-100'
          }`}
        >
          {[
            { top: '20%', left: '44%', size: 4, color: 'bg-cyan-400', opacity: 0.6 },
            { top: '34%', left: '57%', size: 3, color: 'bg-purple-400', opacity: 0.5 },
            { top: '66%', left: '42%', size: 4, color: 'bg-emerald-400', opacity: 0.4 },
            { top: '62%', left: '58%', size: 3, color: 'bg-cyan-300', opacity: 0.5 },
            { top: '26%', left: '54%', size: 2, color: 'bg-white', opacity: 0.8 },
            { top: '74%', left: '49%', size: 3, color: 'bg-purple-300', opacity: 0.4 },
            { top: '48%', left: '38%', size: 2.5, color: 'bg-cyan-200', opacity: 0.45 },
            { top: '52%', left: '62%', size: 2.5, color: 'bg-emerald-300', opacity: 0.5 },
          ].map((pt, i) => (
            <div
              key={i}
              className={`absolute rounded-full ${pt.color} animate-pulse`}
              style={{
                top: pt.top,
                left: pt.left,
                width: pt.size,
                height: pt.size,
                opacity: pt.opacity,
                filter: 'blur(0.5px)',
              }}
            />
          ))}
        </div>
      </div>

      {/* 3. Central 3D BLITZR Triangle-Prism Stage (Guaranteed Centering & Immutability) */}
      <div
        className={`pointer-events-none transition-opacity duration-700 ${
          attenuated
            ? 'fixed inset-0 flex items-center justify-center z-0 opacity-20 scale-75 lg:scale-100'
            : 'relative mx-auto my-2 scale-75 sm:scale-90 lg:scale-100 lg:fixed lg:inset-0 lg:flex lg:items-center lg:justify-center z-10 opacity-100'
        }`}
      >
        <motion.div
          style={{
            perspective: 1000,
            rotateX,
            rotateY,
            transformStyle: 'preserve-3d',
          }}
          className="relative w-[340px] h-[340px] md:w-[440px] md:h-[440px] flex items-center justify-center"
        >
          <svg
            viewBox="0 0 500 500"
            className="w-full h-full drop-shadow-[0_0_40px_rgba(6,182,212,0.35)]"
          >
            <defs>
              {/* Linear Gradients for 3D Facets */}
              <linearGradient id="prism-left-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00f2fe" stopOpacity="0.85" />
                <stop offset="45%" stopColor="#2563eb" stopOpacity="0.7" />
                <stop offset="100%" stopColor="#0f172a" stopOpacity="0.35" />
              </linearGradient>

              <linearGradient id="prism-right-grad" x1="100%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#c084fc" stopOpacity="0.85" />
                <stop offset="50%" stopColor="#8b5cf6" stopOpacity="0.65" />
                <stop offset="100%" stopColor="#1e1b4b" stopOpacity="0.3" />
              </linearGradient>

              <linearGradient id="prism-shelf-grad" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.8" />
                <stop offset="50%" stopColor="#8b5cf6" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.75" />
              </linearGradient>

              <linearGradient id="prism-specular-edge" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
                <stop offset="50%" stopColor="#67e8f9" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#c084fc" stopOpacity="0.7" />
              </linearGradient>

              {/* Filters for Edge Glow & Specular Flare */}
              <filter id="edge-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3.5" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              <filter id="intense-glint" x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur stdDeviation="5" result="glintBlur" />
                <feMerge>
                  <feMergeNode in="glintBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Bottom Volume Depth Facet */}
            <polygon
              points="110,360 390,360 250,405"
              fill="#030712"
              fillOpacity="0.7"
              stroke="#6366f1"
              strokeWidth="1"
              strokeOpacity="0.3"
            />

            {/* Bottom Shelf Facet (Upward Refraction Floor) */}
            <polygon
              points="110,360 390,360 250,310"
              fill="url(#prism-shelf-grad)"
              stroke="#22d3ee"
              strokeWidth="1.5"
              strokeOpacity="0.6"
            />

            {/* Left 3D Facet (Cyan/Blue) */}
            <polygon
              points="250,65 110,360 250,310"
              fill="url(#prism-left-grad)"
              stroke="#38bdf8"
              strokeWidth="1.5"
              strokeOpacity="0.8"
            />

            {/* Right 3D Facet (Purple/Violet) */}
            <polygon
              points="250,65 390,360 250,310"
              fill="url(#prism-right-grad)"
              stroke="#c084fc"
              strokeWidth="1.5"
              strokeOpacity="0.8"
            />

            {/* Internal Spectral Refraction Rays */}
            <line x1="170" y1="130" x2="250" y2="240" stroke="#ffffff" strokeWidth="2" strokeOpacity="0.75" />
            <line x1="250" y1="240" x2="345" y2="290" stroke="#22d3ee" strokeWidth="1.5" strokeOpacity="0.7" />
            <line x1="250" y1="240" x2="365" y2="325" stroke="#c084fc" strokeWidth="1.5" strokeOpacity="0.7" />
            <line x1="250" y1="240" x2="320" y2="350" stroke="#34d399" strokeWidth="1.5" strokeOpacity="0.7" />

            {/* Central Vertical Razor Blade (Specular Edge) */}
            <line
              x1="250"
              y1="65"
              x2="250"
              y2="310"
              stroke="url(#prism-specular-edge)"
              strokeWidth="3"
              filter="url(#edge-glow)"
            />

            {/* Outer Left & Right Ridge Highlights */}
            <line x1="250" y1="65" x2="110" y2="360" stroke="#67e8f9" strokeWidth="2" strokeOpacity="0.85" />
            <line x1="250" y1="65" x2="390" y2="360" stroke="#e879f9" strokeWidth="2" strokeOpacity="0.85" />

            {/* Specular Vertex Glints */}
            <circle cx="250" cy="65" r="4.5" fill="#ffffff" filter="url(#intense-glint)" />
            <circle cx="250" cy="310" r="3.5" fill="#a5f3fc" filter="url(#intense-glint)" />
            <circle cx="110" cy="360" r="3" fill="#38bdf8" />
            <circle cx="390" cy="360" r="3" fill="#c084fc" />
          </svg>
        </motion.div>
      </div>

      {/* 4. Child Layer (Floating Cards / Panels on top) */}
      {children}
    </div>
  )
}

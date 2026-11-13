'use client'

import React, { useState } from 'react'
import { toast } from 'sonner'
import type { VaultItemData } from '@/app/dashboard/history/HistoryClientGrid'

interface ReelPublishButtonProps {
  item: VaultItemData | any
}

function extractVideoUrl(item: any): string | null {
  if (typeof item?.videoUrl === 'string' && item.videoUrl.trim().length > 0) {
    return item.videoUrl
  }
  const candidates = [item?.bannerUrl, item?.publicUrl, item?.imageUrl]
  for (const url of candidates) {
    if (typeof url === 'string') {
      const clean = url.split('?')[0].toLowerCase()
      if (
        clean.endsWith('.mp4') ||
        clean.endsWith('.mov') ||
        clean.endsWith('.m4v') ||
        clean.endsWith('.webm')
      ) {
        return url
      }
    }
  }
  return null
}

export function ReelPublishButton({ item }: ReelPublishButtonProps) {
  const [isPublishing, setIsPublishing] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const videoUrl = extractVideoUrl(item)
  const caption = item.tiktokScript || item.instagramCopy || ''
  const hasVideo = Boolean(videoUrl)

  const publishInstagramReel = async (vUrl: string, cap: string) => {
    // 1. Inicializar contenedor en Meta para Instagram
    const initRes = await fetch('/api/meta/reels/initialize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoUrl: vUrl,
        caption: cap,
        publicationId: item.id,
      }),
    })

    const initData = await initRes.json()
    if (!initRes.ok || !initData.success || !initData.containerId) {
      throw new Error(initData.error || 'Error al iniciar contenedor en Instagram')
    }

    const containerId = initData.containerId

    // 2. Polling de procesamiento de video en Meta (cada 4s, máx 30 intentos)
    let isFinished = false
    const maxAttempts = 30

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 4000))

      const statusRes = await fetch(
        `/api/meta/reels/status?containerId=${encodeURIComponent(containerId)}`
      )
      const statusData = await statusRes.json()

      if (!statusRes.ok || statusData.status === 'ERROR') {
        throw new Error(statusData.error || 'Meta rechazó o falló al procesar el video en Instagram.')
      }

      if (statusData.status === 'FINISHED') {
        isFinished = true
        break
      }
    }

    if (!isFinished) {
      throw new Error('Tiempo de espera agotado al procesar video en Instagram.')
    }

    // 3. Publicar contenedor en Instagram
    const pubRes = await fetch('/api/meta/reels/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        containerId,
        publicationId: item.id,
      }),
    })

    const pubData = await pubRes.json()
    if (!pubRes.ok || !pubData.success) {
      throw new Error(pubData.error || 'Error al publicar el Reel en Instagram.')
    }

    return pubData
  }

  const publishFB = async () => {
    const res = await fetch('/api/meta/reels/facebook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoUrl,
        caption,
        publicationId: item.id,
      }),
    })

    const data = await res.json()
    if (!data.success) {
      throw new Error(data.error || 'Fallo en Facebook')
    }
    return data
  }

  const handlePublishAll = async () => {
    if (!videoUrl) {
      toast.error('No se detectó un archivo de video para este Reel.')
      return
    }

    setIsPublishing(true)
    setErrorMessage(null)
    const toastId = toast.loading('Publicando en Meta Reels (Instagram & Facebook)...')

    try {
      // Disparar Instagram Reel y Facebook Reel simultáneamente
      const [igResult, fbResult] = await Promise.allSettled([
        publishInstagramReel(videoUrl, caption),
        publishFB(),
      ])

      if (igResult.status === 'fulfilled' && fbResult.status === 'fulfilled') {
        toast.success('¡Reel publicado en Instagram y Facebook con éxito!', { id: toastId })
        setIsSuccess(true)
      } else if (igResult.status === 'fulfilled' && fbResult.status === 'rejected') {
        const fbErr =
          fbResult.reason instanceof Error ? fbResult.reason.message : 'Fallo en Facebook'
        toast.success(`Publicado en Instagram (Facebook: ${fbErr})`, { id: toastId })
        setIsSuccess(true)
      } else if (igResult.status === 'rejected' && fbResult.status === 'fulfilled') {
        const igErr =
          igResult.reason instanceof Error ? igResult.reason.message : 'Fallo en Instagram'
        toast.success(`Publicado en Facebook (Instagram: ${igErr})`, { id: toastId })
        setIsSuccess(true)
      } else if (igResult.status === 'rejected' && fbResult.status === 'rejected') {
        const igErr =
          igResult.reason instanceof Error ? igResult.reason.message : 'Error en Instagram'
        const fbErr =
          fbResult.reason instanceof Error ? fbResult.reason.message : 'Error en Facebook'
        throw new Error(`No se pudo publicar en ninguna plataforma. IG: ${igErr} | FB: ${fbErr}`)
      }
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : 'Error al publicar'
      setErrorMessage(msg)
      toast.error(msg, { id: toastId })
    } finally {
      setIsPublishing(false)
    }
  }

  return (
    <div className="flex flex-col items-end">
      <button
        type="button"
        disabled={!hasVideo || isPublishing || isSuccess}
        onClick={handlePublishAll}
        className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
          isSuccess
            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 cursor-default'
            : 'bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 hover:opacity-95 text-white shadow-sm active:scale-95'
        } disabled:opacity-40 disabled:cursor-not-allowed`}
        title={
          !hasVideo
            ? 'Solo disponible para publicaciones con video'
            : errorMessage || undefined
        }
      >
        {isPublishing ? (
          <span>⏳ Publicando en Meta (IG & FB)...</span>
        ) : isSuccess ? (
          <span>✅ Publicado en Meta (IG + FB)</span>
        ) : (
          <span>🚀 Publicar en Meta Reels</span>
        )}
      </button>
    </div>
  )
}

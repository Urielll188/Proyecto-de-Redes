'use client'

import { useState } from 'react'

export function useMetaReelsPublisher() {
  const [isPublishing, setIsPublishing] = useState(false)
  const [phase, setPhase] = useState<'IDLE' | 'INITIALIZING' | 'PROCESSING' | 'PUBLISHING' | 'SUCCESS' | 'ERROR'>('IDLE')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const publishReel = async ({
    videoUrl,
    caption,
    publicationId,
  }: {
    videoUrl: string
    caption: string
    publicationId?: string
  }) => {
    setIsPublishing(true)
    setPhase('INITIALIZING')
    setErrorMessage(null)

    try {
      // Paso 1: Inicializar contenedor
      const initRes = await fetch('/api/meta/reels/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl, caption, publicationId }),
      })
      const initData = await initRes.json()
      if (!initData.success) throw new Error(initData.error || 'Error creando contenedor')

      const containerId = initData.containerId
      setPhase('PROCESSING')

      // Paso 2: Polling con límite de 30 intentos (120 segundos max)
      let attempts = 0
      const maxAttempts = 30
      let isReady = false

      while (attempts < maxAttempts && !isReady) {
        await new Promise((resolve) => setTimeout(resolve, 4000))
        attempts++

        const statusRes = await fetch(`/api/meta/reels/status?containerId=${containerId}`)
        const statusData = await statusRes.json()

        if (statusData.status === 'FINISHED') {
          isReady = true
        } else if (statusData.status === 'ERROR') {
          throw new Error('Meta no pudo procesar el video (formato o códec incompatible).')
        }
      }

      if (!isReady) throw new Error('Tiempo de espera agotado al procesar el video en Meta.')

      // Paso 3: Publicar
      setPhase('PUBLISHING')
      const pubRes = await fetch('/api/meta/reels/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ containerId, publicationId }),
      })
      const pubData = await pubRes.json()
      if (!pubData.success) throw new Error(pubData.error || 'Error publicando Reel')

      setPhase('SUCCESS')
      return { success: true, publishId: pubData.publishId }
    } catch (err) {
      setPhase('ERROR')
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      setErrorMessage(msg)
      return { success: false, error: msg }
    } finally {
      setIsPublishing(false)
    }
  }

  return { publishReel, isPublishing, phase, errorMessage }
}

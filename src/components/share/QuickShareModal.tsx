'use client'

import React, { useState, useEffect } from 'react'
import { prepareShareableFile, triggerNativeShare } from '@/lib/share/native-share-service'
import { toast } from 'sonner'
import { Copy, Check, X } from 'lucide-react'

export interface QuickShareModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  caption: string
  mediaUrl?: string
  fileName?: string
}

export function QuickShareModal({
  isOpen,
  onClose,
  title,
  caption,
  mediaUrl,
  fileName,
}: QuickShareModalProps) {
  const [preparedFile, setPreparedFile] = useState<File | null>(null)
  const [isPreparingFile, setIsPreparingFile] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  const [shareFeedback, setShareFeedback] = useState<string | null>(null)
  const [copiedText, setCopiedText] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      setIsSharing(false)
      setShareFeedback(null)
      return
    }

    // Si no hay archivo remoto, no requiere preparación previa
    if (!mediaUrl) {
      setIsPreparingFile(false)
      setPreparedFile(null)
      return
    }

    let isMounted = true
    setIsPreparingFile(true)

    prepareShareableFile(mediaUrl, fileName)
      .then((file) => {
        if (isMounted) {
          setPreparedFile(file)
          setIsPreparingFile(false)
        }
      })
      .catch(() => {
        if (isMounted) setIsPreparingFile(false)
      })

    return () => {
      isMounted = false
    }
  }, [isOpen, mediaUrl, fileName])

  if (!isOpen) return null

  const isVideo = Boolean(
    mediaUrl && (
      mediaUrl.includes('.mp4') || 
      mediaUrl.includes('.mov') || 
      mediaUrl.includes('.webm') ||
      preparedFile?.type.startsWith('video/')
    )
  )

  const handleCopyText = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(caption)
        setCopiedText(true)
        toast?.success?.('¡Texto copiado al portapapeles!')
        setTimeout(() => setCopiedText(false), 2000)
      }
    } catch (e) {
      console.warn('Error al copiar texto:', e)
      toast?.error?.('No se pudo copiar el texto')
    }
  }

  const handleShare = async () => {
    if (isPreparingFile || isSharing) return

    setIsSharing(true)
    setShareFeedback(null)

    try {
      const result = await triggerNativeShare({
        title,
        text: caption,
        file: preparedFile,
        fileUrl: mediaUrl,
      })
      setShareFeedback(result.message)
    } catch (error) {
      console.error('Error al compartir:', error)
    } finally {
      setIsSharing(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="relative w-full max-w-md rounded-2xl bg-neutral-900 border border-neutral-800 p-6 text-white shadow-2xl">
        {/* Botón de cierre en la esquina superior derecha */}
        <button
          onClick={onClose}
          type="button"
          className="absolute top-4 right-4 p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
          aria-label="Cerrar modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Título */}
        <div className="mb-4 pr-8">
          <h3 className="text-lg font-bold tracking-tight text-white">{title}</h3>
          <p className="text-xs text-neutral-400 mt-0.5">
            Distribución asistida para WhatsApp y redes personales
          </p>
        </div>

        {/* Vista previa visual del contenido */}
        {mediaUrl && (
          <div className="mb-4 rounded-xl overflow-hidden border border-neutral-800 bg-neutral-950 flex items-center justify-center">
            {isVideo ? (
              <video 
                src={mediaUrl} 
                controls 
                className="w-full max-h-56 rounded-xl object-cover bg-black border border-neutral-800"
                playsInline
              />
            ) : (
              <img 
                src={mediaUrl} 
                alt={title} 
                className="w-full max-h-56 rounded-xl object-cover border border-neutral-800"
              />
            )}
          </div>
        )}

        {/* Bloque de texto con caption y opción de copia */}
        <div className="space-y-1.5 mb-2">
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span>Texto / Copy del post</span>
            <button
              type="button"
              onClick={handleCopyText}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 px-2 py-0.5 rounded transition-colors cursor-pointer"
            >
              {copiedText ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-400">¡Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copiar texto</span>
                </>
              )}
            </button>
          </div>
          <div className="bg-neutral-800 p-3 rounded-lg text-sm text-neutral-300 font-mono max-h-32 overflow-y-auto whitespace-pre-wrap leading-relaxed select-text">
            {caption}
          </div>
        </div>

        {/* Botón Principal de Acción */}
        <button
          type="button"
          onClick={handleShare}
          disabled={isPreparingFile || isSharing}
          className={`w-full mt-4 py-3.5 px-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 text-black shadow-lg ${
            isPreparingFile || isSharing
              ? 'bg-neutral-600 opacity-60 cursor-not-allowed'
              : 'bg-emerald-500 hover:bg-emerald-400 active:scale-95 shadow-emerald-500/20 cursor-pointer'
          }`}
        >
          {isPreparingFile ? (
            <>
              <span className="inline-block animate-spin">⏳</span>
              <span>Optimizando video en alta calidad...</span>
            </>
          ) : isSharing ? (
            <>
              <span className="inline-block animate-pulse">🚀</span>
              <span>Abriendo WhatsApp...</span>
            </>
          ) : (
            <>
              <span>📲</span>
              <span>Compartir en WhatsApp / Estados</span>
            </>
          )}
        </button>

        {shareFeedback && (
          <p className="mt-2 text-xs text-center text-emerald-400 animate-fade-in font-medium">
            {shareFeedback}
          </p>
        )}
      </div>
    </div>
  )
}

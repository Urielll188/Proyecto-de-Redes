'use client'

import React, { useState, useEffect } from 'react'
import { prepareShareableFile, triggerNativeShare } from '@/lib/share/native-share-service'
import { toast } from 'sonner'
import { Copy, Check, X, Loader2, Share2, Sparkles, AlertCircle } from 'lucide-react'

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
  const [isPreparing, setIsPreparing] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  const [copiedText, setCopiedText] = useState(false)
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'info' | 'warning'
    message: string
  } | null>(null)

  // Pre-cargar el archivo en segundo plano al abrir el modal para preservar el user gesture en iOS Safari
  useEffect(() => {
    let isCancelled = false

    if (isOpen && mediaUrl) {
      setIsPreparing(true)
      setFeedback(null)

      prepareShareableFile(mediaUrl, fileName)
        .then((file) => {
          if (!isCancelled) {
            setPreparedFile(file)
            setIsPreparing(false)
          }
        })
        .catch(() => {
          if (!isCancelled) {
            setPreparedFile(null)
            setIsPreparing(false)
          }
        })
    } else {
      setPreparedFile(null)
      setIsPreparing(false)
      setFeedback(null)
      setCopiedText(false)
    }

    return () => {
      isCancelled = true
    }
  }, [isOpen, mediaUrl, fileName])

  if (!isOpen) return null

  const isVideo =
    Boolean(mediaUrl?.match(/\.(mp4|webm|mov)(\?.*)?$/i)) ||
    Boolean(fileName?.match(/\.(mp4|webm|mov)$/i))

  const handleCopyText = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(caption)
        setCopiedText(true)
        toast?.success?.('¡Texto copiado al portapapeles!')
        setTimeout(() => setCopiedText(false), 2500)
      }
    } catch (e) {
      console.warn('Error al copiar texto:', e)
      toast?.error?.('No se pudo copiar el texto al portapapeles')
    }
  }

  const handleShare = async () => {
    setIsSharing(true)
    setFeedback(null)

    try {
      const result = await triggerNativeShare({
        title,
        text: caption,
        file: preparedFile,
        fileUrl: mediaUrl,
      })

      if (result.success) {
        setFeedback({ type: 'success', message: result.message })
        toast?.success?.(result.message)
      } else {
        setFeedback({
          type: result.mode === 'clipboard-fallback' ? 'info' : 'warning',
          message: result.message,
        })
        toast?.info?.(result.message)
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Error inesperado al compartir'
      setFeedback({ type: 'warning', message: errMsg })
      toast?.error?.(errMsg)
    } finally {
      setIsSharing(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Cabecera */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">
                Compartir Asistido
              </h3>
              <p className="text-[11px] text-zinc-400">
                WhatsApp, Estados y Redes Sociales
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Cuerpo con Scroll */}
        <div className="p-6 space-y-4 overflow-y-auto">
          {/* Indicador de optimización en segundo plano */}
          {isPreparing && (
            <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs">
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              <span>Optimizando archivo para WhatsApp y apps móviles...</span>
            </div>
          )}

          {/* Vista previa de Media */}
          {mediaUrl && (
            <div className="rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 max-h-52 flex items-center justify-center">
              {isVideo ? (
                <video
                  src={mediaUrl}
                  controls
                  playsInline
                  className="w-full max-h-52 object-contain"
                />
              ) : (
                <img
                  src={mediaUrl}
                  alt={title || 'Vista previa'}
                  className="w-full max-h-52 object-contain"
                />
              )}
            </div>
          )}

          {/* Caja con Copy / Guion */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-pink-400" />
                Texto del Copy
              </label>
              <button
                type="button"
                onClick={handleCopyText}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
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
            <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-300 max-h-32 overflow-y-auto whitespace-pre-wrap leading-relaxed select-text font-mono">
              {caption}
            </div>
          </div>

          {/* Mensaje de Feedback */}
          {feedback && (
            <div
              className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs leading-relaxed ${
                feedback.type === 'success'
                  ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                  : feedback.type === 'info'
                  ? 'bg-sky-950/40 border-sky-800/60 text-sky-300'
                  : 'bg-amber-950/40 border-amber-800/60 text-amber-300'
              }`}
            >
              {feedback.type === 'success' ? (
                <Check className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}
        </div>

        {/* Footer con Botón Principal Verde WhatsApp */}
        <div className="p-4 bg-zinc-950/60 border-t border-zinc-800">
          <button
            type="button"
            onClick={handleShare}
            disabled={isSharing}
            className="w-full py-3.5 px-6 bg-[#25D366] hover:bg-[#20ba59] active:scale-[0.99] text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-[#25D366]/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSharing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Abriendo menú de compartir...</span>
              </>
            ) : (
              <>
                <span className="text-base leading-none">📲</span>
                <span>Compartir en Estados de WhatsApp / Redes</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

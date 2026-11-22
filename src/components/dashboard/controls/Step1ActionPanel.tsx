'use client'

import React, { useState, useEffect, useRef } from 'react'
import imageCompression from 'browser-image-compression'
import { createClient } from '@/utils/supabase/client'
import { uploadVideoToVault } from '@/lib/storage/upload-service'
import { toast } from 'sonner'
import { Sparkles, X, Plus } from 'lucide-react'

export const MAX_FILE_SIZE_BYTES = 40 * 1024 * 1024 // 40 MB
export const ACCEPTED_MEDIA_TYPES = 'image/*,video/mp4,video/quicktime,video/x-m4v'

export interface Step1ActionPanelProps {
  userId: string
  productDesc: string
  setProductDesc: (desc: string) => void
  imageUrl: string | null
  setImageUrl: (url: string | null) => void
  mediaType: 'image' | 'video'
  setMediaType: (type: 'image' | 'video') => void
  storagePath: string | null
  setStoragePath: (path: string | null) => void
  imageBase64: string | null
  setImageBase64: (base64: string | null) => void
  isUploadingToStorage: boolean
  setIsUploadingToStorage: (uploading: boolean) => void
  isGenerating: boolean
  generationMode: 'fast' | 'strategic'
  onGenerate: (mode: 'fast' | 'strategic') => void
  onResetCutout?: () => void
  className?: string
  clienteObjetivoTipo?: 'consumidor_final' | 'empresas_b2b' | 'ambos'
  setClienteObjetivoTipo?: (val: 'consumidor_final' | 'empresas_b2b' | 'ambos') => void
  modalidadEntrega?: 'catalogo_estandar' | 'personalizado_bajo_pedido' | 'servicio_en_sitio'
  setModalidadEntrega?: (val: 'catalogo_estandar' | 'personalizado_bajo_pedido' | 'servicio_en_sitio') => void
  volumenCompra?: 'menudeo' | 'mayoreo' | 'proyecto'
  setVolumenCompra?: (val: 'menudeo' | 'mayoreo' | 'proyecto') => void
}

export function Step1ActionPanel({
  userId,
  productDesc,
  setProductDesc,
  imageUrl,
  setImageUrl,
  mediaType,
  setMediaType,
  storagePath,
  setStoragePath,
  imageBase64,
  setImageBase64,
  isUploadingToStorage,
  setIsUploadingToStorage,
  isGenerating,
  generationMode,
  onGenerate,
  onResetCutout,
  className = '',
  clienteObjetivoTipo = 'consumidor_final',
  setClienteObjetivoTipo,
  modalidadEntrega = 'catalogo_estandar',
  setModalidadEntrega,
  volumenCompra = 'menudeo',
  setVolumenCompra,
}: Step1ActionPanelProps) {
  const [localPreview, setLocalPreview] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  // Clean object URL on unmount
  useEffect(() => {
    return () => {
      if (localPreview && localPreview.startsWith('blob:')) {
        URL.revokeObjectURL(localPreview)
      }
    }
  }, [localPreview])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 1. Validar límite de peso (40 MB)
    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast.error('El archivo supera los 40 MB permitidos.')
      return
    }

    // 2. Determinar si es video o imagen
    const isVideoFile =
      file.type.startsWith('video/') ||
      /\.(mp4|mov|m4v|webm)$/i.test(file.name)

    const isImageFile =
      file.type.startsWith('image/') ||
      /\.(jpg|jpeg|png|webp|gif)$/i.test(file.name)

    if (!isVideoFile && !isImageFile) {
      toast.error('Formato no soportado. Selecciona una imagen o video (MP4/MOV).')
      return
    }

    try {
      setIsUploadingToStorage(true)
      setFileName(file.name)
      const objectUrl = URL.createObjectURL(file)
      setLocalPreview(objectUrl)
      onResetCutout?.()

      if (isVideoFile) {
        // Video upload to Supabase Vault
        setMediaType('video')
        setImageBase64(null)
        const toastId = toast.loading('Subiendo video a blitzr-vault...')
        const vaultRes = await uploadVideoToVault(file)
        toast.success('¡Video subido con éxito!', { id: toastId })
        setImageUrl(vaultRes.publicUrl)
        setStoragePath(vaultRes.path)
      } else {
        // Image upload with compression + base64 encoding for Gemini multimodal
        setMediaType('image')
        const toastId = toast.loading('Optimizando imagen...')

        // Helper to convert to base64
        const convertToBase64 = (fileOrBlob: Blob): Promise<string> => {
          return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.readAsDataURL(fileOrBlob)
            reader.onload = () => resolve(reader.result as string)
            reader.onerror = (err) => reject(err)
          })
        }

        let fileToUpload: File = file
        if (file.size > 1024 * 1024) {
          try {
            const options = {
              maxSizeMB: 1,
              maxWidthOrHeight: 1200,
              useWebWorker: true,
            }
            fileToUpload = await imageCompression(file, options)
          } catch (compressionErr) {
            console.warn('Compresión omitida, subiendo original:', compressionErr)
            fileToUpload = file
          }
        }

        // Set base64 for instant Gemini multimodal reasoning
        try {
          const b64 = await convertToBase64(fileToUpload)
          setImageBase64(b64)
        } catch (b64Err) {
          console.warn('No se pudo generar base64:', b64Err)
        }

        const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
        const filePath = `${userId}/${Date.now()}_${cleanFileName}`

        const { data, error } = await supabase.storage
          .from('product-images')
          .upload(filePath, fileToUpload, {
            cacheControl: '3600',
            upsert: false,
          })

        if (error) throw error

        const {
          data: { publicUrl },
        } = supabase.storage.from('product-images').getPublicUrl(data.path)

        toast.success('¡Imagen optimizada y lista!', { id: toastId })
        setImageUrl(publicUrl)
        setStoragePath(data.path)
      }
    } catch (err: any) {
      console.error('Error al procesar archivo:', err)
      toast.error('Error al subir archivo: ' + (err.message || 'Intenta de nuevo'))
      if (localPreview && localPreview.startsWith('blob:')) {
        URL.revokeObjectURL(localPreview)
      }
      setLocalPreview(null)
      setFileName(null)
      setImageUrl(null)
      setImageBase64(null)
      setStoragePath(null)
    } finally {
      setIsUploadingToStorage(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleRemoveMedia = () => {
    if (localPreview && localPreview.startsWith('blob:')) {
      URL.revokeObjectURL(localPreview)
    }
    setLocalPreview(null)
    setFileName(null)
    setImageUrl(null)
    setImageBase64(null)
    setStoragePath(null)
    onResetCutout?.()
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const activeMediaUrl = localPreview || imageUrl

  return (
    <div
      className={`relative w-full mt-4 lg:mt-0 lg:fixed lg:bottom-8 lg:right-8 lg:max-w-[450px] z-30 space-y-3 pointer-events-auto select-none ${className}`}
    >
      {/* 1. TOP ROW: MOTOR GEMINI BADGE & COMPACT MEDIA DROPZONE */}
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-400/30 text-cyan-300 text-xs font-medium shadow-[0_0_12px_rgba(6,182,212,0.15)] select-none">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <span>✨ MOTOR GEMINI LISTO</span>
        </div>

        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_MEDIA_TYPES}
            onChange={handleFileChange}
            disabled={isUploadingToStorage || isGenerating}
            className="hidden"
            id="blitzr-stage-file-input"
          />
          <label
            htmlFor="blitzr-stage-file-input"
            className="cursor-pointer px-3 py-1 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/15 text-xs text-zinc-300 hover:text-white transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
          >
            <Plus className="w-3.5 h-3.5 text-cyan-400" />
            <span>Foto o Video</span>
          </label>
        </div>
      </div>

      {/* 2. COMPACT FILE PREVIEW THUMBNAIL (PERMANENT CENTERING GUARANTEE: NEVER INVADES CENTER) */}
      {activeMediaUrl && (
        <div className="flex items-center gap-2.5 p-2 rounded-xl bg-zinc-900/70 border border-white/10 backdrop-blur-xl shadow-lg animate-in fade-in zoom-in-95 duration-200">
          <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-white/20 bg-zinc-950 flex-shrink-0 shadow-md">
            {mediaType === 'video' ? (
              <video
                src={activeMediaUrl}
                className="w-full h-full object-cover"
                muted
                playsInline
              />
            ) : (
              <img
                src={activeMediaUrl}
                alt="Miniatura del producto"
                className="w-full h-full object-cover"
              />
            )}
            {isUploadingToStorage && (
              <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                <div className="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-medium text-zinc-200 truncate">
              {fileName || (mediaType === 'video' ? 'Video cargado' : 'Imagen cargada')}
            </p>
            <span className="text-[10px] text-cyan-400 flex items-center gap-1">
              {isUploadingToStorage ? (
                <>
                  <span className="w-1 h-1 rounded-full bg-cyan-400 animate-ping" />
                  Subiendo a la bóveda...
                </>
              ) : (
                'Listo para análisis multimodal'
              )}
            </span>
          </div>

          <button
            type="button"
            onClick={handleRemoveMedia}
            disabled={isUploadingToStorage || isGenerating}
            className="w-6 h-6 flex items-center justify-center rounded-lg bg-red-950/40 hover:bg-red-900/60 border border-red-800/40 text-red-400 text-xs transition-colors cursor-pointer"
            title="Quitar archivo"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 3. IDEA INPUT GLASS BOX */}
      <div className="rounded-2xl bg-zinc-900/70 backdrop-blur-xl border border-white/15 p-3.5 shadow-2xl focus-within:border-cyan-400/50 focus-within:shadow-[0_0_20px_rgba(6,182,212,0.15)] transition-all space-y-2.5">
        <textarea
          rows={3}
          value={productDesc}
          onChange={(e) => setProductDesc(e.target.value)}
          disabled={isGenerating}
          placeholder="Describe tu producto o la oferta que quieres lanzar hoy (ej. Impresiones 3D personalizadas o por catálogo, figuras y piezas a medida)..."
          className="w-full bg-transparent border-0 text-xs md:text-sm text-zinc-100 placeholder-zinc-500 focus:ring-0 focus:outline-none resize-none leading-relaxed disabled:opacity-50"
        />

        {/* 3 FILAS COMPACTAS DE PÍLDORAS DE CONTEXTO COMERCIAL (1 CLIC) */}
        {setClienteObjetivoTipo && setModalidadEntrega && setVolumenCompra && (
          <div className="pt-2 border-t border-white/10 space-y-1.5 select-none">
            {/* Fila 1: ¿Quién compra? */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider min-w-[85px]">
                ¿Quién compra?
              </span>
              {[
                { id: 'consumidor_final', label: 'Público / Personas' },
                { id: 'empresas_b2b', label: 'Negocios / Empresas' },
                { id: 'ambos', label: 'Ambos' },
              ].map((opt) => {
                const active = clienteObjetivoTipo === opt.id
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setClienteObjetivoTipo(opt.id as any)}
                    disabled={isGenerating}
                    className={`text-[11px] px-2.5 py-1 rounded-full font-medium transition-all cursor-pointer ${
                      active
                        ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/60 shadow-[0_0_10px_rgba(6,182,212,0.3)]'
                        : 'bg-white/[0.04] text-zinc-400 border border-white/10 hover:border-white/20 hover:text-zinc-200'
                    } disabled:opacity-50`}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>

            {/* Fila 2: ¿Cómo entregas? */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider min-w-[85px]">
                ¿Cómo entregas?
              </span>
              {[
                { id: 'catalogo_estandar', label: 'Catálogo listo' },
                { id: 'personalizado_bajo_pedido', label: 'Personalizado / A medida' },
                { id: 'servicio_en_sitio', label: 'Servicio / En sitio' },
              ].map((opt) => {
                const active = modalidadEntrega === opt.id
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setModalidadEntrega(opt.id as any)}
                    disabled={isGenerating}
                    className={`text-[11px] px-2.5 py-1 rounded-full font-medium transition-all cursor-pointer ${
                      active
                        ? 'bg-purple-500/25 text-purple-200 border border-purple-400/60 shadow-[0_0_10px_rgba(168,85,247,0.3)]'
                        : 'bg-white/[0.04] text-zinc-400 border border-white/10 hover:border-white/20 hover:text-zinc-200'
                    } disabled:opacity-50`}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>

            {/* Fila 3: ¿Cómo compran? */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider min-w-[85px]">
                ¿Cómo compran?
              </span>
              {[
                { id: 'menudeo', label: 'Piezas sueltas' },
                { id: 'mayoreo', label: 'Mayoreo / Lotes' },
                { id: 'proyecto', label: 'Por proyecto' },
              ].map((opt) => {
                const active = volumenCompra === opt.id
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setVolumenCompra(opt.id as any)}
                    disabled={isGenerating}
                    className={`text-[11px] px-2.5 py-1 rounded-full font-medium transition-all cursor-pointer ${
                      active
                        ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-400/60 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                        : 'bg-white/[0.04] text-zinc-400 border border-white/10 hover:border-white/20 hover:text-zinc-200'
                    } disabled:opacity-50`}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* 4. DUAL ACTION TRIGGER BUTTONS */}
      <div className="flex items-center gap-2.5 pt-1">
        {/* Main Strategic CMO Launch Button */}
        <button
          type="button"
          onClick={() => onGenerate('strategic')}
          disabled={isGenerating || isUploadingToStorage}
          className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500 hover:from-blue-500 hover:to-emerald-400 text-white font-bold text-xs md:text-sm shadow-[0_0_25px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.45)] transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer active:scale-[0.98]"
        >
          {isGenerating && generationMode === 'strategic' ? (
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-white animate-ping" />
              🧠 Analizando...
            </span>
          ) : (
            <>
              <span>🚀 Dar inicio a mi idea</span>
            </>
          )}
        </button>

        {/* Fast Mode Trigger Button */}
        <button
          type="button"
          onClick={() => onGenerate('fast')}
          disabled={isGenerating || isUploadingToStorage}
          className="py-3 px-3.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] border border-white/15 text-zinc-200 text-xs font-semibold shadow-sm hover:shadow transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer active:scale-[0.98] flex-shrink-0"
          title="Genera en menos de 4s y ve directo al Estudio Visual"
        >
          {isGenerating && generationMode === 'fast' ? (
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
              ⚡ Generando...
            </span>
          ) : (
            <>
              <span>⚡ Rápido (3s)</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}

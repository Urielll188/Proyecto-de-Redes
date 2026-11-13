'use client'

import React, { useState, useEffect } from 'react'
import imageCompression from 'browser-image-compression'
import { createClient } from '@/utils/supabase/client'
import { uploadVideoToVault } from '@/lib/storage/upload-service'
import { toast } from 'sonner'

export const MAX_FILE_SIZE_BYTES = 40 * 1024 * 1024 // 40 MB
export const ACCEPTED_MEDIA_TYPES = 'image/*,video/mp4,video/quicktime,video/x-m4v'

export interface ProductImageUploadProps {
  userId: string
  onImageUploaded: (publicUrl: string | null, mediaType?: 'image' | 'video', storagePath?: string) => void
  onUploadingChange?: (isUploading: boolean) => void
}

export function ProductImageUpload({ userId, onImageUploaded, onUploadingChange }: ProductImageUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [isVideo, setIsVideo] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const supabase = createClient()

  // Limpieza de memoria al desmontar
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

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
      setUploading(true)
      onUploadingChange?.(true)
      setIsVideo(isVideoFile)
      setFileName(file.name)

      // Previsualización local inmediata
      const objectUrl = URL.createObjectURL(file)
      setPreview(objectUrl)

      if (isVideoFile) {
        // 3A. Flujo de Video: Subida directa a Supabase Storage ('blitzr-vault')
        setUploadProgress('Subiendo video a la bóveda...')
        const toastId = toast.loading('Subiendo video a blitzr-vault (hasta 40MB)...')

        const vaultRes = await uploadVideoToVault(file)

        toast.success('¡Video subido a la bóveda con éxito!', { id: toastId })
        onImageUploaded(vaultRes.publicUrl, 'video', vaultRes.path)
      } else {
        // 3B. Flujo de Imagen: Compresión en cliente + subida a 'product-images'
        setUploadProgress('Optimizando imagen...')
        const toastId = toast.loading('Optimizando y subiendo imagen...')

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
        onImageUploaded(publicUrl, 'image', data.path)
      }
    } catch (err: any) {
      console.error('Error al procesar el archivo:', err)
      toast.error('Error al subir: ' + (err.message || 'Intenta de nuevo'))
      setPreview(null)
      setIsVideo(false)
      setFileName(null)
      onImageUploaded(null)
    } finally {
      setUploading(false)
      onUploadingChange?.(false)
      setUploadProgress(null)
    }
  }

  const handleRemove = () => {
    if (preview) URL.revokeObjectURL(preview)
    setPreview(null)
    setIsVideo(false)
    setFileName(null)
    onUploadingChange?.(false)
    onImageUploaded(null)
  }

  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-300">
        Foto o Video del Producto (Opcional)
      </label>

      <div className="flex items-center gap-4">
        {preview ? (
          <div className="flex items-center gap-3">
            <div className="relative h-24 w-24 rounded-xl overflow-hidden border border-zinc-700 shadow-md bg-zinc-950">
              {isVideo ? (
                <video
                  src={preview}
                  playsInline
                  muted
                  className="h-full w-full object-cover"
                />
              ) : (
                <img
                  src={preview}
                  alt="Previsualización del producto"
                  className="h-full w-full object-cover"
                />
              )}
              {uploading && (
                <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center p-1 text-center">
                  <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mb-1" />
                  <span className="text-[9px] text-zinc-300 font-medium leading-tight">
                    {uploadProgress || 'Subiendo...'}
                  </span>
                </div>
              )}
            </div>
            {!uploading && (
              <div className="flex flex-col gap-1">
                {fileName && (
                  <span className="text-[11px] text-zinc-400 truncate max-w-[180px]">
                    {fileName}
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleRemove}
                  className="text-xs text-red-400 hover:text-red-300 font-medium px-2.5 py-1.5 rounded-lg bg-red-950/40 border border-red-900/50 hover:bg-red-900/60 transition cursor-pointer self-start"
                >
                  ✕ Quitar {isVideo ? 'video' : 'foto'}
                </button>
              </div>
            )}
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-zinc-700/80 hover:border-blue-500/60 rounded-xl cursor-pointer bg-zinc-950/60 hover:bg-zinc-900/60 transition-colors">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <svg className="w-6 h-6 mb-2 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-xs text-zinc-300 font-medium">Haz clic o arrastra la foto o video de tu producto</p>
              <p className="text-[10px] text-zinc-500">Foto o Video (hasta 40MB. MP4 y MOV soportados)</p>
            </div>
            <input
              type="file"
              accept={ACCEPTED_MEDIA_TYPES}
              className="hidden"
              onChange={handleFileChange}
              disabled={uploading}
            />
          </label>
        )}
      </div>
    </div>
  )
}

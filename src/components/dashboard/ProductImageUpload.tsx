'use client'

import React, { useState, useEffect } from 'react'
import imageCompression from 'browser-image-compression'
import { createClient } from '@/utils/supabase/client'
import { toast } from 'sonner'

interface ProductImageUploadProps {
  userId: string
  onImageUploaded: (publicUrl: string | null) => void
}

export function ProductImageUpload({ userId, onImageUploaded }: ProductImageUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
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

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor selecciona un archivo de imagen válido')
      return
    }

    try {
      setUploading(true)
      const toastId = toast.loading('Optimizando y subiendo imagen...')

      // 1. Compresión en cliente
      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1200,
        useWebWorker: true,
      }
      const compressedFile = await imageCompression(file, options)

      // Previsualización local inmediata
      const objectUrl = URL.createObjectURL(compressedFile)
      setPreview(objectUrl)

      // 2. Subida a Supabase Storage
      const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
      const filePath = `${userId}/${Date.now()}_${cleanFileName}`

      const { data, error } = await supabase.storage
        .from('product-images')
        .upload(filePath, compressedFile, {
          cacheControl: '3600',
          upsert: false,
        })

      if (error) throw error

      // 3. Obtener URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(data.path)

      toast.success('¡Imagen optimizada y lista!', { id: toastId })
      onImageUploaded(publicUrl)
    } catch (err: any) {
      console.error('Error al procesar la imagen:', err)
      toast.error('Error al subir: ' + (err.message || 'Intenta de nuevo'))
      setPreview(null)
      onImageUploaded(null)
    } finally {
      setUploading(false)
    }
  }

  const handleRemove = () => {
    if (preview) URL.revokeObjectURL(preview)
    setPreview(null)
    onImageUploaded(null)
  }

  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-300">
        Foto del Producto o Activo (Opcional)
      </label>
      
      <div className="flex items-center gap-4">
        {preview ? (
          <div className="flex items-center gap-3">
            <div className="relative h-24 w-24 rounded-xl overflow-hidden border border-zinc-700 shadow-md bg-zinc-950">
              <img 
                src={preview} 
                alt="Previsualización del producto" 
                className="h-full w-full object-cover"
              />
              {uploading && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            {!uploading && (
              <button
                type="button"
                onClick={handleRemove}
                className="text-xs text-red-400 hover:text-red-300 font-medium px-2.5 py-1.5 rounded-lg bg-red-950/40 border border-red-900/50 hover:bg-red-900/60 transition cursor-pointer"
              >
                ✕ Quitar foto
              </button>
            )}
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-zinc-700/80 hover:border-blue-500/60 rounded-xl cursor-pointer bg-zinc-950/60 hover:bg-zinc-900/60 transition-colors">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <svg className="w-6 h-6 mb-2 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-xs text-zinc-300 font-medium">Haz clic o arrastra la foto de tu producto</p>
              <p className="text-[10px] text-zinc-500">JPG, PNG, WebP (se optimizará a &lt;1MB)</p>
            </div>
            <input 
              type="file" 
              accept="image/*" 
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

'use client'

import { useState, useTransition } from 'react'
import { generateSocialContent } from '@/app/actions/generate-content'
import { ProductImageUpload } from '@/components/dashboard/ProductImageUpload'

interface ContentGeneratorProps {
  userId?: string
}

export function ContentGenerator({ userId }: ContentGeneratorProps) {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<{ instagram?: string; tiktok?: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setResult(null)
    
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const response = await generateSocialContent(formData)
      
      if (response?.error) {
        setError(response.error)
      } else if (response?.success && response.data) {
        setResult(response.data)
      }
    })
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 font-semibold text-gray-900">Crear Nuevo Contenido AI</h3>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {userId && (
          <ProductImageUpload userId={userId} onImageUploaded={setImageUrl} />
        )}
        <input type="hidden" name="imageUrl" value={imageUrl || ''} />

        <div>
          <label htmlFor="topic" className="block text-sm font-medium text-gray-700 mb-1">
            ¿De qué quieres hablar hoy?
          </label>
          <input
            type="text"
            id="topic"
            name="topic"
            required
            placeholder="Ej: 3 mitos sobre el trabajo remoto..."
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            disabled={isPending}
          />
        </div>

        <div>
          <label htmlFor="tone" className="block text-sm font-medium text-gray-700 mb-1">
            Tono de la publicación
          </label>
          <select
            id="tone"
            name="tone"
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
            disabled={isPending}
          >
            <option value="viral">🔥 Viral & Gancho Rápido</option>
            <option value="profesional">💼 Profesional & Corporativo</option>
            <option value="casual">👋 Casual & Cercano</option>
            <option value="educativo">📚 Educativo & Detallado</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isPending ? (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          )}
          {isPending ? 'Generando e invirtiendo 1 crédito...' : 'Generar Contenido (1 Crédito)'}
        </button>
      </form>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-6 space-y-4 border-t border-gray-100 pt-4">
          <div className="rounded-lg bg-gray-50 p-4 border border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-pink-600">Instagram</span>
            </div>
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{result.instagram}</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-4 border border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-black">TikTok</span>
            </div>
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{result.tiktok}</p>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { uploadVideoToVault } from '@/lib/storage/upload-service'

export default function TestLoginPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [videoTitle, setVideoTitle] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [uploadStep, setUploadStep] = useState<string | null>(null)
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null)
  const [result, setResult] = useState<any>(null)
  const [errorStatus, setErrorStatus] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0])
      setErrorStatus(null)
      setResult(null)
      setUploadedUrl(null)
    }
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFile) {
      setErrorStatus('Por favor selecciona un archivo de video MP4')
      return
    }

    setIsUploading(true)
    setErrorStatus(null)
    setResult(null)
    setUploadedUrl(null)

    try {
      // Estado 1: Subida directa al bucket 'blitzr-vault' de Supabase Storage
      setUploadStep('Subiendo video a Supabase Storage (blitzr-vault)...')
      const vaultRes = await uploadVideoToVault(selectedFile)
      setUploadedUrl(vaultRes.publicUrl)

      // Estado 2: Envío de URL al Route Handler de TikTok
      setUploadStep('Inicializando y enviando borrador a TikTok API...')
      const res = await fetch('/api/tiktok/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoUrl: vaultRes.publicUrl,
          storagePath: vaultRes.path,
          fileSize: selectedFile.size,
          title: videoTitle.trim() || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        setErrorStatus(data.error || 'Error en la subida a TikTok')
        setResult(data)
      } else {
        setResult(data)
      }
    } catch (err: any) {
      setErrorStatus(err.message || 'Error en el proceso de carga y distribución')
    } finally {
      setIsUploading(false)
      setUploadStep(null)
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-6 text-center font-sans space-y-6">
      {/* 1. SECCIÓN AUTORIZACIÓN OAUTH */}
      <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl space-y-4">
        <h1 className="text-xl font-bold tracking-tight">
          Blitzr Studio <span className="text-zinc-500">×</span> TikTok
        </h1>
        <p className="text-xs text-zinc-400 leading-relaxed">
          Prueba de apretón de manos OAuth 2.0 y Content Posting API en modo desarrollo.
        </p>
        <a
          href="/api/auth/tiktok"
          className="inline-block w-full py-3 px-6 bg-[#fe2c55] hover:bg-[#e0264b] text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-[#fe2c55]/20 cursor-pointer"
        >
          Conectar con TikTok ➔
        </a>
      </div>

      {/* 2. ARTEFACTO DE PRUEBA: SUBIDA EN BORRADOR VÍA STORAGE */}
      <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl text-left space-y-5">
        <div>
          <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
            <span>🎬</span> Prueba de Publicación en Borrador (Storage ➔ TikTok)
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Sube el archivo a <code className="text-emerald-400">blitzr-vault</code> y envía el borrador a TikTok sin límite de Vercel Serverless.
          </p>
        </div>

        <form onSubmit={handleUpload} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5 uppercase tracking-wider">
              Título del Video (Opcional)
            </label>
            <input
              type="text"
              placeholder="Ej: Anuncio Producto Test"
              value={videoTitle}
              onChange={(e) => setVideoTitle(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-pink-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5 uppercase tracking-wider">
              Archivo de Video MP4
            </label>
            <input
              type="file"
              accept="video/mp4,video/quicktime"
              onChange={handleFileChange}
              className="w-full text-xs text-zinc-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-zinc-800 file:text-zinc-200 hover:file:bg-zinc-700 cursor-pointer"
            />
            {selectedFile && (
              <p className="text-[11px] text-zinc-500 mt-1.5">
                Seleccionado: <strong className="text-zinc-300">{selectedFile.name}</strong> ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isUploading || !selectedFile}
            className="w-full py-3 px-6 bg-gradient-to-r from-[#fe2c55] to-purple-600 hover:opacity-95 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
          >
            {isUploading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>{uploadStep || 'Procesando...'}</span>
              </>
            ) : (
              <span>Subir Video a TikTok (Borrador)</span>
            )}
          </button>
        </form>

        {/* FEEDBACK STATUS */}
        {errorStatus && (
          <div className="p-3.5 bg-red-950/40 border border-red-800/60 rounded-xl text-xs text-red-300 font-medium space-y-1">
            <p className="font-bold flex items-center gap-1.5">⚠️ Error:</p>
            <p>{errorStatus}</p>
          </div>
        )}

        {uploadedUrl && (
          <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-xs space-y-1">
            <p className="font-bold text-zinc-300 flex items-center gap-1.5">
              <span>📦</span> Almacenado en Supabase Storage:
            </p>
            <a
              href={uploadedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 hover:underline truncate block"
            >
              {uploadedUrl}
            </a>
          </div>
        )}

        {result && (
          <div className="space-y-2">
            <p className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
              Respuesta de TikTok API:
            </p>
            <pre className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-[11px] text-emerald-400 overflow-x-auto text-left leading-relaxed">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </main>
  )
}

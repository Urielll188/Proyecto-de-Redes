'use client'

import { useState } from 'react'
import { generateBannerAction } from '@/app/actions/generate-banner'
import { toast } from 'sonner'
import { Sparkles, Eye, Download } from 'lucide-react'

interface GenerateBannerButtonProps {
  contentId: string
  existingBannerUrl?: string | null
  visualPrompt?: string | null
}

export function GenerateBannerButton({ contentId, existingBannerUrl }: GenerateBannerButtonProps) {
  const [loading, setLoading] = useState(false)
  const [bannerUrl, setBannerUrl] = useState<string | null>(existingBannerUrl || null)

  const handleGenerate = async () => {
    setLoading(true)
    const toastId = toast.loading('Componiendo pancarta publicitaria en alta definición...')

    try {
      const res = await generateBannerAction(contentId)
      if (res.success && res.bannerUrl) {
        setBannerUrl(res.bannerUrl)
        toast.success(res.message, { id: toastId })
      } else {
        toast.error(res.message, { id: toastId })
      }
    } catch {
      toast.error('Error de conexión al generar la pancarta', { id: toastId })
    } finally {
      setLoading(false)
    }
  }

  if (bannerUrl) {
    return (
      <div className="space-y-3">
        <div className="relative rounded-xl overflow-hidden border border-emerald-500/40 shadow-lg bg-zinc-950 aspect-[4/5] max-h-56">
          <img src={bannerUrl} alt="Pancarta generada" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-3">
            <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
              ✓ Pancarta Lista (4:5)
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <a
            href={bannerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition border border-zinc-700/60"
          >
            <Eye className="w-3.5 h-3.5" /> Ver Completa
          </a>
          <a
            href={bannerUrl}
            download={`pancarta-${contentId}.png`}
            className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition shadow"
          >
            <Download className="w-3.5 h-3.5" /> Descargar
          </a>
        </div>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={handleGenerate}
      disabled={loading}
      className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-800 disabled:text-zinc-500 text-zinc-950 font-bold rounded-xl text-xs transition-all shadow-md shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer"
    >
      {loading ? (
        <>
          <div className="w-3.5 h-3.5 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
          <span>Diseñando Pancarta...</span>
        </>
      ) : (
        <>
          <Sparkles className="w-3.5 h-3.5" />
          <span>Diseñar Pancarta (2 Créditos)</span>
        </>
      )}
    </button>
  )
}

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CopyButton } from '@/components/dashboard/CopyButton'
import { GenerateBannerButton } from '@/components/dashboard/GenerateBannerButton'
import { QuickShareModal } from '@/components/share/QuickShareModal'
import { ReelPublishButton } from '@/components/dashboard/history/ReelPublishButton'
import { toast } from 'sonner'

export interface VaultItemData {
  id: string
  userId: string
  topic: string
  tone: string
  instagramCopy: string
  tiktokScript: string
  imageUrl: string | null
  visualPrompt: string | null
  bannerUrl: string | null
  createdAt: Date | string
}

interface HistoryClientGridProps {
  vaultItems: VaultItemData[]
}

export function HistoryClientGrid({ vaultItems }: HistoryClientGridProps) {
  // Estado para el modal activo
  const [selectedShareItem, setSelectedShareItem] = useState<{
    mediaUrl: string
    title: string
    caption: string
    fileName: string
  } | null>(null)

  // Estados locales para la publicación directa en Instagram Feed
  const [publishingId, setPublishingId] = useState<string | null>(null)
  const [publishedIds, setPublishedIds] = useState<Set<string>>(new Set())

  const handlePublishInstagram = async (item: VaultItemData) => {
    const imageUrl = item.bannerUrl || item.imageUrl

    if (!imageUrl) {
      toast.error('No hay imagen disponible para publicar en Instagram (genera la pancarta primero)')
      return
    }

    setPublishingId(item.id)
    const toastId = toast.loading('Publicando en tu Feed de Instagram...')

    try {
      const res = await fetch('/api/meta/feed/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl,
          caption: item.instagramCopy || '',
          publicationId: item.id,
        }),
      })

      const data = await res.json()

      if (res.ok && data.success) {
        setPublishedIds((prev) => new Set(prev).add(item.id))
        toast.success('¡Publicado exitosamente en tu Feed de Instagram!', { id: toastId })
      } else {
        toast.error(data.error || 'Error al publicar en Instagram', { id: toastId })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error de conexión al publicar en Instagram'
      toast.error(msg, { id: toastId })
    } finally {
      setPublishingId(null)
    }
  }

  if (vaultItems.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/60 p-12 text-center">
        <p className="text-zinc-400 mb-4 text-sm">Aún no tienes contenido en tu bóveda.</p>
        <Link
          className="inline-block px-5 py-2.5 text-xs font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-500 transition shadow-lg"
          href="/dashboard"
        >
          Generar primera publicación
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {vaultItems.map((item) => {
        const isPublishing = publishingId === item.id
        const isPublished = publishedIds.has(item.id)

        return (
          <div key={item.id} className="rounded-2xl border border-zinc-800/80 bg-zinc-900/90 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
              <div className="flex items-center gap-3">
                {item.imageUrl && (
                  <img
                    src={item.imageUrl}
                    alt="Producto"
                    className="h-12 w-12 rounded-xl object-cover border border-zinc-700 shadow-sm"
                  />
                )}
                <div>
                  <h3 className="font-bold text-zinc-100 capitalize text-base">{item.topic}</h3>
                  <span className="text-xs text-zinc-400">
                    Tono: <strong className="capitalize text-zinc-300">{item.tone}</strong> •{' '}
                    {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {/* Instagram */}
              <div className="rounded-xl bg-zinc-950/80 p-4 border border-zinc-800 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                    <span className="text-xs font-bold uppercase tracking-wider text-pink-400">Instagram</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handlePublishInstagram(item)}
                        disabled={isPublishing || isPublished}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                          isPublished
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                            : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-sm active:scale-95'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {isPublishing ? '⏳ Publicando...' : isPublished ? '✅ Publicado' : '🚀 Publicar en Feed'}
                      </button>
                      <CopyButton text={item.instagramCopy} />
                    </div>
                  </div>
                  <p className="text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed">{item.instagramCopy}</p>
                </div>
              </div>

              {/* TikTok */}
              <div className="rounded-xl bg-zinc-950/80 p-4 border border-zinc-800 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-200">TikTok / Reels</span>
                    <div className="flex items-center gap-2">
                      <ReelPublishButton item={item} />
                      <CopyButton text={item.tiktokScript} />
                    </div>
                  </div>
                  <p className="text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed">{item.tiktokScript}</p>
                </div>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Link
                  href={`/dashboard/${item.id}`}
                  className="px-3.5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium rounded-xl transition-colors border border-zinc-700/60 flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <span>✏️</span> Reanudar en Workspace
                </Link>
                {!item.bannerUrl && (
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedShareItem({
                        mediaUrl: item.imageUrl || '',
                        title: item.topic,
                        caption: item.instagramCopy || item.tiktokScript,
                        fileName: `blitzr-post-${item.id}.png`,
                      })
                    }
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-black text-sm shadow-md transition-all cursor-pointer"
                  >
                    📲 WhatsApp
                  </button>
                )}
              </div>

              <div className="flex-1">
                <GenerateBannerButton
                  contentId={item.id}
                  existingBannerUrl={item.bannerUrl}
                  visualPrompt={item.visualPrompt}
                  onShare={(url) =>
                    setSelectedShareItem({
                      mediaUrl: url,
                      title: item.topic,
                      caption: item.instagramCopy || item.tiktokScript,
                      fileName: `blitzr-pancarta-${item.id}.png`,
                    })
                  }
                />
              </div>
            </div>
          </div>
        )
      })}

      {/* RENDERIZADO DEL MODAL */}
      <QuickShareModal
        isOpen={!!selectedShareItem}
        onClose={() => setSelectedShareItem(null)}
        title={selectedShareItem?.title || ''}
        caption={selectedShareItem?.caption || ''}
        mediaUrl={selectedShareItem?.mediaUrl}
        fileName={selectedShareItem?.fileName}
      />
    </div>
  )
}

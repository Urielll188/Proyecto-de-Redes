'use client'

import React, { useState } from 'react'
import { toBlob } from 'html-to-image'
import { toast } from 'sonner'
import { createClient } from '@/utils/supabase/client'

export async function captureStudioCanvas(): Promise<Blob> {
  if (typeof document !== 'undefined' && document.fonts) {
    await document.fonts.ready
  }

  const canvasElement = document.getElementById('studio-canvas-container')
  if (!canvasElement) {
    throw new Error('No se encontró el contenedor #studio-canvas-container.')
  }

  const blob = await toBlob(canvasElement, {
    quality: 0.98,
    canvasWidth: 1080,
    canvasHeight: 1350,
    pixelRatio: 2,
    cacheBust: true,
    filter: () => true,
  })

  if (!blob) {
    throw new Error('No se pudo generar el archivo PNG HD (1080x1350).')
  }
  return blob
}

export const handleExportBanner = async (userId?: string): Promise<string | undefined> => {
  const toastId = toast.loading('Renderizando anuncio HD (1080×1350)...')

  try {
    const blob = await captureStudioCanvas()

    const supabase = createClient()
    const safeUserId = userId || (await supabase.auth.getUser()).data.user?.id || 'public'
    const filePath = `${safeUserId}/banners/banner-${Date.now()}.png`

    let targetBucket = 'blitzr-vault'
    let { error: uploadError } = await supabase.storage
      .from(targetBucket)
      .upload(filePath, blob, {
        contentType: 'image/png',
        upsert: true,
      })

    if (uploadError) {
      targetBucket = 'product-images'
      const fallbackRes = await supabase.storage
        .from(targetBucket)
        .upload(filePath, blob, {
          contentType: 'image/png',
          upsert: true,
        })
      uploadError = fallbackRes.error
    }

    if (uploadError) {
      throw new Error(`Fallo de Supabase Storage: ${uploadError.message}`)
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(targetBucket).getPublicUrl(filePath)

    toast.success('¡Arte 1080×1350 guardado con éxito en tu Bóveda!', { id: toastId })
    return publicUrl || filePath
  } catch (err: any) {
    console.error('🔥 Error crítico en exportación:', err)
    toast.error(err.message || 'Error al exportar la imagen.', { id: toastId })
    throw err
  }
}

export type StudioStyleTheme =
  | 'minimal-dark'
  | 'bold-retail'
  | 'clean-light'
  | 'Minimal Dark'
  | 'Bold Retail'
  | 'Clean Light'

export interface StudioCanvasPreviewProps {
  sceneUrl?: string | null
  productImageUrl?: string | null
  cutoutProductUrl?: string | null
  isLoadingProduct?: boolean
  headline?: string
  editableHeadline?: string
  subline?: string
  ctaText?: string
  badgeText?: string
  theme?: string
  styleTheme?: StudioStyleTheme
  editableIgCopy?: string
  ratingText?: string
  niche?: string
  cropOffset?: number
  onCropOffsetChange?: (val: number) => void
  productScale?: number
  onProductScaleChange?: (val: number) => void
  productPosX?: number
  onProductPosXChange?: (val: number) => void
  productPosY?: number
  onProductPosYChange?: (val: number) => void
  price?: string
  onPriceChange?: (val: string) => void
  comparePrice?: string
  onComparePriceChange?: (val: string) => void
  featureBadge?: string
  onFeatureBadgeChange?: (val: string) => void
  hideControls?: boolean
}

export function StudioCanvasPreview({
  sceneUrl,
  productImageUrl,
  cutoutProductUrl,
  isLoadingProduct = false,
  headline,
  editableHeadline,
  subline,
  badgeText,
  theme,
  styleTheme = 'minimal-dark',
  editableIgCopy,
  niche,
  cropOffset: propCropOffset,
  onCropOffsetChange,
  productScale: propProductScale,
  onProductScaleChange,
  productPosX: propProductPosX,
  onProductPosXChange,
  productPosY: propProductPosY,
  onProductPosYChange,
  price: propPrice,
  onPriceChange,
  comparePrice: propComparePrice,
  onComparePriceChange,
  hideControls = false,
}: StudioCanvasPreviewProps) {
  const rawTheme = String(theme || styleTheme || 'minimal-dark').toLowerCase()
  const normalizedStyle: 'minimal-dark' | 'clean-light' | 'bold-retail' =
    rawTheme.includes('bold') || rawTheme.includes('retail')
      ? 'bold-retail'
      : rawTheme.includes('clean') || rawTheme.includes('light')
      ? 'clean-light'
      : 'minimal-dark'

  const [internalPrice, setInternalPrice] = useState(propPrice ?? '')
  const [internalComparePrice, setInternalComparePrice] = useState(propComparePrice ?? '')

  const price = propPrice !== undefined ? propPrice : internalPrice
  const setPrice = onPriceChange || setInternalPrice

  const comparePrice = propComparePrice !== undefined ? propComparePrice : internalComparePrice
  const setComparePrice = onComparePriceChange || setInternalComparePrice

  const numPrice = parseFloat(String(price || '').replace(/[^0-9.]/g, '')) || 0
  const numCompare = parseFloat(String(comparePrice || '').replace(/[^0-9.]/g, '')) || 0
  const discountPercent =
    numCompare > numPrice && numPrice > 0
      ? Math.round(((numCompare - numPrice) / numCompare) * 100)
      : null

  const formatCurrency = (val: number) => val.toLocaleString('es-MX')

  const [internalProductScale, setInternalProductScale] = useState(1.0)
  const [internalProductPosX, setInternalProductPosX] = useState(0)
  const [internalProductPosY, setInternalProductPosY] = useState(propCropOffset ?? 0)

  const productScale = propProductScale !== undefined ? propProductScale : internalProductScale
  const setProductScale = onProductScaleChange || setInternalProductScale

  const productPosX = propProductPosX !== undefined ? propProductPosX : internalProductPosX
  const setProductPosX = onProductPosXChange || setInternalProductPosX

  const productPosY =
    propProductPosY !== undefined
      ? propProductPosY
      : propCropOffset !== undefined
      ? propCropOffset
      : internalProductPosY
  const setProductPosY = onProductPosYChange || onCropOffsetChange || setInternalProductPosY

  const activeProductUrl = cutoutProductUrl || productImageUrl
  const hasDistinctProductImage = Boolean(
    activeProductUrl &&
      activeProductUrl !== sceneUrl &&
      !activeProductUrl.includes('studio-scenes') &&
      !activeProductUrl.includes('unsplash.com')
  )

  const effectiveHeadline = (editableHeadline || headline || 'EDICIÓN ESPECIAL').trim()
  const effectiveBadge = (badgeText || '').trim()
  const effectiveSubline = (subline || editableIgCopy || '').trim().slice(0, 125)

  return (
    <div className="w-full max-w-[440px] mx-auto space-y-3">
      {/* ================= LIENZO UNIFICADO 4:5 (EXPORTABLE A 1080×1350 PX HD) ================= */}
      <div
        id="studio-canvas-container"
        className="relative w-full aspect-[4/5] overflow-hidden rounded-2xl bg-zinc-950 shadow-[0_25px_60px_rgba(0,0,0,0.75)] border border-white/10 select-none flex flex-col justify-between"
      >
        {/* CAPA 1: FONDO FOTOGRÁFICO IA (Nítido, sin blur destructivo ni paisajes genéricos) */}
        {sceneUrl ? (
          <img
            src={sceneUrl}
            alt="Escenario de Estudio IA"
            crossOrigin="anonymous"
            className="absolute inset-0 w-full h-full object-cover z-0"
          />
        ) : (
          <div
            className={`absolute inset-0 z-0 ${
              normalizedStyle === 'clean-light'
                ? 'bg-gradient-to-b from-slate-100 via-slate-200 to-slate-300'
                : normalizedStyle === 'bold-retail'
                ? 'bg-gradient-to-b from-zinc-900 via-zinc-950 to-black'
                : 'bg-gradient-to-b from-zinc-900 via-slate-950 to-black'
            }`}
          />
        )}

        {/* Vignette / Gradiente Editorial Sutil para Legibilidad Tipográfica */}
        <div
          className={`absolute inset-0 pointer-events-none z-10 transition-all duration-300 ${
            normalizedStyle === 'clean-light'
              ? 'bg-gradient-to-b from-black/55 via-transparent to-black/70'
              : normalizedStyle === 'bold-retail'
              ? 'bg-gradient-to-b from-black/80 via-black/15 to-black/90'
              : 'bg-gradient-to-b from-black/75 via-transparent to-black/85'
          }`}
        />

        {/* CAPA 3A (SUPERIOR): TIPOGRAFÍA EDITORIAL Y BADGE LIMPIO */}
        <div className="relative z-30 px-6 pt-6 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            {effectiveBadge ? (
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-[0.14em] shadow-lg ${
                  normalizedStyle === 'bold-retail'
                    ? 'bg-amber-400 text-zinc-950'
                    : normalizedStyle === 'clean-light'
                    ? 'bg-white/95 text-zinc-900'
                    : 'bg-white/15 text-white border border-white/25 backdrop-blur-md'
                }`}
              >
                {effectiveBadge}
              </span>
            ) : (
              <span />
            )}

            {discountPercent && discountPercent > 0 && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-rose-600 text-white text-[10px] font-black uppercase tracking-wider shadow-lg">
                -{discountPercent}% OFF
              </span>
            )}
          </div>

          <h2
            className={`font-black tracking-tight uppercase leading-[1.08] text-balance break-words drop-shadow-[0_4px_16px_rgba(0,0,0,0.75)] ${
              normalizedStyle === 'bold-retail'
                ? 'text-2xl sm:text-[26px] text-amber-300'
                : 'text-xl sm:text-[24px] text-white'
            }`}
          >
            {effectiveHeadline}
          </h2>

          {effectiveSubline && (
            <p className="text-xs sm:text-[13px] text-zinc-200/95 font-medium leading-snug line-clamp-2 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] max-w-[92%]">
              {effectiveSubline}
            </p>
          )}
        </div>

        {/* CAPA 2 (CENTRAL): PRODUCTO RECORTADO CONDICIONAL CON SOMBRA DE CONTACTO REAL */}
        <div className="relative z-20 flex-1 flex items-center justify-center px-6 my-1">
          {isLoadingProduct ? (
            <div className="px-4 py-2 rounded-full bg-black/75 border border-white/15 text-white text-xs font-medium backdrop-blur-md animate-pulse">
              ✨ Integrando producto sin fondo...
            </div>
          ) : hasDistinctProductImage && activeProductUrl ? (
            <div className="relative flex items-center justify-center w-full h-full">
              {/* Sombra de contacto sobre el podio */}
              <div
                className="absolute bottom-3 w-[62%] h-5 rounded-full bg-black/70 blur-md pointer-events-none"
                style={{
                  transform: `translate(${productPosX * 0.5}px, ${Math.min(20, productPosY * 0.4)}px) scale(${productScale})`,
                }}
              />
              <img
                src={activeProductUrl}
                alt="Producto integrado"
                crossOrigin="anonymous"
                className="max-h-[250px] sm:max-h-[275px] w-auto object-contain select-none pointer-events-none transition-transform duration-150 drop-shadow-[0_22px_28px_rgba(0,0,0,0.68)]"
                style={{
                  transform: `translate(${productPosX}px, ${productPosY}px) scale(${productScale})`,
                }}
              />
            </div>
          ) : null}
        </div>

        {/* CAPA 3B (INFERIOR): ETIQUETA EDITORIAL DE PRECIO (SIN BOTONES FALSOS NI TEXTOS RESIDUALES) */}
        <div className="relative z-30 px-6 pb-6 flex items-end justify-start gap-3">
          {numPrice > 0 && (
            <div
              className={`inline-flex items-baseline gap-2.5 px-4 py-2 rounded-2xl shadow-xl backdrop-blur-md ${
                normalizedStyle === 'bold-retail'
                  ? 'bg-amber-400 text-zinc-950'
                  : normalizedStyle === 'clean-light'
                  ? 'bg-white/95 text-zinc-950'
                  : 'bg-zinc-950/85 text-white border border-white/15'
              }`}
            >
              {numCompare > numPrice && (
                <span
                  className={`text-xs line-through font-semibold ${
                    normalizedStyle === 'minimal-dark' ? 'text-zinc-400' : 'text-zinc-600'
                  }`}
                >
                  ${formatCurrency(numCompare)}
                </span>
              )}
              <span className="text-lg sm:text-xl font-black tracking-tight">
                ${formatCurrency(numPrice)} <span className="text-[11px] font-bold">MXN</span>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* CONTROLES RÁPIDOS DE ESCALA Y POSICIÓN (FUERA DEL LIENZO EXPORTABLE) */}
      {!hideControls && hasDistinctProductImage && (
        <div className="p-3 rounded-xl bg-zinc-900/90 border border-white/10 space-y-2.5">
          <div className="flex items-center justify-between text-[11px] font-bold text-zinc-300 uppercase tracking-wider">
            <span>📐 Ajuste Fino del Producto en Escena</span>
            <button
              type="button"
              onClick={() => {
                setProductScale(1.0)
                setProductPosX(0)
                setProductPosY(0)
              }}
              className="text-[10px] text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
            >
              Centrar (1.0x)
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-zinc-400">
                <span>Escala (0.6x – 1.5x)</span>
                <span className="text-cyan-300 font-mono font-bold">{productScale.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min="0.6"
                max="1.5"
                step="0.05"
                value={productScale}
                onChange={(e) => setProductScale(Number(e.target.value))}
                className="w-full accent-cyan-400 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-zinc-400">
                <span>Altura Vertical</span>
                <span className="text-purple-300 font-mono font-bold">{productPosY}px</span>
              </div>
              <input
                type="range"
                min="-60"
                max="80"
                step="2"
                value={productPosY}
                onChange={(e) => setProductPosY(Number(e.target.value))}
                className="w-full accent-purple-400 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import React, { useState } from 'react'
import { toBlob } from 'html-to-image'
import { toast } from 'sonner'
import { createClient } from '@/utils/supabase/client'

export async function captureStudioCanvas(): Promise<Blob> {
  // 1. Barrera de sincronización: Esperar a que el navegador resuelva todas las fuentes
  if (typeof document !== 'undefined' && document.fonts) {
    await document.fonts.ready
  }

  const canvasElement = document.getElementById('studio-canvas-container')
  if (!canvasElement) {
    throw new Error('No se encontró el contenedor #studio-canvas-container.')
  }

  // 2. Renderizado nativo a Blob (compatible con lab(), oklch() y Tailwind moderno)
  const blob = await toBlob(canvasElement, {
    quality: 0.95,
    pixelRatio: 2, // Calidad retina 2x nítida
    cacheBust: true,
    filter: () => true,
  })

  if (!blob) {
    throw new Error('No se pudo generar el archivo de imagen del anuncio.')
  }
  return blob
}

export const handleExportBanner = async (userId?: string): Promise<string | undefined> => {
  const toastId = toast.loading('Renderizando anuncio en alta resolución...')

  try {
    // 1. Asegurar carga de tipografías web
    if (typeof document !== 'undefined' && document.fonts) {
      await document.fonts.ready
    }

    const canvasElement = document.getElementById('studio-canvas-container')
    if (!canvasElement) {
      throw new Error('No se encontró el contenedor #studio-canvas-container.')
    }

    // 2. Renderizado nativo a Blob (compatible con lab(), oklch() y Tailwind moderno)
    const blob = await toBlob(canvasElement, {
      quality: 0.95,
      pixelRatio: 2, // Calidad retina 2x nítida
      cacheBust: true,
      filter: (node) => {
        // Excluir elementos que no deban salir en el anuncio si los hubiera
        return true
      },
    })

    if (!blob) {
      throw new Error('No se pudo generar el archivo de imagen del anuncio.')
    }

    // 3. Subida directa a Supabase Storage (con respaldo a product-images)
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

    toast.success('¡Pancarta guardada con éxito en tu Bóveda!', { id: toastId })
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

export const THEMES = {
  'Minimal Dark': {
    overlay: 'bg-gradient-to-b from-black/85 via-transparent to-black/90',
    headline: 'text-white',
    subline: 'text-zinc-300',
    watermark: 'text-white/[0.04]',
    shelf: 'via-white/30',
    badgeBg: 'bg-zinc-900/95 border-white/15 text-white',
    offerBadge: 'bg-red-600 text-white font-black',
    priceOriginal: 'text-zinc-500',
    priceCurrent: 'text-emerald-400',
  },
  'Bold Retail': {
    overlay: 'bg-gradient-to-b from-black/85 via-transparent to-black/90',
    headline: 'text-amber-400',
    subline: 'text-zinc-200',
    watermark: 'text-amber-400/[0.05]',
    shelf: 'via-amber-400/40',
    badgeBg: 'bg-zinc-900/95 border-amber-400/30 text-amber-300',
    offerBadge: 'bg-amber-400 text-black font-black',
    priceOriginal: 'text-zinc-400',
    priceCurrent: 'text-amber-400',
  },
  'Clean Light': {
    overlay: 'bg-gradient-to-b from-white/90 via-transparent to-white/95',
    headline: 'text-zinc-950',
    subline: 'text-zinc-700',
    watermark: 'text-black/[0.04]',
    shelf: 'via-zinc-400/40',
    badgeBg: 'bg-white/90 border-zinc-200 text-zinc-800 shadow-sm',
    offerBadge: 'bg-red-600 text-white font-black',
    priceOriginal: 'text-zinc-400',
    priceCurrent: 'text-emerald-600',
  },
  'minimal-dark': {
    overlay: 'bg-gradient-to-b from-black/85 via-transparent to-black/90',
    headline: 'text-white',
    subline: 'text-zinc-300',
    watermark: 'text-white/[0.04]',
    shelf: 'via-white/30',
    badgeBg: 'bg-zinc-900/95 border-white/15 text-white',
    offerBadge: 'bg-red-600 text-white font-black',
    priceOriginal: 'text-zinc-500',
    priceCurrent: 'text-emerald-400',
  },
  'bold-retail': {
    overlay: 'bg-gradient-to-b from-black/85 via-transparent to-black/90',
    headline: 'text-amber-400',
    subline: 'text-zinc-200',
    watermark: 'text-amber-400/[0.05]',
    shelf: 'via-amber-400/40',
    badgeBg: 'bg-zinc-900/95 border-amber-400/30 text-amber-300',
    offerBadge: 'bg-amber-400 text-black font-black',
    priceOriginal: 'text-zinc-400',
    priceCurrent: 'text-amber-400',
  },
  'clean-light': {
    overlay: 'bg-gradient-to-b from-white/90 via-transparent to-white/95',
    headline: 'text-zinc-950',
    subline: 'text-zinc-700',
    watermark: 'text-black/[0.04]',
    shelf: 'via-zinc-400/40',
    badgeBg: 'bg-white/90 border-zinc-200 text-zinc-800 shadow-sm',
    offerBadge: 'bg-red-600 text-white font-black',
    priceOriginal: 'text-zinc-400',
    priceCurrent: 'text-emerald-600',
  },
} as const

export interface StudioCanvasPreviewProps {
  sceneUrl: string
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
}

export function StudioCanvasPreview({
  sceneUrl,
  productImageUrl,
  cutoutProductUrl,
  isLoadingProduct = false,
  headline,
  editableHeadline,
  subline,
  ctaText,
  badgeText,
  theme,
  styleTheme = 'minimal-dark',
  editableIgCopy,
  ratingText,
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
  featureBadge: propFeatureBadge,
  onFeatureBadgeChange,
}: StudioCanvasPreviewProps) {
  // Selección del tema activo desde el objeto centralizado THEMES
  const themeKey = (theme || styleTheme) as keyof typeof THEMES
  const currentTheme = THEMES[themeKey] || THEMES['Minimal Dark']

  // Estados y sanitización de precios dinámicos
  const [internalPrice, setInternalPrice] = useState(propPrice ?? '350')
  const [internalComparePrice, setInternalComparePrice] = useState(propComparePrice ?? '500')
  const [internalFeatureBadge, setInternalFeatureBadge] = useState(
    propFeatureBadge ?? 'Calidad Garantizada'
  )

  const price = propPrice !== undefined ? propPrice : internalPrice
  const setPrice = onPriceChange || setInternalPrice

  const comparePrice = propComparePrice !== undefined ? propComparePrice : internalComparePrice
  const setComparePrice = onComparePriceChange || setInternalComparePrice

  const featureBadge = propFeatureBadge !== undefined ? propFeatureBadge : internalFeatureBadge
  const setFeatureBadge = onFeatureBadgeChange || setInternalFeatureBadge

  // Cálculo seguro de precios y porcentaje de descuento
  const numPrice = parseFloat(price.replace(/[^0-9.]/g, '')) || 0
  const numCompare = parseFloat(comparePrice.replace(/[^0-9.]/g, '')) || 0
  const discountPercent =
    numCompare > numPrice && numCompare > 0
      ? Math.round(((numCompare - numPrice) / numCompare) * 100)
      : null

  const formatCurrency = (val: number) => {
    return val.toLocaleString('es-MX')
  }

  // Estados de transformación (Escala, Eje X, Eje Y / Guillotina)
  const [internalProductScale, setInternalProductScale] = useState(1.0)
  const [internalProductPosX, setInternalProductPosX] = useState(0)
  const [internalProductPosY, setInternalProductPosY] = useState(propCropOffset ?? 15)

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
      !activeProductUrl.includes('studio-scenes')
  )

  const effectiveHeadline = editableHeadline || headline || 'NUEVO LANZAMIENTO'
  const effectiveBadge = badgeText?.trim() || 'OFERTA'
  const effectiveBenefit =
    editableIgCopy?.trim() || subline?.trim() || 'Calidad garantizada para tu día a día.'

  return (
    <div className="w-full max-w-sm mx-auto">
      {/* Lienzo 4:5 */}
      <div
        id="studio-canvas-container"
        className="relative w-full aspect-[4/5] overflow-hidden rounded-2xl bg-zinc-950 shadow-2xl border border-zinc-800/80 select-none group flex flex-col justify-between"
      >
        {/* 1. FONDO DE ESCENA (Con blindaje CORS) */}
        {sceneUrl && (
          <img
            src={sceneUrl}
            alt="Fondo de estudio"
            crossOrigin="anonymous"
            className="absolute inset-0 w-full h-full object-cover blur-[6px] scale-110 z-0"
          />
        )}

        {/* 2. GRADIENTES DE CONTRASTE Y WATERMARK */}
        <div
          className={`absolute inset-0 ${currentTheme.overlay} pointer-events-none z-10 transition-colors duration-200`}
        />

        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-10 overflow-hidden">
          <span
            className={`text-[85px] font-black uppercase ${currentTheme.watermark} tracking-widest whitespace-nowrap leading-none scale-150 rotate-[-2deg] transition-colors duration-200`}
          >
            {niche ? niche.split(' ')[0] : 'PREMIUM'}
          </span>
        </div>

        {/* 3. CABECERA Y TITULAR */}
        <div className="relative z-20 px-5 pt-5">
          <div className="flex items-center justify-between mb-3">
            <div
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-bold shadow-md transition-colors duration-200 ${currentTheme.badgeBg}`}
            >
              <span>⭐⭐⭐⭐⭐</span>
              <span>{ratingText || '4.9/5 Calidad'}</span>
            </div>
            <div
              className={`px-2.5 py-1 rounded text-[10px] uppercase shadow-lg rotate-2 transition-colors duration-200 ${currentTheme.offerBadge}`}
            >
              {effectiveBadge}
            </div>
          </div>

          <h2
            className={`text-[20px] font-black tracking-tight uppercase leading-[1.15] drop-shadow-md text-balance break-words transition-colors duration-200 ${currentTheme.headline}`}
          >
            {editableHeadline || headline || 'NUEVO LANZAMIENTO'}
          </h2>
          <div
            className={`mt-2 text-xs font-medium line-clamp-2 text-balance drop-shadow-md transition-colors duration-200 ${currentTheme.subline}`}
          >
            <span className="text-emerald-500 font-bold mr-1">✓</span>
            {effectiveBenefit}
          </div>
        </div>

        {/* 4. CONTENEDOR HERO, STICKERS Y GUILLOTINA DE 3 EJES */}
        <div className="relative z-20 flex-1 flex flex-col justify-end items-center pb-2 w-full">
          {/* Callout Izquierdo Dinámico */}
          <div
            className={`absolute left-3 top-[35%] z-30 flex items-center gap-1 px-2.5 py-1 rounded-full border text-[9px] font-bold shadow-xl rotate-[3deg] transition-colors duration-200 ${currentTheme.badgeBg}`}
          >
            <span className="text-emerald-400">✦</span>{' '}
            {featureBadge || (niche?.toLowerCase().includes('tech') ? 'Alto Rendimiento' : 'Calidad Premium')}
          </div>

          {/* Sticker Diagonal Derecho (Solo con descuento real) */}
          {discountPercent && discountPercent > 0 && (
            <div
              className={`absolute right-3 top-[25%] z-30 px-2.5 py-1 rounded-md ${currentTheme.offerBadge} text-[9px] uppercase tracking-wider shadow-2xl border border-black rotate-[-10deg]`}
            >
              🔥 OFERTA HOY
            </div>
          )}

          {/* Guillotina Rígida de 3 Ejes (h-[220px] con corte inferior) */}
          <div className="relative flex justify-center w-full h-[220px] overflow-hidden border-b border-transparent z-10">
            {isLoadingProduct ? (
              <div
                className={`text-xs px-3.5 py-2 rounded-full border animate-pulse flex items-center gap-2 m-auto ${currentTheme.badgeBg}`}
              >
                <span>✨</span>
                <span>Aislando producto de su fondo...</span>
              </div>
            ) : hasDistinctProductImage && activeProductUrl ? (
              <img
                src={activeProductUrl}
                alt="Producto"
                crossOrigin="anonymous"
                className="object-contain transition-transform duration-100 select-none pointer-events-none"
                style={{
                  width: '100%',
                  maxHeight: '350px',
                  transform: `translate(${productPosX}px, ${productPosY}px) scale(${productScale})`,
                  filter: 'drop-shadow(0px 10px 15px rgba(0,0,0,0.9))',
                }}
              />
            ) : null}
          </div>

          {/* Base Shelf de anclaje */}
          <div
            className={`w-[75%] h-[3px] bg-gradient-to-r from-transparent ${currentTheme.shelf} to-transparent drop-shadow-lg z-20 transition-all duration-200`}
          />
        </div>

        {/* 5. PIE DE CONVERSIÓN Y CTA */}
        <div className="relative z-20 px-5 pb-5 flex flex-col items-center gap-1.5 w-full">
          {numPrice > 0 && (
            <div className="flex items-center justify-center gap-2">
              {/* Precio tachado: solo si existe y es mayor al precio de venta */}
              {numCompare > numPrice && (
                <span className={`text-[10px] line-through font-semibold transition-colors duration-200 ${currentTheme.priceOriginal}`}>
                  ${formatCurrency(numCompare)}
                </span>
              )}

              {/* Precio de venta */}
              <span className={`text-sm font-black tracking-tight transition-colors duration-200 ${currentTheme.priceCurrent}`}>
                ${formatCurrency(numPrice)} MXN
              </span>

              {/* Badge de Ahorro: porcentaje calculado o badge estático */}
              {discountPercent ? (
                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase transition-colors duration-200 ${currentTheme.offerBadge}`}>
                  Ahorra {discountPercent}%
                </span>
              ) : (
                <span className="text-[8px] font-bold px-1.5 py-0.5 rounded uppercase bg-emerald-600/90 text-white">
                  Envío Inmediato
                </span>
              )}
            </div>
          )}

          {/* Botón CTA */}
          <button
            type="button"
            className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-extrabold text-[11px] tracking-wider uppercase shadow-xl hover:scale-[1.02] transition-transform cursor-pointer"
          >
            {ctaText ? `${ctaText.toUpperCase()} ➔` : 'PEDIR POR WHATSAPP ➔'}
          </button>
        </div>
      </div>

      {/* Inputs de Edición de Precios y Callout */}
      <div className="grid grid-cols-2 gap-3 mt-4 p-3 rounded-xl bg-zinc-900 border border-white/10">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
            Precio Actual (MXN)
          </label>
          <input
            type="text"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Ej: 350"
            className="bg-black/60 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
            Precio Anterior (Tachado)
          </label>
          <input
            type="text"
            value={comparePrice}
            onChange={(e) => setComparePrice(e.target.value)}
            placeholder="Opcional. Ej: 500"
            className="bg-black/60 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
          />
        </div>
        <div className="col-span-2 flex flex-col gap-1">
          <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
            Callout de Valor (Izquierda)
          </label>
          <input
            type="text"
            value={featureBadge}
            onChange={(e) => setFeatureBadge(e.target.value)}
            placeholder="Ej: Calidad Garantizada"
            className="bg-black/60 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Panel de Calibración 3D (Escala, X, Y) */}
      <div className="mt-4 p-3 rounded-xl bg-zinc-900 border border-white/10 space-y-3">
        <div className="flex items-center justify-between text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
          <span>🎛️ Calibración de Producto</span>
          <button
            type="button"
            onClick={() => {
              setProductScale(1.0)
              setProductPosX(0)
              setProductPosY(15)
            }}
            className="hover:text-white underline cursor-pointer"
          >
            Restablecer
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {/* Slider Escala */}
          <div className="space-y-1">
            <div className="flex justify-between text-[9px] text-zinc-500">
              <span>Tamaño</span>
              <span className="text-emerald-400 font-bold">{Math.round(productScale * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="1.5"
              step="0.05"
              value={productScale}
              onChange={(e) => setProductScale(Number(e.target.value))}
              className="w-full accent-blue-500 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>
          {/* Slider X */}
          <div className="space-y-1">
            <div className="flex justify-between text-[9px] text-zinc-500">
              <span>Eje X</span>
              <span className="text-blue-400 font-bold">{productPosX}px</span>
            </div>
            <input
              type="range"
              min="-100"
              max="100"
              step="2"
              value={productPosX}
              onChange={(e) => setProductPosX(Number(e.target.value))}
              className="w-full accent-blue-500 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>
          {/* Slider Y */}
          <div className="space-y-1">
            <div className="flex justify-between text-[9px] text-zinc-500">
              <span>Eje Y (Corte)</span>
              <span className="text-purple-400 font-bold">{productPosY}px</span>
            </div>
            <input
              type="range"
              min="-50"
              max="150"
              step="2"
              value={productPosY}
              onChange={(e) => setProductPosY(Number(e.target.value))}
              className="w-full accent-blue-500 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

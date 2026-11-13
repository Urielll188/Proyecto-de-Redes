'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ProductImageUpload } from './ProductImageUpload'
import { GenerateBannerButton } from './GenerateBannerButton'
import { ReelPublishButton } from './history/ReelPublishButton'
import { QuickShareModal } from '@/components/share/QuickShareModal'
import { StudioCanvasPreview, type StudioStyleTheme } from './visual/StudioCanvasPreview'
import { refineCopyAction } from '@/app/actions/refine-copies'
import { toast } from 'sonner'
import { Sparkles, Send, Copy, Palette } from 'lucide-react'
import { InstagramMockup } from './mockups/InstagramMockup'
import { createClient } from '@/utils/supabase/client'
import { toBlob } from 'html-to-image'

const NICHE_OPTIONS = [
  'Producto Físico',
  'Servicio Local',
  'E-commerce',
  'Marca Personal',
] as const

const GOAL_OPTIONS = [
  'Venta Inmediata',
  'Generar Leads / Citas',
  'Autoridad',
] as const

export interface CmoAnalysisData {
  avatar?: string
  angle?: string
  irresistibleOffer?: string
}

interface CampaignGeneratedData {
  headline?: string
  igCopy?: string
  tiktokScript?: string
  whatsappCopy?: string
  cmoAnalysis?: CmoAnalysisData | null
  titulo_campana?: string
  veredicto_cmo?: string
  estrategia?: {
    avatar_cliente: string
    angulo_gancho: string
    oferta_irresistible: string
  }
  fase_1_atraccion_reels_tiktok?: {
    hook_visual_0_a_3s: string
    guion_desarrollo: string
    copy_pie_video: string
  }
  fase_2_consideracion_feed?: {
    copy_principal: string
    llamado_a_la_accion: string
  }
  fase_3_cierre_whatsapp?: {
    texto_estado: string
  }
}

interface InitialCampaignData {
  id: string
  productDesc: string
  imageUrl?: string | null
  bannerUrl?: string | null
  strategyData?: {
    buyerPersona?: { content: string; reasoning: string | null }
    postingTips?: { content: string; reasoning: string | null }
    photoAdvice?: { content: string; reasoning: string | null }
    salesAngle?: { content: string; reasoning: string | null }
  } | null
  copies?: {
    instagramCopy: string
    tiktokScript: string
    whatsapp?: {
      ficha: string
      objecionPrecio: string
      objecionConfianza: string
    }
  } | null
}

interface EmpresaStepperProps {
  userId: string
  initialData?: InitialCampaignData | null
}

export function EmpresaStepper({ userId, initialData }: EmpresaStepperProps) {
  const router = useRouter()
  const hasInitialCampaign = Boolean(initialData?.copies || initialData?.strategyData)

  // Paso 1: Ingesta | Paso 2: Centro de Mando | Paso 3: Generación Visual de Estudio
  const [step, setStep] = useState<1 | 2 | 3>(hasInitialCampaign ? 2 : 1)

  // Entradas del Paso 1
  const [imageUrl, setImageUrl] = useState<string | null>(initialData?.imageUrl || null)
  const [mediaType, setMediaType] = useState<'image' | 'video'>(
    initialData?.imageUrl && /\.(mp4|mov|m4v|webm)(\?.*)?$/i.test(initialData.imageUrl)
      ? 'video'
      : 'image'
  )
  const [storagePath, setStoragePath] = useState<string | null>(null)
  const [productDesc, setProductDesc] = useState(initialData?.productDesc || '')
  const [bannerUrl, setBannerUrl] = useState<string | null>(initialData?.bannerUrl || null)
  const [niche, setNiche] = useState<string>('Producto Físico')
  const [goal, setGoal] = useState<string>('Venta Inmediata')

  // ID de persistencia en BD
  const [publicationId, setPublicationId] = useState<string | null>(initialData?.id || null)

  // Datos estratégicos devueltos por Gemini (/api/generate)
  const [campaignData, setCampaignData] = useState<CampaignGeneratedData | null>(
    hasInitialCampaign
      ? {
          titulo_campana: initialData?.productDesc || 'Campaña Estratégica',
          veredicto_cmo:
            initialData?.strategyData?.salesAngle?.reasoning ||
            initialData?.strategyData?.buyerPersona?.reasoning ||
            'Estrategia optimizada para atacar la objeción principal del comprador y acelerar la conversión directa.',
          estrategia: {
            avatar_cliente:
              initialData?.strategyData?.buyerPersona?.content ||
              'Comprador interesado en beneficios inmediatos y garantía.',
            angulo_gancho:
              initialData?.strategyData?.salesAngle?.content ||
              'Demostración directa de valor frente al problema principal.',
            oferta_irresistible:
              initialData?.strategyData?.postingTips?.content ||
              'Atención personalizada y disponibilidad inmediata.',
          },
        }
      : null
  )

  // Desacoplamiento de flujo: Fast vs Strategic y estado de análisis CMO
  const [cmoAnalysis, setCmoAnalysis] = useState<CmoAnalysisData | null>(
    hasInitialCampaign
      ? {
          avatar: initialData?.strategyData?.buyerPersona?.content || undefined,
          angle: initialData?.strategyData?.salesAngle?.content || undefined,
          irresistibleOffer: initialData?.strategyData?.postingTips?.content || undefined,
        }
      : null
  )
  const [generationMode, setGenerationMode] = useState<'fast' | 'strategic'>('strategic')

  // Estados locales EDITABLES para las 3 fases del embudo
  const [editableIgCopy, setEditableIgCopy] = useState<string>(
    initialData?.copies?.instagramCopy || ''
  )
  const [editableTtScript, setEditableTtScript] = useState<string>(
    initialData?.copies?.tiktokScript || ''
  )
  const [editableWaText, setEditableWaText] = useState<string>(
    initialData?.copies?.whatsapp?.ficha || ''
  )

  // ===================== ESTADOS PASO 3: GENERACIÓN VISUAL DE ESTUDIO =====================
  const [sceneUrl, setSceneUrl] = useState<string | null>(
    initialData?.bannerUrl ||
      'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=1080&q=80'
  )
  const setVisualOutput = (url: string | null) => setSceneUrl(url)
  const [isGeneratingScene, setIsGeneratingScene] = useState(false)
  const [cutoutProductUrl, setCutoutProductUrl] = useState<string | null>(null)
  const [isRemovingBg, setIsRemovingBg] = useState(false)
  const [useCutout, setUseCutout] = useState(true)
  const [isBakingBanner, setIsBakingBanner] = useState(false)
  const [headline, setHeadline] = useState(
    initialData?.productDesc ? initialData.productDesc.slice(0, 32).toUpperCase() : 'LOOK LIKE YOU, ON YOUR BEST DAY'
  )
  const [subline, setSubline] = useState('Reacts hook like you, on your best day.')
  const [ctaText, setCtaText] = useState('Pedir por WhatsApp')
  const [badgeText, setBadgeText] = useState('OFERTA EXCLUSIVA')
  const [styleTheme, setStyleTheme] = useState<StudioStyleTheme>('minimal-dark')

  // Estados de carga y publicación
  const [isUploadingToStorage, setIsUploadingToStorage] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isPublishingFeed, setIsPublishingFeed] = useState(false)
  const [isFeedPublished, setIsFeedPublished] = useState(false)
  const [isPublishingTikTok, setIsPublishingTikTok] = useState(false)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)

  // Copiloto de refinamiento
  const [refinementPrompt, setRefinementPrompt] = useState('')
  const [isRefining, setIsRefining] = useState(false)

  const uploadedMediaUrl = bannerUrl || imageUrl
  const isVideoMedia =
    mediaType === 'video' || /\.(mp4|mov|m4v|webm)(\?.*)?$/i.test(uploadedMediaUrl || '')

  // Objeto Proxy reactivo conectado a los estados editables para inyectar en botones de publicación
  const publicationProxy = {
    id: publicationId || '',
    videoUrl: isVideoMedia ? uploadedMediaUrl : null,
    imageUrl: uploadedMediaUrl,
    bannerUrl: uploadedMediaUrl,
    publicUrl: uploadedMediaUrl,
    instagramCopy: editableIgCopy,
    tiktokScript: editableTtScript,
    facebookCopy: editableIgCopy,
  }

  // 1. Generador Desacoplado con Gemini (/api/generate/cmo)
  const handleGenerate = async (mode: 'fast' | 'strategic' = 'strategic') => {
    if (!productDesc.trim()) {
      toast.error('Por favor describe brevemente qué vas a vender')
      return
    }

    // 1. Limpieza de estado previo para evitar mezcla de estados
    setIsGenerating(true)
    setCmoAnalysis(null)
    setGenerationMode(mode)

    const toastId = toast.loading(
      mode === 'fast'
        ? '⚡ Generando despliegue rápido de copys y titular...'
        : '🧠 El CMO está diseñando tu estrategia y embudo de conversión...'
    )

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 58000) // 58s límite cliente

    try {
      const response = await fetch('/api/generate/cmo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          prompt: productDesc.trim(),
          context: productDesc.trim(),
          imageUrl,
          isVideo: isVideoMedia,
          niche,
          goal,
          objective: goal,
          generationMode: mode,
        }),
      })

      if (!response.ok) {
        const rawText = await response.text()
        let cleanMessage = rawText
        try {
          const parsedErr = JSON.parse(rawText)
          if (parsedErr.error) cleanMessage = parsedErr.error
        } catch {
          cleanMessage = rawText.slice(0, 250)
        }
        throw new Error(
          response.status === 504
            ? 'El servidor tardó demasiado (Timeout 504). Intenta de nuevo.'
            : cleanMessage
        )
      }

      const apiResponse = await response.json()

      if (!apiResponse.success || (!apiResponse.data && !apiResponse.headline)) {
        throw new Error(apiResponse.error || 'Error al generar la campaña')
      }

      const data: CampaignGeneratedData = apiResponse.data || apiResponse

      // Poblar editableHeadline, editableIgCopy y tiktokScript
      const headlineText = (data.headline || data.titulo_campana || productDesc.slice(0, 32)).toUpperCase()
      const igText =
        data.igCopy ||
        `${data.fase_2_consideracion_feed?.copy_principal || ''}\n\n${
          data.fase_2_consideracion_feed?.llamado_a_la_accion || ''
        }`.trim()
      const ttText =
        data.tiktokScript ||
        `[0-3s Gancho]: ${
          data.fase_1_atraccion_reels_tiktok?.hook_visual_0_a_3s || ''
        }\n\n[Demostración]: ${
          data.fase_1_atraccion_reels_tiktok?.guion_desarrollo || ''
        }\n\n[Copy/Hashtags]: ${
          data.fase_1_atraccion_reels_tiktok?.copy_pie_video || ''
        }`.trim()
      const waText = data.whatsappCopy || data.fase_3_cierre_whatsapp?.texto_estado || ''

      setHeadline(headlineText)
      setEditableIgCopy(igText)
      setEditableTtScript(ttText)
      if (waText) setEditableWaText(waText)
      setPublicationId(apiResponse.publicationId || null)
      setIsFeedPublished(false)

      if (data.cmoAnalysis?.angle) {
        setSubline(data.cmoAnalysis.angle)
      } else if (data.estrategia?.angulo_gancho) {
        setSubline(data.estrategia.angulo_gancho)
      }

      if (niche) {
        setBadgeText(niche.toUpperCase())
      }

      // Si mode === 'fast' (o !data.cmoAnalysis), avanzar directamente al paso del Estudio Visual (Step 3)
      if (mode === 'fast' || !data.cmoAnalysis) {
        setCmoAnalysis(null)
        setStep(3)
        if (!isVideoMedia && imageUrl && !cutoutProductUrl && !isRemovingBg) {
          handleRemoveBackground(imageUrl)
        }
        toast.success('¡Despliegue rápido listo! Personaliza tu anuncio en el Estudio Visual.', {
          id: toastId,
        })
      } else {
        // Si mode === 'strategic', guardar setCmoAnalysis(data.cmoAnalysis) y mostrar la vista estratégica completa (Step 2)
        setCmoAnalysis(data.cmoAnalysis)
        setCampaignData({
          titulo_campana: headlineText,
          veredicto_cmo: data.veredicto_cmo || 'Análisis estratégico CMO optimizado para conversión.',
          estrategia: {
            avatar_cliente: data.cmoAnalysis.avatar || '',
            angulo_gancho: data.cmoAnalysis.angle || '',
            oferta_irresistible: data.cmoAnalysis.irresistibleOffer || '',
          },
        })
        setStep(2)
        toast.success('¡Centro de mando listo! Puedes editar cualquier texto antes de publicar.', {
          id: toastId,
        })
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        toast.error('La solicitud superó los 58 segundos. Prueba con Despliegue Rápido.', { id: toastId })
      } else {
        toast.error(err.message || 'Error al generar la campaña.', { id: toastId })
      }
    } finally {
      clearTimeout(timeoutId)
      setIsGenerating(false) // Garantiza que el botón siempre recupere su estado normal
    }
  }

  // 2. Publicar en Instagram Feed (/api/meta/feed/publish) usando publicationProxy
  const handlePublishIgFeed = async () => {
    const targetMedia = publicationProxy.bannerUrl || publicationProxy.publicUrl

    if (!targetMedia) {
      toast.error('Sube una imagen o genera una pancarta antes de publicar en el Feed.')
      return
    }

    if (isVideoMedia) {
      toast.error('El archivo actual es un video. Usa el botón de Meta Reels en la columna izquierda.')
      return
    }

    setIsPublishingFeed(true)
    const toastId = toast.loading('Publicando imagen en tu Feed de Instagram...')

    try {
      const res = await fetch('/api/meta/feed/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: targetMedia,
          caption: publicationProxy.instagramCopy,
          publicationId: publicationProxy.id || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al publicar en Instagram Feed')
      }

      setIsFeedPublished(true)
      toast.success('¡Publicado en tu Feed de Instagram con éxito!', { id: toastId })
    } catch (err: any) {
      toast.error(err.message || 'Fallo al publicar en Instagram Feed', { id: toastId })
    } finally {
      setIsPublishingFeed(false)
    }
  }

  // 3. Publicar Borrador en TikTok
  const handlePublishTikTok = async () => {
    if (!uploadedMediaUrl) {
      toast.error('No hay video disponible para enviar a TikTok.')
      return
    }

    setIsPublishingTikTok(true)
    const toastId = toast.loading('Inicializando y transfiriendo video a TikTok...')

    try {
      const res = await fetch('/api/tiktok/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: uploadedMediaUrl,
          storagePath: storagePath || uploadedMediaUrl,
          title: editableTtScript ? editableTtScript.slice(0, 80) : productDesc.slice(0, 50),
        }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(data.message || '¡Video enviado como borrador a TikTok!', { id: toastId })
      } else {
        toast.error(data.error || 'Fallo al publicar en TikTok', { id: toastId })
      }
    } catch (err: any) {
      toast.error(err.message || 'Error de conexión con TikTok API', { id: toastId })
    } finally {
      setIsPublishingTikTok(false)
    }
  }

  // 4. Copiloto de Refinamiento conectado a los estados editables
  const handleRefineContent = async () => {
    const instruction = refinementPrompt.trim()
    if (!instruction || !publicationId || isRefining) return

    setIsRefining(true)
    const toastId = toast.loading('El copiloto está optimizando tus textos con IA...')

    try {
      const response = await refineCopyAction(publicationId, instruction)
      if (response.success && response.copies) {
        setEditableIgCopy(response.copies.instagramCopy)
        setEditableTtScript(response.copies.tiktokScript)
        setRefinementPrompt('')
        toast.success(response.message || '¡Textos actualizados por el Copiloto!', { id: toastId })
      } else {
        toast.error(response.message || 'No se pudo refinar el contenido.', { id: toastId })
      }
    } catch (error: any) {
      toast.error(error.message || 'Error de conexión con el copiloto.', { id: toastId })
    } finally {
      setIsRefining(false)
    }
  }

  // 5. Paso 3: Generación de Escena Fotográfica de Estudio con IA
  const handleGenerateStudioScene = async () => {
    setIsGeneratingScene(true)
    const toastId = toast.loading('Generando nueva escena fotográfica de estudio con IA...')

    try {
      const themeLabel =
        styleTheme === 'clean-light'
          ? 'Clean Light'
          : styleTheme === 'bold-retail'
          ? 'Bold Retail'
          : 'Minimal Dark'

      const res = await fetch('/api/generate/visual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          niche,
          theme: themeLabel,
          styleTheme,
        }),
      })

      const data = await res.json()
      if (res.ok && data?.success && (data?.sceneUrl || data?.publicUrl)) {
        const rawUrl = data.sceneUrl || data.publicUrl
        setSceneUrl(`${rawUrl}?v=${Date.now()}`)
        toast.success('¡Nueva variante de estudio generada!', { id: toastId })
      } else {
        toast.error(data?.error || 'La IA tardó en responder. Intenta de nuevo.', { id: toastId })
      }
    } catch (err: any) {
      toast.error(err.message || 'Error al conectar con el generador de escenas', { id: toastId })
    } finally {
      setIsGeneratingScene(false)
    }
  }

  // 6. Paso 3: Aislamiento de Producto con Fondo Transparente (rembg / Sharp)
  const handleRemoveBackground = async (targetUrl?: string) => {
    const urlToProcess = targetUrl || imageUrl
    if (!urlToProcess || isVideoMedia) return

    setIsRemovingBg(true)
    const toastId = toast.loading('✨ Aislando producto de su fondo...')

    try {
      const res = await fetch('/api/images/remove-background', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: urlToProcess }),
      })

      const data = await res.json()
      if (!res.ok || !data.success || !data.transparentUrl) {
        throw new Error(data.error || 'No se pudo aislar el fondo')
      }

      setCutoutProductUrl(data.transparentUrl)
      setUseCutout(true)
      toast.success('¡Fondo aislado con canal alfa transparente!', { id: toastId })
    } catch (err: any) {
      toast.error(err.message || 'Error al eliminar fondo, usando imagen original', { id: toastId })
    } finally {
      setIsRemovingBg(false)
    }
  }

  // Transición asistida a Paso 3 (dispara rembg en segundo plano si es imagen)
  const goToStep3 = () => {
    setStep(3)
    if (!isVideoMedia && imageUrl && !cutoutProductUrl && !isRemovingBg) {
      handleRemoveBackground(imageUrl)
    }
  }

  // 7. Paso 3: Compilación Final de Pancarta (Bake / Exportación Segura)
  const handleBakeBanner = async () => {
    if (!sceneUrl) {
      toast.error('Primero genera una escena de estudio.')
      return
    }

    setIsBakingBanner(true)
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
        filter: () => true,
      })

      if (!blob) {
        throw new Error('No se pudo generar el archivo de imagen del anuncio.')
      }

      // 3. Subida a Supabase Storage con ruta segura
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const safeUserId = user?.id || 'public'
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
        const fallbackUpload = await supabase.storage
          .from(targetBucket)
          .upload(filePath, blob, {
            contentType: 'image/png',
            upsert: true,
          })
        if (fallbackUpload.error) {
          throw new Error(`Fallo de Supabase Storage: ${uploadError.message}`)
        }
      }

      const {
        data: { publicUrl: finalBannerUrl },
      } = supabase.storage.from(targetBucket).getPublicUrl(filePath)

      // Actualizar registro en la base de datos si existe publicationId
      if (publicationId) {
        try {
          await fetch('/api/banners/bake', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              publicationId,
              finalBannerUrl,
            }),
          })
        } catch (dbErr) {
          console.warn('No se pudo actualizar publicación en Prisma:', dbErr)
        }
      }

      setBannerUrl(finalBannerUrl)
      toast.success('¡Pancarta guardada con éxito en tu Bóveda!', { id: toastId })
      router.push('/dashboard/history')
    } catch (err: any) {
      console.error('🔥 Error crítico en exportación:', err)
      toast.error(err.message || 'Error al exportar la imagen.', { id: toastId })
    } finally {
      setIsBakingBanner(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleRefineContent()
    }
  }

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`¡Copiado (${label})!`)
    } catch {
      toast.error('No se pudo copiar al portapapeles')
    }
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* HEADER DE ETAPAS CON GLOW */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
            <span className="text-blue-500">{step}.</span>
            {step === 1 && 'Define tu Producto y Objetivo'}
            {step === 2 && 'Centro de Mando Estratégico'}
            {step === 3 && 'Generación Visual de Estudio (4:5)'}
            <span className="text-zinc-500 text-xs md:text-sm font-normal hidden sm:inline ml-2">
              — {step === 3 ? 'Renderizado desacoplado con cero timeout' : 'Embudo de conversión asistido por IA'}
            </span>
          </h2>

          <div className="flex items-center gap-2">
            {step === 3 && (
              <button
                type="button"
                onClick={() => setStep(generationMode === 'fast' ? 1 : 2)}
                className="text-xs text-zinc-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-zinc-800 hover:border-zinc-700 cursor-pointer"
              >
                ← {generationMode === 'fast' ? 'Ajustar Ingesta' : 'Volver al Centro de Mando'}
              </button>
            )}
            {step === 2 && (
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-xs text-zinc-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-zinc-800 hover:border-zinc-700 cursor-pointer"
              >
                ← Nueva Campaña / Ajustar Ingesta
              </button>
            )}
          </div>
        </div>

        {/* BARRAS DE PROGRESO CON GLOW (3 PASOS) */}
        <div className="flex gap-2.5 w-full h-1.5">
          <div
            className={`flex-1 rounded-full transition-all duration-500 ${
              step >= 1
                ? 'bg-blue-600 shadow-[0_0_12px_rgba(37,99,235,0.6)]'
                : 'bg-zinc-800'
            }`}
          />
          <div
            className={`flex-1 rounded-full transition-all duration-500 ${
              step >= 2
                ? 'bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.6)]'
                : 'bg-zinc-800'
            }`}
          />
          <div
            className={`flex-1 rounded-full transition-all duration-500 ${
              step === 3
                ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.6)]'
                : 'bg-zinc-800'
            }`}
          />
        </div>
      </div>

      {/* ===================== PASO 1: INGESTA Y PARÁMETROS ===================== */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-6 shadow-xl space-y-6">
            <ProductImageUpload
              onImageUploaded={(url, type, path) => {
                setImageUrl(url)
                if (type) setMediaType(type)
                if (path) setStoragePath(path)
                setCutoutProductUrl(null)
              }}
              onUploadingChange={setIsUploadingToStorage}
              userId={userId}
            />

            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
                Contexto del Producto o Oferta
              </label>
              <textarea
                className="w-full p-4 border border-zinc-800 rounded-xl text-sm bg-zinc-950/60 text-zinc-200 placeholder-zinc-500 focus:ring-2 focus:ring-blue-500 focus:outline-none transition resize-none"
                rows={3}
                placeholder="Ej. Maceta artesanal de cerámica esmaltada, tono verde menta, ideal para interiores y plantas suculentas..."
                value={productDesc}
                onChange={(e) => setProductDesc(e.target.value)}
              />
            </div>

            {/* PILLS EXCLUYENTES: NICHO Y OBJETIVO */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2 border-t border-zinc-800/70">
              {/* Grupo 1: Niche */}
              <div className="space-y-2.5">
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Nicho de Negocio
                </label>
                <div className="flex flex-wrap gap-2">
                  {NICHE_OPTIONS.map((option) => {
                    const active = niche === option
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setNiche(option)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                          active
                            ? 'bg-blue-600 text-white shadow-[0_0_12px_rgba(37,99,235,0.45)] border border-blue-400/40'
                            : 'bg-zinc-950/80 text-zinc-400 border border-zinc-800 hover:border-zinc-700 hover:text-zinc-200'
                        }`}
                      >
                        {option}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Grupo 2: Goal */}
              <div className="space-y-2.5">
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Objetivo de Conversión
                </label>
                <div className="flex flex-wrap gap-2">
                  {GOAL_OPTIONS.map((option) => {
                    const active = goal === option
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setGoal(option)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                          active
                            ? 'bg-emerald-600 text-white shadow-[0_0_12px_rgba(16,185,129,0.45)] border border-emerald-400/40'
                            : 'bg-zinc-950/80 text-zinc-400 border border-zinc-800 hover:border-zinc-700 hover:text-zinc-200'
                        }`}
                      >
                        {option}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* BOTONES DE ACCIÓN PASO 1 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => handleGenerate('fast')}
              disabled={isGenerating || isUploadingToStorage}
              className="p-5 bg-zinc-900/80 border border-zinc-800 hover:border-blue-500/80 rounded-2xl text-left transition-all group shadow-sm disabled:opacity-50 relative cursor-pointer"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xl">⚡</span>
                <h3 className="font-bold text-zinc-100 text-sm group-hover:text-blue-400 transition-colors">
                  Despliegue Rápido
                </h3>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Genera de inmediato los copys y titular y pasa directo al Estudio Visual en menos de 4 segundos.
              </p>
              {isUploadingToStorage ? (
                <span className="absolute top-4 right-4 text-xs font-bold text-amber-400 animate-pulse">
                  ⏳ Subiendo video a la bóveda...
                </span>
              ) : isGenerating && generationMode === 'fast' ? (
                <span className="absolute top-4 right-4 text-xs font-bold text-blue-400 animate-pulse">
                  Generando...
                </span>
              ) : null}
            </button>

            <button
              type="button"
              onClick={() => handleGenerate('strategic')}
              disabled={isGenerating || isUploadingToStorage}
              className="p-5 bg-zinc-900/80 border border-zinc-800 hover:border-emerald-500/80 rounded-2xl text-left transition-all group shadow-sm disabled:opacity-50 relative cursor-pointer"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xl">🧠</span>
                <h3 className="font-bold text-zinc-100 text-sm group-hover:text-emerald-400 transition-colors">
                  Campaña Estratégica CMO
                </h3>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                El CMO analiza tu avatar, ángulo mortal y oferta irresistible junto con los guiones editables.
              </p>
              {isUploadingToStorage ? (
                <span className="absolute top-4 right-4 text-xs font-bold text-amber-400 animate-pulse">
                  ⏳ Subiendo video a la bóveda...
                </span>
              ) : isGenerating && generationMode === 'strategic' ? (
                <span className="absolute top-4 right-4 text-xs font-bold text-emerald-400 animate-pulse">
                  Analizando...
                </span>
              ) : null}
            </button>
          </div>
        </div>
      )}

      {/* ===================== PASO 2: CENTRO DE MANDO (EL EMBUDO) ===================== */}
      {step === 2 && (
        <div className="space-y-6">
          {/* 1. HEADER: VEREDICTO DEL CMO */}
          <div className="bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 border border-amber-500/30 rounded-2xl p-5 shadow-xl relative overflow-hidden">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center flex-shrink-0 text-lg">
                🧠
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wider">
                    🧠 Veredicto del CMO
                  </h3>
                  {headline && (
                    <span className="text-xs text-zinc-400 font-medium bg-zinc-800/80 px-2.5 py-0.5 rounded-full border border-zinc-700/60">
                      {headline}
                    </span>
                  )}
                </div>
                <p className="text-sm text-zinc-200 leading-relaxed font-medium">
                  {campaignData?.veredicto_cmo ||
                    'Tu cliente principal duda antes de comprar; este ángulo derriba su escepticismo mostrando valor real desde los primeros 3 segundos.'}
                </p>
              </div>
            </div>
          </div>

          {/* 2. FILA DE 3 TARJETAS COMPACTAS DE SÓLO LECTURA: AVATAR | ÁNGULO | OFERTA */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-xl p-4 shadow-md space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                🎯 Avatar del Cliente
              </span>
              <p className="text-xs text-zinc-300 leading-relaxed">
                {cmoAnalysis?.avatar || campaignData?.estrategia?.avatar_cliente || 'Audiencia calificada lista para comprar.'}
              </p>
            </div>

            <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-xl p-4 shadow-md space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                ⚡ Ángulo de Gancho
              </span>
              <p className="text-xs text-zinc-300 leading-relaxed">
                {cmoAnalysis?.angle || campaignData?.estrategia?.angulo_gancho || 'Enfoque directo al dolor principal y solución inmediata.'}
              </p>
            </div>

            <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-xl p-4 shadow-md space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                💎 Oferta Irresistible
              </span>
              <p className="text-xs text-zinc-300 leading-relaxed">
                {cmoAnalysis?.irresistibleOffer || campaignData?.estrategia?.oferta_irresistible || 'Propuesta de valor clara con llamado a la acción directo.'}
              </p>
            </div>
          </div>

          {/* BANNER DESTACADO PARA PASAR AL PASO 3 DE ESTUDIO VISUAL */}
          {!isVideoMedia && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-950/40 via-purple-950/30 to-zinc-900 border border-blue-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 font-bold">
                  🎨
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Generación Visual de Estudio (Paso 3)</h4>
                  <p className="text-xs text-zinc-400">
                    Crea pancartas 4:5 de alta definición con fondos fotográficos de estudio y tipografía comercial en vivo.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={goToStep3}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition shadow-md shadow-blue-600/30 flex items-center gap-2 cursor-pointer flex-shrink-0"
              >
                <span>Diseñar Pancartas de Estudio →</span>
              </button>
            </div>
          )}

          {/* 3. GRID DE 3 COLUMNAS DE EJECUCIÓN (EDITABLES EN VIVO) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
            {/* COLUMNA A: TIKTOK / REELS */}
            <div className="bg-zinc-900/90 border border-zinc-800/90 rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-xl">
              <div className="space-y-3 flex-1 flex flex-col">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-pink-400 block">
                      Fase 1 • Atracción
                    </span>
                    <h4 className="font-bold text-zinc-100 text-sm">🎬 TikTok & Meta Reels</h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(editableTtScript, 'TikTok / Reels')}
                    className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-2.5 py-1.5 rounded-lg border border-zinc-700/80 flex items-center gap-1 transition cursor-pointer"
                  >
                    <Copy className="w-3 h-3" /> Copiar
                  </button>
                </div>

                <textarea
                  value={editableTtScript}
                  onChange={(e) => setEditableTtScript(e.target.value)}
                  rows={10}
                  className="w-full flex-1 p-3.5 bg-zinc-950/90 border border-zinc-800 rounded-xl text-xs text-zinc-200 leading-relaxed focus:ring-2 focus:ring-pink-500/60 focus:outline-none resize-y"
                  placeholder="Guion de video para Reels y TikTok..."
                />
              </div>

              <div className="pt-2 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-2">
                <ReelPublishButton item={publicationProxy} />

                {isVideoMedia && (
                  <button
                    type="button"
                    onClick={handlePublishTikTok}
                    disabled={isPublishingTikTok}
                    className="px-3 py-1.5 bg-[#fe2c55] hover:bg-[#e0264b] text-white text-xs font-semibold rounded-lg transition flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
                  >
                    {isPublishingTikTok ? '⏳ Enviando...' : '🎵 Borrador TikTok'}
                  </button>
                )}
              </div>
            </div>

            {/* COLUMNA B: IG FEED */}
            <div className="bg-zinc-900/90 border border-zinc-800/90 rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-xl">
              <div className="space-y-3 flex-1 flex flex-col">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 block">
                      Fase 2 • Consideración
                    </span>
                    <h4 className="font-bold text-zinc-100 text-sm">📸 Instagram Feed</h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(editableIgCopy, 'Instagram Feed')}
                    className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-2.5 py-1.5 rounded-lg border border-zinc-700/80 flex items-center gap-1 transition cursor-pointer"
                  >
                    <Copy className="w-3 h-3" /> Copiar
                  </button>
                </div>

                <textarea
                  value={editableIgCopy}
                  onChange={(e) => setEditableIgCopy(e.target.value)}
                  rows={10}
                  className="w-full flex-1 p-3.5 bg-zinc-950/90 border border-zinc-800 rounded-xl text-xs text-zinc-200 leading-relaxed focus:ring-2 focus:ring-purple-500/60 focus:outline-none resize-y"
                  placeholder="Copy principal y llamado a la acción para Feed..."
                />
              </div>

              <div className="pt-2 border-t border-zinc-800/80 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={handlePublishIgFeed}
                    disabled={isPublishingFeed || isFeedPublished || !uploadedMediaUrl || isVideoMedia}
                    className={`w-full flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      isFeedPublished
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-sm active:scale-95'
                    } disabled:opacity-40 disabled:cursor-not-allowed`}
                    title={
                      isVideoMedia
                        ? 'Para videos utiliza el botón de Meta Reels'
                        : !uploadedMediaUrl
                        ? 'Sube una imagen o genera una pancarta primero'
                        : undefined
                    }
                  >
                    {isPublishingFeed
                      ? '⏳ Publicando en Feed...'
                      : isFeedPublished
                      ? '✅ Publicado en IG Feed'
                      : '🚀 Publicar en IG Feed'}
                  </button>
                </div>

                {!isVideoMedia && (
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={goToStep3}
                      className="flex-1 py-2 px-3 bg-zinc-800 hover:bg-zinc-700 text-blue-400 hover:text-blue-300 font-semibold text-xs rounded-lg transition border border-zinc-700/80 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Palette className="w-3.5 h-3.5" /> Estudio Visual 4:5
                    </button>
                    {publicationId && (
                      <div className="flex-1">
                        <GenerateBannerButton
                          contentId={publicationId}
                          existingBannerUrl={bannerUrl}
                          visualPrompt="High-converting commercial product advertisement banner"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* COLUMNA C: WHATSAPP */}
            <div className="bg-zinc-900/90 border border-zinc-800/90 rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-xl">
              <div className="space-y-3 flex-1 flex flex-col">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
                      Fase 3 • Cierre Directo
                    </span>
                    <h4 className="font-bold text-zinc-100 text-sm">💬 Estados & WhatsApp</h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(editableWaText, 'WhatsApp')}
                    className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-2.5 py-1.5 rounded-lg border border-zinc-700/80 flex items-center gap-1 transition cursor-pointer"
                  >
                    <Copy className="w-3 h-3" /> Copiar
                  </button>
                </div>

                <textarea
                  value={editableWaText}
                  onChange={(e) => setEditableWaText(e.target.value)}
                  rows={10}
                  className="w-full flex-1 p-3.5 bg-zinc-950/90 border border-zinc-800 rounded-xl text-xs text-zinc-200 leading-relaxed focus:ring-2 focus:ring-emerald-500/60 focus:outline-none resize-y"
                  placeholder="Texto de estado de WhatsApp y cierre por mensaje directo..."
                />
              </div>

              <div className="pt-2 border-t border-zinc-800/80">
                <button
                  type="button"
                  onClick={() => setIsShareModalOpen(true)}
                  className="w-full py-2 px-3.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-all shadow-sm flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                >
                  <span>📲</span> Compartir en WhatsApp / Estado
                </button>
              </div>
            </div>
          </div>

          {/* 4. VISTA PREVIA EN VIVO + COPILOTO DE REFINAMIENTO */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pt-4 border-t border-zinc-800/80">
            <div className="lg:col-span-5 flex flex-col items-center">
              <InstagramMockup
                copy={editableIgCopy}
                imageUrl={uploadedMediaUrl}
                username="urielfgx"
              />
              <p className="text-[11px] text-zinc-500 mt-2 text-center">
                Vista previa sincronizada en tiempo real con tus ediciones.
              </p>
            </div>

            <div className="lg:col-span-7 space-y-4">
              <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 shadow-xl space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-400" />
                  <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                    Copiloto de Refinamiento IA
                  </h4>
                </div>
                <p className="text-xs text-zinc-400">
                  ¿Quieres ajustar el tono o agregar una promoción especial? Pídeselo al copiloto o edita directamente las cajas de arriba.
                </p>
                <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-2 flex items-end gap-2 focus-within:border-blue-500/50 transition-all">
                  <textarea
                    rows={2}
                    value={refinementPrompt}
                    onChange={(e) => setRefinementPrompt(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ej. 'Agrega envío gratis por 24 horas y haz el tono más urgente'..."
                    className="w-full bg-transparent border-none text-xs text-zinc-100 placeholder-zinc-500 focus:ring-0 focus:outline-none resize-none py-1.5 px-2 leading-relaxed"
                    disabled={isRefining}
                  />
                  <button
                    type="button"
                    onClick={handleRefineContent}
                    disabled={!refinementPrompt.trim() || isRefining || !publicationId}
                    className="p-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded-xl transition-all flex-shrink-0 shadow-sm flex items-center justify-center cursor-pointer"
                    title="Refinar textos con IA"
                  >
                    {isRefining ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================== PASO 3: GENERACIÓN VISUAL DE ESTUDIO (DESACOPLADA) ===================== */}
      {step === 3 && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Header Barra de Acciones */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 shadow-xl">
            <div>
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <span>🎨</span> Generación Visual de Estudio Desacoplada
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Genera fondos de estudio fotográfico con IA y personaliza la tipografía en tiempo real sin latencia.
              </p>
            </div>
            <button
              type="button"
              onClick={handleBakeBanner}
              disabled={isBakingBanner || isGeneratingScene}
              className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 font-bold text-xs rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer flex-shrink-0 active:scale-95"
            >
              {isBakingBanner ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                  <span>Compilando 4:5...</span>
                </>
              ) : (
                <>
                  <span>💾</span>
                  <span>Guardar y Desplegar</span>
                </>
              )}
            </button>
          </div>

          {/* Layout de 2 Paneles: Izquierdo (Escena IA) y Derecho (Pancartas Listas + Controles) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Panel Izquierdo: "Imágenes con IA" */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-zinc-100 text-sm flex items-center gap-1.5">
                    <span>📸</span> Escena de Estudio con IA
                  </h4>
                  <span className="text-[10px] uppercase font-bold text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700">
                    Fondo Neutral 4:5
                  </span>
                </div>

                {/* Previsualización de la escena generada con indicador de carga */}
                <div className="relative aspect-[4/5] rounded-xl overflow-hidden bg-zinc-950 border border-zinc-800/80 shadow-inner group">
                  {sceneUrl ? (
                    <img
                      src={sceneUrl}
                      alt="Escena de Estudio"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs">
                      Sin escena seleccionada
                    </div>
                  )}

                  {isGeneratingScene && (
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-4 text-center z-20 animate-in fade-in">
                      <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mb-3" />
                      <span className="text-xs font-bold text-blue-400 tracking-wider animate-pulse uppercase">
                        PROCESANDO IMAGEN DE ESTUDIO...
                      </span>
                      <p className="text-[11px] text-zinc-400 mt-1 max-w-[80%]">
                        Diseñando iluminación arquitectónica, pedestal y sombras suaves.
                      </p>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleGenerateStudioScene}
                  disabled={isGeneratingScene}
                  className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-100 font-semibold text-xs rounded-xl transition border border-zinc-700/80 flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-95"
                >
                  {isGeneratingScene ? '⏳ Renderizando nuevo ángulo...' : '🖼️ Generar Variante de Escena'}
                </button>

                {/* Control de Aislamiento Alpha (rembg) */}
                {imageUrl && !isVideoMedia && (
                  <div className="bg-zinc-950/70 border border-zinc-800 rounded-xl p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                        <span>✨</span> Aislamiento de Producto (Alpha)
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveBackground()}
                        disabled={isRemovingBg}
                        className="text-[11px] text-blue-400 hover:text-blue-300 font-medium underline underline-offset-2 disabled:opacity-50 cursor-pointer"
                      >
                        {isRemovingBg ? 'Extrayendo...' : cutoutProductUrl ? 'Re-extraer fondo' : 'Aislar fondo'}
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-1">
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300 select-none">
                        <input
                          type="checkbox"
                          checked={useCutout && Boolean(cutoutProductUrl)}
                          disabled={!cutoutProductUrl || isRemovingBg}
                          onChange={(e) => setUseCutout(e.target.checked)}
                          className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-blue-600 focus:ring-blue-500/50 cursor-pointer disabled:opacity-40"
                        />
                        <span>Fondo eliminado (Canal Alfa Transparente)</span>
                      </label>

                      {cutoutProductUrl && (
                        <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-semibold">
                          Alfa PNG activo
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Panel Derecho: "Pancartas Listas Con Textos" */}
            <div className="lg:col-span-7 space-y-4">
              <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-zinc-100 text-sm flex items-center gap-1.5">
                      <span>🎨</span> Pancartas Listas Con Textos
                    </h4>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Edición en vivo en el cliente con 0ms de latencia.
                    </p>
                  </div>
                </div>

                {/* Previsualización en Tiempo Real */}
                <div className="py-2 flex justify-center">
                  <StudioCanvasPreview
                    sceneUrl={
                      sceneUrl ||
                      'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=1080&q=80'
                    }
                    productImageUrl={imageUrl}
                    cutoutProductUrl={useCutout ? cutoutProductUrl : null}
                    isLoadingProduct={isRemovingBg}
                    headline={headline}
                    editableHeadline={headline}
                    subline={subline}
                    ctaText={ctaText}
                    badgeText={badgeText}
                    styleTheme={styleTheme}
                    editableIgCopy={editableIgCopy}
                    niche={niche}
                  />
                </div>

                {/* Controles de Edición Inline */}
                <div className="space-y-4 pt-3 border-t border-zinc-800/80">
                  {/* Selector de Estilo Visual */}
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                      Tema de Estilo Visual
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['minimal-dark', 'bold-retail', 'clean-light'] as const).map((theme) => {
                        const active = styleTheme === theme
                        const labels = {
                          'minimal-dark': 'Minimal Dark',
                          'bold-retail': 'Bold Retail',
                          'clean-light': 'Clean Light',
                        }
                        return (
                          <button
                            key={theme}
                            type="button"
                            onClick={() => setStyleTheme(theme)}
                            className={`py-2 px-3 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                              active
                                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 border border-blue-400/40'
                                : 'bg-zinc-950 text-zinc-400 border border-zinc-800 hover:text-white hover:border-zinc-700'
                            }`}
                          >
                            {labels[theme]}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Inputs de Textos */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                        Badge Superior (Marca / Oferta)
                      </label>
                      <input
                        type="text"
                        value={badgeText}
                        onChange={(e) => setBadgeText(e.target.value)}
                        placeholder="Ej. OFERTA EXCLUSIVA"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 outline-none focus:border-blue-500 transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                        Botón de Acción (CTA)
                      </label>
                      <input
                        type="text"
                        value={ctaText}
                        onChange={(e) => setCtaText(e.target.value)}
                        placeholder="Ej. Pedir por WhatsApp"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 outline-none focus:border-blue-500 transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                      Titular Principal (Headline)
                    </label>
                    <input
                      type="text"
                      value={headline}
                      onChange={(e) => setHeadline(e.target.value)}
                      placeholder="Ej. LOOK LIKE YOU, ON YOUR BEST DAY"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 font-semibold outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                      Subtítulo de Valor (Subline)
                    </label>
                    <textarea
                      rows={2}
                      value={subline}
                      onChange={(e) => setSubline(e.target.value)}
                      placeholder="Ej. Reacts hook like you, on your best day."
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 outline-none focus:border-blue-500 resize-none leading-relaxed transition-colors"
                    />
                  </div>
                </div>

                {/* Botón Verde de Cierre: Guardar y Desplegar */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleBakeBanner}
                    disabled={isBakingBanner || isGeneratingScene}
                    className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 font-bold text-sm rounded-xl transition-all shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
                  >
                    {isBakingBanner ? (
                      <>
                        <div className="w-4 h-4 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                        <span>Compilando y Desplegando en Bóveda...</span>
                      </>
                    ) : (
                      <>
                        <span>💾</span>
                        <span>Guardar y Desplegar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NATIVO DE DISTRIBUCIÓN ASISTIDA (WHATSAPP / ESTADOS) */}
      <QuickShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        title={campaignData?.titulo_campana || productDesc || 'Campaña Blitzr'}
        caption={editableWaText}
        mediaUrl={uploadedMediaUrl || undefined}
        fileName={`blitzr-${publicationId || 'media'}${isVideoMedia ? '.mp4' : '.jpg'}`}
      />
    </div>
  )
}

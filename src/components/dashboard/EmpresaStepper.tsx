'use client'

import { useState } from 'react'
import { ProductImageUpload } from './ProductImageUpload'
import { GenerateBannerButton } from './GenerateBannerButton'
import { createFastTrackAction } from '@/app/actions/create-fast-track'
import { generateStrategyAction } from '@/app/actions/generate-strategy'
import { generateCopiesAction } from '@/app/actions/generate-copies'
import { refineCopyAction } from '@/app/actions/refine-copies'
import { publishPostAction } from '@/app/actions/publish-post'
import { toast } from 'sonner'
import { Sparkles, Send, Copy } from 'lucide-react'
import { InstagramMockup } from './mockups/InstagramMockup'

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

type ModalKey = 'buyerPersona' | 'postingTips' | 'photoAdvice' | 'salesAngle' | null

const modalTitles: Record<string, string> = {
  buyerPersona: '🎯 Análisis de Audiencia',
  postingTips: '📍 Lógica de Distribución',
  photoAdvice: '📸 Psicología Visual',
  salesAngle: '⚡ Estrategia de Conversión'
}

export function EmpresaStepper({ userId, initialData }: EmpresaStepperProps) {
  // Determinar paso inicial: Si ya tiene copys -> Paso 3. Si tiene estrategia -> Paso 2. Si no -> Paso 1.
  const [step, setStep] = useState<1 | 2 | 3>(
    initialData?.copies ? 3 : initialData?.strategyData ? 2 : 1
  )
  const [imageUrl, setImageUrl] = useState<string | null>(initialData?.imageUrl || null)
  const [productDesc, setProductDesc] = useState(initialData?.productDesc || '')
  const [bannerUrl, setBannerUrl] = useState<string | null>(initialData?.bannerUrl || null)
  const [isExpress, setIsExpress] = useState(false)

  // Estados de datos
  const [strategyId, setStrategyId] = useState<string | null>(initialData?.id || null)
  const [strategyData, setStrategyData] = useState<any>(initialData?.strategyData || null)
  const [finalCopies, setFinalCopies] = useState<{
    instagramCopy: string
    tiktokScript: string
    whatsapp?: {
      ficha: string
      objecionPrecio: string
      objecionConfianza: string
    }
  } | null>(initialData?.copies || null)

  const [postTarget, setPostTarget] = useState<'feed' | 'story'>('feed')
  const [whatsappNumber, setWhatsappNumber] = useState('')

  // Estados de carga
  const [isLoadingStrategy, setIsLoadingStrategy] = useState(false)
  const [isFastTracking, setIsFastTracking] = useState(false)
  const [isGeneratingCopies, setIsGeneratingCopies] = useState(false)
  const [isRefining, setIsRefining] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)

  // Copiloto y modales
  const [refinementPrompt, setRefinementPrompt] = useState('')
  const [activeModal, setActiveModal] = useState<ModalKey>(null)

  // 1. Manejador Ruta Express
  const handleFastTrack = async () => {
    if (!productDesc.trim()) {
      toast.error('Por favor describe brevemente qué vas a vender')
      return
    }
    setIsFastTracking(true)
    try {
      const res = await createFastTrackAction(productDesc, imageUrl)
      if (res.success && res.strategyId) {
        setStrategyId(res.strategyId)
        setIsExpress(true)
        setStep(3)
        toast.success('¡Ruta express activada! Listo para crear anuncios.')
      }
    } catch (error: any) {
      toast.error(error.message || 'Error al iniciar ruta rápida')
    } finally {
      setIsFastTracking(false)
    }
  }

  // 2. Manejador Campaña Estratégica
  const handleStrategySubmit = async () => {
    if (!productDesc.trim()) {
      toast.error('Por favor describe brevemente qué vas a vender')
      return
    }
    setIsExpress(false)
    setIsLoadingStrategy(true)
    setStep(2)

    try {
      const res = await generateStrategyAction(productDesc, imageUrl)
      if (res.success && res.strategyId) {
        setStrategyId(res.strategyId)
        setStrategyData(res.data)
        toast.success('¡Estrategia táctica generada!')
      }
    } catch (error: any) {
      toast.error(error.message || 'Error al generar la estrategia')
      setStep(1)
    } finally {
      setIsLoadingStrategy(false)
    }
  }

  // 3. Generar Copys
  const handleGenerateCopies = async () => {
    if (!strategyId) return
    setIsGeneratingCopies(true)
    const toastId = toast.loading('Redactando copys con IA...')
    try {
      const res = await generateCopiesAction(strategyId)
      if (res.success && res.copies) {
        setFinalCopies(res.copies)
        toast.success('¡Contenido generado y guardado en tu bóveda!', { id: toastId })
      }
    } catch (error: any) {
      toast.error(error.message || 'Error al generar copys', { id: toastId })
    } finally {
      setIsGeneratingCopies(false)
    }
  }

  // 4. Copiloto de Refinamiento
  const handleRefineContent = async () => {
    const instruction = refinementPrompt.trim()
    if (!instruction || !strategyId || isRefining) return

    setIsRefining(true)
    const toastId = toast.loading('El copiloto está optimizando tus textos con IA...')

    try {
      const response = await refineCopyAction(strategyId, instruction)
      if (response.success && response.copies) {
        setFinalCopies({
          instagramCopy: response.copies.instagramCopy,
          tiktokScript: response.copies.tiktokScript
        })
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleRefineContent()
    }
  }

  // 5. Publicar en Meta
  const handlePublishToSocials = async () => {
    if (!strategyId) {
      toast.error('No hay una campaña activa para publicar.')
      return
    }

    setIsPublishing(true)
    const toastId = toast.loading('Despachando a Instagram y Facebook...')

    try {
      const res = await publishPostAction({ contentId: strategyId, postType: postTarget })
      if (res.success) {
        toast.success(res.message, { id: toastId })
      } else {
        toast.error(res.message, { id: toastId })
      }
    } catch (err: any) {
      toast.error(err.message || 'Error al conectar con los servidores de Meta.', { id: toastId })
    } finally {
      setIsPublishing(false)
    }
  }

  const copyToClipboard = async (text: string, platform: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`¡Copiado para ${platform}!`)
    } catch {
      toast.error('No se pudo copiar al portapapeles')
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 animate-in fade-in duration-300">
      
      {/* HEADER DE ETAPAS CON GLOW */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
            <span className="text-blue-500">{step}.</span> 
            {step === 1 && 'Define tu Producto'}
            {step === 2 && 'Hoja de Ruta Estratégica'}
            {step === 3 && 'Factoría de Contenido'}
            <span className="text-zinc-500 text-xs md:text-sm font-normal hidden sm:inline ml-2">
              — Módulos de ejecución bajo demanda
            </span>
          </h2>
          {step > 1 && (
            <button
              type="button"
              onClick={() => setStep(step === 3 && !isExpress ? 2 : 1)}
              className="text-xs text-zinc-400 hover:text-white transition-colors"
            >
              ← Volver atrás
            </button>
          )}
        </div>

        {/* BARRAS DE PROGRESO CON GLOW */}
        <div className="flex gap-2.5 w-full h-1.5">
          <div className={`flex-1 rounded-full transition-all duration-500 ${
            step >= 1 ? 'bg-blue-600 shadow-[0_0_12px_rgba(37,99,235,0.6)]' : 'bg-zinc-800'
          }`} />
          <div className={`flex-1 rounded-full transition-all duration-500 ${
            step >= 2 ? (step === 2 ? 'bg-blue-600 shadow-[0_0_12px_rgba(37,99,235,0.6)]' : 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]') : 'bg-zinc-800'
          }`} />
          <div className={`flex-1 rounded-full transition-all duration-500 ${
            step === 3 ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.6)]' : 'bg-zinc-800'
          }`} />
        </div>
      </div>

      {/* ===================== PASO 1: INGESTA ===================== */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-6 shadow-xl space-y-4">
            <ProductImageUpload onImageUploaded={setImageUrl} userId={userId} />

            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
                Contexto del Producto
              </label>
              <textarea
                className="w-full p-4 border border-zinc-800 rounded-xl text-sm bg-zinc-950/60 text-zinc-200 placeholder-zinc-500 focus:ring-2 focus:ring-blue-500 focus:outline-none transition resize-none"
                rows={3}
                placeholder="Ej. Maceta artesanal de cerámica esmaltada, tono verde menta, ideal para interiores y plantas suculentas..."
                value={productDesc}
                onChange={(e) => setProductDesc(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={handleFastTrack}
              disabled={isFastTracking || isLoadingStrategy}
              className="p-5 bg-zinc-900/80 border border-zinc-800 hover:border-blue-500/80 rounded-2xl text-left transition-all group shadow-sm disabled:opacity-50 relative"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xl">⚡</span>
                <h3 className="font-bold text-zinc-100 text-sm group-hover:text-blue-400 transition-colors">
                  Publicidad Rápida
                </h3>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Salta la consultoría y ve directo a crear copys y diseñar pancartas visuales para lanzar ya.
              </p>
              {isFastTracking && (
                <span className="absolute top-4 right-4 text-xs font-bold text-blue-400 animate-pulse">
                  Preparando...
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={handleStrategySubmit}
              disabled={isFastTracking || isLoadingStrategy}
              className="p-5 bg-zinc-900/80 border border-zinc-800 hover:border-emerald-500/80 rounded-2xl text-left transition-all group shadow-sm disabled:opacity-50 relative"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xl">🧠</span>
                <h3 className="font-bold text-zinc-100 text-sm group-hover:text-emerald-400 transition-colors">
                  Campaña Estratégica
                </h3>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                El Consultor de IA analiza tu cliente ideal, horarios y ángulos de venta antes de crear contenido.
              </p>
              {isLoadingStrategy && (
                <span className="absolute top-4 right-4 text-xs font-bold text-emerald-400 animate-pulse">
                  Analizando...
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ===================== PASO 2: ESTRATEGIA ===================== */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Cliente Ideal */}
            <div className="p-5 bg-zinc-900/90 border border-zinc-800/80 rounded-2xl relative shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-zinc-100 text-sm">🎯 Tu Cliente Ideal</h3>
                {strategyData?.buyerPersona?.reasoning && (
                  <button
                    type="button"
                    onClick={() => setActiveModal('buyerPersona')}
                    className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2 py-0.5 rounded-md font-medium transition"
                  >
                    💡 ¿Por qué?
                  </button>
                )}
              </div>
              {isLoadingStrategy ? (
                <div className="space-y-2 animate-pulse"><div className="h-3 bg-zinc-800 rounded w-3/4"></div></div>
              ) : (
                <p className="text-xs text-zinc-300 leading-relaxed">{strategyData?.buyerPersona?.content}</p>
              )}
            </div>

            {/* Dónde Publicar */}
            <div className="p-5 bg-zinc-900/90 border border-zinc-800/80 rounded-2xl relative shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-zinc-100 text-sm">📍 Dónde Publicar</h3>
                {strategyData?.postingTips?.reasoning && (
                  <button
                    type="button"
                    onClick={() => setActiveModal('postingTips')}
                    className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2 py-0.5 rounded-md font-medium transition"
                  >
                    💡 ¿Por qué?
                  </button>
                )}
              </div>
              {isLoadingStrategy ? (
                <div className="space-y-2 animate-pulse"><div className="h-3 bg-zinc-800 rounded w-3/4"></div></div>
              ) : (
                <p className="text-xs text-zinc-300 leading-relaxed">{strategyData?.postingTips?.content}</p>
              )}
            </div>

            {/* Tips de Foto */}
            <div className="p-5 bg-zinc-900/90 border border-zinc-800/80 rounded-2xl relative shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-zinc-100 text-sm">📸 Tips de Foto</h3>
                {strategyData?.photoAdvice?.reasoning && (
                  <button
                    type="button"
                    onClick={() => setActiveModal('photoAdvice')}
                    className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2 py-0.5 rounded-md font-medium transition"
                  >
                    💡 ¿Por qué?
                  </button>
                )}
              </div>
              {isLoadingStrategy ? (
                <div className="space-y-2 animate-pulse"><div className="h-3 bg-zinc-800 rounded w-3/4"></div></div>
              ) : (
                <p className="text-xs text-zinc-300 leading-relaxed">{strategyData?.photoAdvice?.content}</p>
              )}
            </div>

            {/* Ángulo de Venta */}
            <div className="p-5 bg-zinc-900/90 border border-zinc-800/80 rounded-2xl relative shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-zinc-100 text-sm">⚡ Ángulo de Venta</h3>
                {strategyData?.salesAngle?.reasoning && (
                  <button
                    type="button"
                    onClick={() => setActiveModal('salesAngle')}
                    className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2 py-0.5 rounded-md font-medium transition"
                  >
                    💡 ¿Por qué?
                  </button>
                )}
              </div>
              {isLoadingStrategy ? (
                <div className="space-y-2 animate-pulse"><div className="h-3 bg-zinc-800 rounded w-3/4"></div></div>
              ) : (
                <p className="text-xs text-zinc-300 leading-relaxed">{strategyData?.salesAngle?.content}</p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setStep(3)}
            disabled={isLoadingStrategy}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-sm transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50"
          >
            Pasar a Creación de Contenido →
          </button>
        </div>
      )}

      {/* ===================== PASO 3: FACTORÍA ===================== */}
      {step === 3 && (
        <div className="space-y-6">
          
          {/* HERRAMIENTAS DE EJECUCIÓN (Tarjetas de compra bajo demanda) */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
              Herramientas de Ejecución
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Botón Redactar Copys */}
              <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-5 shadow-xl flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-zinc-100 text-sm flex items-center gap-1.5">
                      ✍️ Redactar Copys
                    </span>
                    <span className="text-[11px] font-bold bg-blue-900/40 text-blue-400 border border-blue-800/50 px-2 py-0.5 rounded">
                      1 Crédito
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Genera textos optimizados para Instagram, Facebook, TikTok y ficha para catálogo de WhatsApp.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleGenerateCopies}
                  disabled={isGeneratingCopies}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-semibold rounded-xl text-xs transition-all shadow-md shadow-blue-600/20"
                >
                  {isGeneratingCopies ? 'Redactando con IA...' : 'Generar Textos'}
                </button>
              </div>

              {/* Botón Diseñar Pancarta */}
              <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-5 shadow-xl flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-zinc-100 text-sm flex items-center gap-1.5">
                      🎨 Pancarta Visual
                    </span>
                    <span className="text-[11px] font-bold bg-emerald-950/40 text-emerald-400 border border-emerald-800/50 px-2 py-0.5 rounded">
                      2 Créditos
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Diseña un banner publicitario de alta conversión con la imagen de tu producto y ganchos visuales.
                  </p>
                </div>

                {strategyId && (
                  <GenerateBannerButton
                    contentId={strategyId}
                    existingBannerUrl={bannerUrl}
                    visualPrompt="High-converting commercial product advertisement banner"
                  />
                )}
              </div>
            </div>
          </div>

          {/* RESULTADOS GENERADOS: MOCKUP INTERACTIVO + TIKTOK */}
          {finalCopies && (
            <div className="space-y-6 pt-4 border-t border-zinc-800/80 animate-in fade-in">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-zinc-100 text-sm">
                  Vista Previa y Activos de Campaña
                </h3>
                <span className="text-[11px] text-emerald-400 font-semibold bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded-full">
                  ● Lista para despachar
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* COLUMNA IZQUIERDA: MOCKUP NATIVO DE INSTAGRAM (5 columnas en lg) */}
                <div className="lg:col-span-5 flex flex-col items-center">
                  <div className="relative group w-full flex justify-center">
                    <div className="absolute -top-3 right-4 sm:right-12 z-30">
                      <button
                        type="button"
                        onClick={() => copyToClipboard(finalCopies.instagramCopy, 'Instagram')}
                        className="bg-blue-600 hover:bg-blue-500 text-white p-2.5 rounded-full shadow-xl transition-transform hover:scale-110 flex items-center justify-center border border-blue-400/30"
                        title="Copiar texto de Instagram"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <InstagramMockup
                      copy={finalCopies.instagramCopy}
                      imageUrl={bannerUrl || imageUrl}
                      username="urielfgx"
                    />
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-3 text-center">
                    Vista previa de feed (4:5). Haz clic en <span className="text-zinc-400">... más</span> para expandir.
                  </p>
                </div>

                {/* COLUMNA DERECHA: GUION TIKTOK + DESPACHO (7 columnas en lg) */}
                <div className="lg:col-span-7 space-y-4">
                  {/* Tarjeta TikTok */}
                  <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-5 shadow-xl flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="font-bold text-zinc-100 text-xs flex items-center gap-1.5">
                          🎵 Guion TikTok / Reels
                        </h4>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(finalCopies.tiktokScript, 'TikTok')}
                          className="text-xs bg-zinc-800 border border-zinc-700/80 hover:bg-zinc-700 text-zinc-200 px-2.5 py-1 rounded-md font-semibold transition flex items-center gap-1"
                        >
                          <Copy className="w-3 h-3" /> Copiar
                        </button>
                      </div>
                      <p className="text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto pr-1">
                        {finalCopies.tiktokScript}
                      </p>
                    </div>
                  </div>

                  {/* Botón Maestro de Publicación Automática */}
                  <div className="bg-gradient-to-r from-zinc-900 via-indigo-950/40 to-zinc-900 border border-indigo-500/30 p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
                    <div>
                      <h4 className="font-bold text-white text-sm flex items-center gap-2">
                        <span>🚀</span> Despacho Automático
                      </h4>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        Envía esta campaña en un clic a tu Instagram (@urielfgx) y Página de Facebook.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handlePublishToSocials}
                      disabled={isPublishing}
                      className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-pink-500 via-indigo-600 to-purple-600 hover:opacity-95 text-white font-bold rounded-xl text-xs sm:text-sm transition-all shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 flex-shrink-0"
                    >
                      {isPublishing ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Publicando en Meta...</span>
                        </>
                      ) : (
                        <span>🚀 Publicar en Redes</span>
                      )}
                    </button>
                  </div>
                </div>

              </div>

              {/* ==================== SELECTOR FEED / HISTORIA ==================== */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-zinc-900/90 border border-zinc-800 rounded-xl">
                <div>
                  <h4 className="font-bold text-white text-xs">Formato de Publicación Meta</h4>
                  <p className="text-[10px] text-zinc-400">Elige dónde quieres que aparezca tu campaña.</p>
                </div>
                <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setPostTarget('feed')}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                      postTarget === 'feed'
                        ? 'bg-zinc-800 text-white shadow'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    📱 Feed
                  </button>
                  <button
                    type="button"
                    onClick={() => setPostTarget('story')}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                      postTarget === 'story'
                        ? 'bg-gradient-to-r from-amber-500 via-pink-500 to-purple-600 text-white shadow-lg'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    ⚡ Historia (24h)
                  </button>
                </div>
              </div>

              {/* ==================== MOTOR DE CIERRE: WHATSAPP BUSINESS ==================== */}
              {finalCopies?.whatsapp && (
                <div className="space-y-4 pt-4 border-t border-zinc-800/80 animate-in fade-in">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center flex-shrink-0">
                      <span className="text-emerald-400 text-base">💬</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-zinc-100 text-sm">
                        Motor de Cierre: WhatsApp Business
                      </h3>
                      <p className="text-[11px] text-zinc-400">
                        Guiones tácticos de conversión para responder y cerrar ventas en el chat.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Ficha Técnica */}
                    <div className="bg-emerald-950/20 border border-emerald-900/40 rounded-xl p-4 flex flex-col justify-between space-y-3">
                      <div>
                        <h4 className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider mb-1.5">
                          📋 Ficha de Producto
                        </h4>
                        <p className="text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto pr-1">
                          {finalCopies.whatsapp.ficha}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(finalCopies.whatsapp!.ficha, 'Ficha WhatsApp')}
                        className="w-full py-1.5 bg-emerald-950/60 hover:bg-emerald-900/70 text-emerald-300 text-xs font-semibold rounded-lg border border-emerald-800/50 transition-colors"
                      >
                        Copiar Ficha
                      </button>
                    </div>

                    {/* Objeción: Precio */}
                    <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-xl p-4 flex flex-col justify-between space-y-3">
                      <div>
                        <h4 className="text-[11px] font-bold text-amber-400 uppercase tracking-wider mb-1.5">
                          💰 Objeción: "Está Caro"
                        </h4>
                        <p className="text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto pr-1">
                          {finalCopies.whatsapp.objecionPrecio}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(finalCopies.whatsapp!.objecionPrecio, 'Respuesta a Precio')}
                        className="w-full py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-lg transition-colors border border-zinc-700/60"
                      >
                        Copiar Respuesta
                      </button>
                    </div>

                    {/* Objeción: Desconfianza / Envío */}
                    <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-xl p-4 flex flex-col justify-between space-y-3">
                      <div>
                        <h4 className="text-[11px] font-bold text-blue-400 uppercase tracking-wider mb-1.5">
                          🛡️ Objeción: Desconfianza
                        </h4>
                        <p className="text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto pr-1">
                          {finalCopies.whatsapp.objecionConfianza}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(finalCopies.whatsapp!.objecionConfianza, 'Respuesta a Confianza')}
                        className="w-full py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-lg transition-colors border border-zinc-700/60"
                      >
                        Copiar Respuesta
                      </button>
                    </div>
                  </div>

                  {/* Generador de Link Directo wa.me */}
                  <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 flex flex-col sm:flex-row items-end gap-3">
                    <div className="flex-1 w-full">
                      <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                        Tu Número de WhatsApp (con código de país, ej. 52 para México)
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: 525512345678"
                        value={whatsappNumber}
                        onChange={(e) => setWhatsappNumber(e.target.value.replace(/\D/g, ''))}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-emerald-500 transition-colors"
                      />
                    </div>
                    <a
                      href={
                        whatsappNumber
                          ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
                              'Hola, me interesa comprar: ' + (productDesc || 'su producto')
                            )}`
                          : '#'
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => !whatsappNumber && e.preventDefault()}
                      className={`px-5 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 flex-shrink-0 ${
                        whatsappNumber
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/40 cursor-pointer'
                          : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                      }`}
                    >
                      <span>🔗</span> Probar Link wa.me
                    </a>
                  </div>
                </div>
              )}

              {/* BARRA DE COPILOTO (Anclada al final del contenido) */}
              <div className="pt-2">
                <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-2.5 sm:p-3 shadow-xl transition-all focus-within:border-blue-500/50 flex items-end gap-2">
                  <div className="pb-2.5 pl-2 hidden sm:block">
                    <Sparkles className="w-5 h-5 text-blue-400" />
                  </div>

                  <textarea
                    rows={1}
                    value={refinementPrompt}
                    onChange={(e) => setRefinementPrompt(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Pídele un ajuste a la IA: Ej. 'Haz el copy de Instagram más corto y persuasivo'..."
                    className="w-full bg-transparent border-none text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 focus:ring-0 focus:outline-none resize-none py-2 px-1 max-h-32 leading-relaxed"
                    style={{ minHeight: '40px' }}
                    disabled={isRefining}
                  />

                  <button
                    type="button"
                    onClick={handleRefineContent}
                    disabled={!refinementPrompt.trim() || isRefining}
                    className="p-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded-xl transition-all flex-shrink-0 shadow-sm flex items-center justify-center min-w-[40px]"
                    title="Enviar ajuste"
                  >
                    {isRefining ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <p className="text-center text-[11px] text-zinc-500 mt-2 font-medium">
                  Presiona Enter para iterar con el copiloto. El texto se actualizará en vivo dentro del mockup.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL CONTEXTUAL ¿POR QUÉ? */}
      {activeModal && strategyData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h4 className="font-bold text-white text-base">
                {modalTitles[activeModal]}
              </h4>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="text-zinc-400 hover:text-white font-bold p-1 rounded"
              >
                ✕
              </button>
            </div>
            <div className="bg-zinc-950/70 p-4 rounded-xl border border-zinc-800/60">
              <p className="text-sm text-zinc-300 leading-relaxed font-medium">
                {strategyData[activeModal]?.reasoning}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-xl text-sm transition shadow-sm"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

    </div>
  )
}

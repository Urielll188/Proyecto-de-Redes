'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ProductImageUpload } from './ProductImageUpload'
import { BlitzrPrismStage } from './prism/BlitzrPrismStage'
import { NicheGoalGlassCard } from './controls/NicheGoalGlassCard'
import { Step1ActionPanel } from './controls/Step1ActionPanel'
import { GenerateBannerButton } from './GenerateBannerButton'
import { ReelPublishButton } from './history/ReelPublishButton'
import { QuickShareModal } from '@/components/share/QuickShareModal'
import { StudioCanvasPreview, type StudioStyleTheme } from './visual/StudioCanvasPreview'
import { refineCopyAction } from '@/app/actions/refine-copies'
import { toast } from 'sonner'
import { Sparkles, Send, Copy, Palette, Check, Building2, Wrench, ShoppingBag, ShieldCheck, Download, Link2, ExternalLink, MessageCircle } from 'lucide-react'
import { InstagramMockup } from './mockups/InstagramMockup'
import { createClient } from '@/utils/supabase/client'
import { toBlob } from 'html-to-image'
import { useNicho } from '@/context/NichoContext'
import { DiagnosticoModeloIA, ModeloNegocioType, fetchVpsGet } from '@/lib/vps/types'

function cleanGiroTexto(texto: string): string {
  let limpio = (texto || '').trim().replace(/\s+/g, ' ')
  const patron = /^(?:yo\s+)?(?:hago|vendo|ofrezco|fabrico|soy|realizo|me\s+dedico\s+a|dedico\s+a|hacemos|vendemos|ofrecemos|fabricamos|somos|realizamos|nos\s+dedicamos\s+a)\s+/i
  while (patron.test(limpio)) {
    limpio = limpio.replace(patron, '').trim()
  }
  limpio = limpio.replace(/^(?:hacer|vender|ofrecer|fabricar|realizar)\s+/i, '').trim()
  return limpio.slice(0, 70) || 'tu producto o servicio'
}

function formatWaMePhone(rawPhone: string): string {
  const digits = (rawPhone || '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.length === 10) return `52${digits}`
  if (digits.length === 13 && digits.startsWith('521')) return `52${digits.slice(3)}`
  return digits
}

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
  const { isMallasOwner, nicho, modeloNegocio, syncNichoFromIdea, diagnosticarModelo } = useNicho()
  const hasInitialCampaign = Boolean(initialData?.copies || initialData?.strategyData)

  // Paso 1: Ingesta | Paso 2: Centro de Mando | Paso 3: Estudio Publicitario Profesional
  const [step, setStep] = useState<1 | 2 | 3>(hasInitialCampaign ? 3 : 1)

  // Diagnóstico Inteligente BLITZR (3 Modelos: DISTRIBUIDOR_B2B | SERVICIOS_B2B | EMPRENDEDOR_B2C)
  const [diagnosticoIA, setDiagnosticoIA] = useState<DiagnosticoModeloIA | null>(null)
  const [selectedModelo, setSelectedModelo] = useState<ModeloNegocioType>('DISTRIBUIDOR_B2B')
  const [showDiagnosticModal, setShowDiagnosticModal] = useState<boolean>(false)
  const [pendingMode, setPendingMode] = useState<'fast' | 'strategic'>('strategic')

  // Contexto Comercial Rápido (3 Píldoras de 1 Clic para precisión de modelo y catálogo)
  const [clienteObjetivoTipo, setClienteObjetivoTipo] = useState<'consumidor_final' | 'empresas_b2b' | 'ambos'>('consumidor_final')
  const [modalidadEntrega, setModalidadEntrega] = useState<'catalogo_estandar' | 'personalizado_bajo_pedido' | 'servicio_en_sitio'>('catalogo_estandar')
  const [volumenCompra, setVolumenCompra] = useState<'menudeo' | 'mayoreo' | 'proyecto'>('menudeo')

  // Estado de conexión WhatsApp del tenant activo para enlaces wa.me en 03 • ESTUDIO
  const [waNumeroVinculado, setWaNumeroVinculado] = useState<string>('')
  const [waConectado, setWaConectado] = useState<boolean>(false)
  const [customTriggerMsg, setCustomTriggerMsg] = useState<string>('')
  const [isDownloadingFlyer, setIsDownloadingFlyer] = useState<boolean>(false)

  useEffect(() => {
    if (modeloNegocio) {
      setSelectedModelo(modeloNegocio)
    }
    if (nicho?.diagnostico_ia && typeof nicho.diagnostico_ia === 'object' && 'modelo_recomendado' in nicho.diagnostico_ia) {
      const diag = nicho.diagnostico_ia as DiagnosticoModeloIA
      setDiagnosticoIA(diag)
      if (diag.cliente_objetivo_tipo && ['consumidor_final', 'empresas_b2b', 'ambos'].includes(diag.cliente_objetivo_tipo)) {
        setClienteObjetivoTipo(diag.cliente_objetivo_tipo as any)
      }
      if (diag.modalidad_entrega && ['catalogo_estandar', 'personalizado_bajo_pedido', 'servicio_en_sitio'].includes(diag.modalidad_entrega)) {
        setModalidadEntrega(diag.modalidad_entrega as any)
      }
      if (diag.volumen_compra && ['menudeo', 'mayoreo', 'proyecto'].includes(diag.volumen_compra)) {
        setVolumenCompra(diag.volumen_compra as any)
      }
    }
  }, [modeloNegocio, nicho])

  useEffect(() => {
    let active = true
    const cargarWaEstatus = async () => {
      try {
        const cid = isMallasOwner ? 'mallas_tlaxcalli' : nicho?.cliente_id || ''
        const res = await fetchVpsGet('/estatus_wa', cid ? { cliente_id: cid } : undefined)
        if (!active || !res || res.vpsOffline) return
        setWaConectado(Boolean(res.conectado))
        setWaNumeroVinculado(String(res.numero_vinculado || res.numero || ''))
      } catch {
        // Silencioso si el VPS tarda
      }
    }
    cargarWaEstatus()
    return () => {
      active = false
    }
  }, [isMallasOwner, nicho?.cliente_id, step])

  // Entradas del Paso 1
  const [imageUrl, setImageUrl] = useState<string | null>(initialData?.imageUrl || null)
  const [mediaType, setMediaType] = useState<'image' | 'video'>(
    initialData?.imageUrl && /\.(mp4|mov|m4v|webm)(\?.*)?$/i.test(initialData.imageUrl)
      ? 'video'
      : 'image'
  )
  const [storagePath, setStoragePath] = useState<string | null>(null)
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [productDesc, setProductDesc] = useState(initialData?.productDesc || '')
  const [bannerUrl, setBannerUrl] = useState<string | null>(initialData?.bannerUrl || null)
  const [niche, setNiche] = useState<string>('Producto Físico')
  const [goal, setGoal] = useState<string>('Venta Inmediata')

  const handleNicheChange = (newNiche: string) => {
    setNiche(newNiche)
    if (newNiche === 'Servicio Local') {
      setClienteObjetivoTipo('empresas_b2b')
      setModalidadEntrega('servicio_en_sitio')
      setVolumenCompra('proyecto')
    } else if (newNiche === 'Producto Físico' || newNiche === 'E-commerce' || newNiche === 'Marca Personal') {
      setClienteObjetivoTipo('consumidor_final')
      setModalidadEntrega('catalogo_estandar')
      setVolumenCompra('menudeo')
    }
  }

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

  // Estados locales para el Estudio de Guiones y Copys (Paso 2 - R3)
  const [activeChannelTab, setActiveChannelTab] = useState<'tiktok' | 'instagram' | 'whatsapp'>('tiktok')
  const [isCopied, setIsCopied] = useState(false)
  const copyTextareaRef = useRef<HTMLTextAreaElement>(null)

  // Ajuste automático de altura para evitar scrollbars internas
  const adjustTextareaHeight = () => {
    if (copyTextareaRef.current) {
      copyTextareaRef.current.style.height = 'auto'
      copyTextareaRef.current.style.height = `${Math.max(220, copyTextareaRef.current.scrollHeight)}px`
    }
  }

  useEffect(() => {
    adjustTextareaHeight()
  }, [activeChannelTab, editableTtScript, editableIgCopy, editableWaText, step])

  const handleCopyCurrentTab = async () => {
    let text = ''
    let label = ''
    if (activeChannelTab === 'tiktok') {
      text = editableTtScript
      label = 'TikTok / Reels'
    } else if (activeChannelTab === 'instagram') {
      text = editableIgCopy
      label = 'Instagram Feed'
    } else {
      text = editableWaText
      label = 'WhatsApp'
    }
    await copyToClipboard(text, label)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  // ===================== ESTADOS PASO 3: ESTUDIO PUBLICITARIO UNIFICADO (1080×1350) + COPILOTO IA =====================
  const initialSceneIsClean = Boolean(
    initialData?.bannerUrl && !initialData.bannerUrl.includes('/banners/')
  )
  const [sceneUrl, setSceneUrl] = useState<string | null>(
    initialSceneIsClean ? initialData?.bannerUrl || null : null
  )
  const setVisualOutput = (url: string | null) => setSceneUrl(url)
  const [isGeneratingScene, setIsGeneratingScene] = useState(false)
  const [cutoutProductUrl, setCutoutProductUrl] = useState<string | null>(
    initialData?.imageUrl && initialData.imageUrl.includes('-nobg.png')
      ? initialData.imageUrl
      : null
  )
  const [isRemovingBg, setIsRemovingBg] = useState(false)
  const [useCutout, setUseCutout] = useState(true)
  const autoCutoutTriggeredRef = useRef(false)
  const autoSceneTriggeredRef = useRef(false)
  const [isBakingBanner, setIsBakingBanner] = useState(false)
  const [headline, setHeadline] = useState(
    initialData?.productDesc
      ? cleanGiroTexto(initialData.productDesc).toUpperCase().slice(0, 42)
      : 'EDICIÓN ESPECIAL'
  )
  const [subline, setSubline] = useState('Calidad superior y atención personalizada')
  const [ctaText, setCtaText] = useState('Pedir por WhatsApp')
  const [badgeText, setBadgeText] = useState('DESTACADO')
  const [styleTheme, setStyleTheme] = useState<StudioStyleTheme>('minimal-dark')

  // Estados de precio, escala, posición y Sala de Chat Creativa IA
  const [studioPrice, setStudioPrice] = useState<string>('')
  const [studioComparePrice, setStudioComparePrice] = useState<string>('')
  const [studioProductScale, setStudioProductScale] = useState<number>(1.0)
  const [studioProductOffsetY, setStudioProductOffsetY] = useState<number>(0)
  const [customScenePrompt, setCustomScenePrompt] = useState<string>('')
  const [showCmoStrategyPanel, setShowCmoStrategyPanel] = useState<boolean>(false)
  const [showManualControls, setShowManualControls] = useState<boolean>(false)
  const [studioChatMessages, setStudioChatMessages] = useState<
    Array<{ role: 'assistant' | 'user'; text: string }>
  >([
    {
      role: 'assistant',
      text: '¡Hola! Soy tu Copiloto de Diseño en Vivo. Pídeme cambios de fondo fotográfico IA, iluminación, textos, precios, descuentos o tamaño del producto y actualizaré tu arte 1080×1350 al instante.',
    },
  ])
  const [studioChatInput, setStudioChatInput] = useState<string>('')
  const [isSendingStudioChat, setIsSendingStudioChat] = useState<boolean>(false)
  const studioFileInputRef = useRef<HTMLInputElement>(null)

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

  // Diagnóstico heurístico local de respaldo por si la red tarda
  const buildLocalFallbackDiagnostic = (
    desc: string,
    cat: string,
    obj: string,
    cliTipo: 'consumidor_final' | 'empresas_b2b' | 'ambos' = clienteObjetivoTipo,
    modEnt: 'catalogo_estandar' | 'personalizado_bajo_pedido' | 'servicio_en_sitio' = modalidadEntrega,
    volCom: 'menudeo' | 'mayoreo' | 'proyecto' = volumenCompra
  ): DiagnosticoModeloIA => {
    const giroLimpio = cleanGiroTexto(desc)
    const low = `${desc} ${cat} ${obj}`.toLowerCase()
    const hitsB2C = /(tupper|cat[aá]logo|comida|postre|ropa|cosm[eé]tico|maquillaje|perfume|colonia|vecinos|venta directa|avon|mary kay|shein|menudeo|impresi[oó]n 3d|3d|regalo|personaliz|figura)/.test(low)
    const hitsServ = /(instalaci[oó]n|redes|cableado|wifi|cctv|c[aá]maras|mantenimiento|servicio|reparaci[oó]n|consultor[ií]a|soporte|software|agencia)/.test(low)

    // Regla 1: Consumidor final al menudeo o bajo pedido/catálogo
    if (cliTipo === 'consumidor_final' && (volCom === 'menudeo' || modEnt === 'catalogo_estandar' || modEnt === 'personalizado_bajo_pedido' || !volCom)) {
      const esPersonalizado = modEnt === 'personalizado_bajo_pedido' || /personaliz|3d|medida|dise[nñ]o|custom|pedido/.test(low)
      return {
        ok: true,
        modelo_recomendado: 'EMPRENDEDOR_B2C',
        scores: { distribuidor: 25, servicios: 20, particular: 95 },
        titulo_veredicto: `Modelo Recomendado: Emprendedor B2C (Inbound Seguro — ${giroLimpio})`,
        explicacion_estrategica: esPersonalizado
          ? `Al vender ${giroLimpio} personalizado directo a personas (B2C), escribir en frío a desconocidos genera reportes y bloquea tu línea de WhatsApp. Conviene operar 100% Inbound: los clientes llegan atraídos por tus anuncios de 03 • ESTUDIO y Andrea solicita medidas, archivo o diseño para cotizar y cerrar de forma segura.`
          : `Tu oferta de ${giroLimpio} va dirigida al consumidor final (B2C). Enviar mensajes masivos en frío causa bloqueos de WhatsApp. En Modo Inbound 24/7, atraes interesados con los creativos de 03 • ESTUDIO y Andrea atiende y cierra pedidos 24/7 en cuanto te contactan.`,
        clientes_objetivo: esPersonalizado
          ? `Compradores de ${giroLimpio}, personas que buscan regalos personalizados, coleccionistas o clientes que solicitan piezas a medida`
          : `Consumidores finales, seguidores en redes sociales y personas interesadas en ${giroLimpio}`,
        keywords_sugeridas: [
          `${giroLimpio} personalizado`,
          'pedidos a medida',
          'catalogo digital',
          'entregas locales',
          'promociones especiales',
          'atencion personalizada',
        ],
        enfoque_andrea: esPersonalizado
          ? `Atención inbound personalizada: pedir detalles específicos (medidas, material, color o archivo/diseño de referencia), resolver dudas y cotizar antes de confirmar el pedido`
          : `Atención inbound de catálogo para ${giroLimpio}, envío de opciones disponibles y cierre rápido de pedido a domicilio o entrega local`,
        cliente_objetivo_tipo: cliTipo,
        modalidad_entrega: modEnt,
        volumen_compra: volCom,
      }
    }

    // Regla 2: Servicios en sitio o proyectos B2B
    if (modEnt === 'servicio_en_sitio' || (modEnt === 'personalizado_bajo_pedido' && (cliTipo === 'empresas_b2b' || cliTipo === 'ambos') && volCom === 'proyecto') || (hitsServ && !hitsB2C)) {
      return {
        ok: true,
        modelo_recomendado: 'SERVICIOS_B2B',
        scores: { distribuidor: 48, servicios: 95, particular: 28 },
        titulo_veredicto: `Modelo Recomendado: Servicios Técnicos y Proyectos B2B (${giroLimpio})`,
        explicacion_estrategica: `Tu modelo para ${giroLimpio} requiere análisis técnico o visita en sitio. El Cazador 24/7 localiza empresas, comercios y oficinas afines, permitiendo que Andrea califique alcances técnicos y agende levantamientos o visitas de cotización.`,
        clientes_objetivo: `Empresas, oficinas, comercios, despachos o corporativos que requieran ${giroLimpio}`,
        keywords_sugeridas: [
          `servicios de ${giroLimpio}`,
          'levantamiento tecnico',
          'cotizacion corporativa',
          'mantenimiento y proyectos',
          'empresas y oficinas',
          'atencion a negocios',
        ],
        enfoque_andrea: `Diagnóstico consultivo para ${giroLimpio}, levantamiento de requerimientos técnicos (medidas, especificaciones, archivos o visita en sitio) y cotización de proyecto`,
        cliente_objetivo_tipo: cliTipo,
        modalidad_entrega: modEnt,
        volumen_compra: volCom,
      }
    }

    // Regla 3: Distribuidor mayorista B2B
    return {
      ok: true,
      modelo_recomendado: 'DISTRIBUIDOR_B2B',
      scores: { distribuidor: 95, servicios: 45, particular: 22 },
      titulo_veredicto: `Modelo Recomendado: Proveedor Mayorista / Distribuidor B2B (${giroLimpio})`,
      explicacion_estrategica: `Tu oferta de ${giroLimpio} tiene alto potencial de reventa o suministro a negocios. El Cazador 24/7 prospecta comercios de tu giro en INEGI DENUE y Google Maps, y Andrea presenta paquetes mayoristas con entrega programada.`,
      clientes_objetivo: `Comercios establecidos, distribuidores y compradores comerciales que consuman o revendan ${giroLimpio}`,
      keywords_sugeridas: [
        `mayoreo de ${giroLimpio}`,
        'distribuidores locales',
        'proveedores comerciales',
        'pedidos por volumen',
        'tiendas del giro',
        'suministro recurrente',
      ],
      enfoque_andrea: `Presentación de catálogo mayorista para ${giroLimpio}, escalas de precios por volumen y cierre de pedidos con entrega`,
      cliente_objetivo_tipo: cliTipo,
      modalidad_entrega: modEnt,
      volumen_compra: volCom,
    }
  }

  // Paso 1A: Al presionar "Dar inicio a mi idea", diagnosticar modelo de negocio y mostrar tarjeta de veredicto
  const handleGenerate = async (mode: 'fast' | 'strategic' = 'strategic') => {
    if (!productDesc.trim()) {
      toast.error('Por favor describe brevemente qué vas a vender o qué servicio ofreces')
      return
    }

    setPendingMode(mode)
    setGenerationMode(mode)
    setIsGenerating(true)
    const toastId = toast.loading('🧠 Analizando tu idea y diagnosticando el modelo comercial ideal...')

    try {
      const diag =
        (await diagnosticarModelo({
          descripcion_idea: productDesc.trim(),
          nicho_categoria: niche,
          objetivo: goal,
          cliente_objetivo_tipo: clienteObjetivoTipo,
          modalidad_entrega: modalidadEntrega,
          volumen_compra: volumenCompra,
        })) || buildLocalFallbackDiagnostic(productDesc.trim(), niche, goal, clienteObjetivoTipo, modalidadEntrega, volumenCompra)

      setDiagnosticoIA(diag)
      setSelectedModelo(diag.modelo_recomendado)
      setShowDiagnosticModal(true)
      toast.success('¡Diagnóstico Inteligente BLITZR listo! Revisa y confirma tu modelo operativo.', {
        id: toastId,
      })
    } catch {
      const fallback = buildLocalFallbackDiagnostic(productDesc.trim(), niche, goal, clienteObjetivoTipo, modalidadEntrega, volumenCompra)
      setDiagnosticoIA(fallback)
      setSelectedModelo(fallback.modelo_recomendado)
      setShowDiagnosticModal(true)
      toast.success('¡Diagnóstico Inteligente BLITZR listo!', { id: toastId })
    } finally {
      setIsGenerating(false)
    }
  }

  // Paso 1B: Confirmar el modelo elegido en la tarjeta y ejecutar la generación completa + guardado de perfil
  const executeCampaignGeneration = async (
    mode: 'fast' | 'strategic' = pendingMode,
    chosenModel: ModeloNegocioType = selectedModelo,
    diagData: DiagnosticoModeloIA | null = diagnosticoIA
  ) => {
    if (!productDesc.trim()) return

    setShowDiagnosticModal(false)
    setIsGenerating(true)
    setCmoAnalysis(null)
    setGenerationMode(mode)

    const finalDiag = diagData
      ? {
          ...diagData,
          cliente_objetivo_tipo: clienteObjetivoTipo,
          modalidad_entrega: modalidadEntrega,
          volumen_compra: volumenCompra,
        }
      : {
          cliente_objetivo_tipo: clienteObjetivoTipo,
          modalidad_entrega: modalidadEntrega,
          volumen_compra: volumenCompra,
        }

    // Guardar de inmediato el modelo y perfil en SQLite para usuarios nuevos
    if (!isMallasOwner) {
      await syncNichoFromIdea({
        nombre_negocio: productDesc.trim().split('.')[0].split('\n')[0].slice(0, 48) || 'Mi Negocio',
        giro_objetivo: diagData?.clientes_objetivo || niche,
        niche,
        productDesc: productDesc.trim(),
        oferta_gancho: productDesc.trim().slice(0, 180),
        keywords_busqueda: diagData?.keywords_sugeridas?.join(', ') || '',
        modelo_negocio: chosenModel,
        cliente_objetivo_tipo: clienteObjetivoTipo,
        modalidad_entrega: modalidadEntrega,
        volumen_compra: volumenCompra,
        diagnostico_ia: finalDiag,
        nombre_agente: 'Andrea',
      })
    }

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
          imageBase64: imageBase64 || undefined,
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
      } else {
        setSubline(diagData?.enfoque_andrea || 'Atención personalizada y calidad garantizada')
      }

      if (modalidadEntrega === 'personalizado_bajo_pedido') {
        setBadgeText('HECHO A MEDIDA')
      } else if (chosenModel === 'SERVICIOS_B2B') {
        setBadgeText('SERVICIO PROFESIONAL')
      } else {
        setBadgeText('EDICIÓN ESPECIAL')
      }

      // Si el usuario mencionó un precio en su idea (ej. $350), precargarlo en el lienzo
      const priceMatch = productDesc.match(/\$\s*(\d{2,6})/)
      if (priceMatch && priceMatch[1]) {
        setStudioPrice(priceMatch[1])
      }

      // Sincronizar automáticamente el perfil del negocio con perfiles_nicho en SQLite para usuarios nuevos
      if (!isMallasOwner) {
        const avatarText = diagData?.clientes_objetivo || data.cmoAnalysis?.avatar || data.estrategia?.avatar_cliente || ''
        const offerText =
          data.cmoAnalysis?.irresistibleOffer ||
          data.estrategia?.oferta_irresistible ||
          waText ||
          productDesc.trim().slice(0, 180)
        const angleText = data.cmoAnalysis?.angle || data.estrategia?.angulo_gancho || ''
        const catalogoPrompt = [
          `Modelo Operativo: ${chosenModel}`,
          `Producto / Servicio: ${productDesc.trim()}`,
          `Nicho: ${niche} | Objetivo: ${goal}`,
          avatarText ? `Clientes Objetivo: ${avatarText}` : '',
          diagData?.enfoque_andrea ? `Enfoque de Cierre Andrea: ${diagData.enfoque_andrea}` : '',
          offerText ? `Oferta Gancho: ${offerText}` : '',
          angleText ? `Ángulo de Venta: ${angleText}` : '',
          waText ? `Guion WhatsApp: ${waText}` : '',
          igText ? `Copy Comercial: ${igText}` : '',
        ]
          .filter(Boolean)
          .join('\n')
          .slice(0, 2500)

        syncNichoFromIdea({
          nombre_negocio: headlineText,
          giro_objetivo: avatarText ? `${avatarText.slice(0, 140)}` : niche,
          niche,
          productDesc: productDesc.trim(),
          oferta_gancho: offerText,
          keywords_busqueda: diagData?.keywords_sugeridas?.join(', ') || '',
          catalogo_prompt: catalogoPrompt,
          modelo_negocio: chosenModel,
          diagnostico_ia: diagData || {},
          nombre_agente: 'Andrea',
        })
      }

      // Guardar la estrategia CMO para el panel colapsable y pasar DIRECTO a 03 • ESTUDIO sin bloqueo
      if (data.cmoAnalysis) {
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
      } else {
        setCmoAnalysis(null)
      }

      setStep(3)
      // Disparar generación del escenario fotográfico IA acorde al giro y recorte del producto si existe foto
      handleGenerateStudioScene(undefined, styleTheme)
      if (!isVideoMedia && imageUrl && !cutoutProductUrl && !isRemovingBg) {
        handleRemoveBackground(imageUrl)
      }
      toast.success('¡Estudio Creativo listo! Personaliza tu arte con el Copiloto IA en vivo.', {
        id: toastId,
      })
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

  // 2. Publicar en Instagram / Facebook Feed (/api/meta/feed/publish) compilando el lienzo si aún no se ha horneado
  const handlePublishIgFeed = async () => {
    if (isVideoMedia) {
      toast.error('El archivo actual es un video. Usa el botón de Meta Reels.')
      return
    }

    setIsPublishingFeed(true)
    const toastId = toast.loading('Preparando arte 1080×1350 y publicando en Instagram / Facebook...')

    try {
      let targetMedia = bannerUrl
      const canvasElement = document.getElementById('studio-canvas-container')

      if (canvasElement) {
        if (typeof document !== 'undefined' && document.fonts) {
          await document.fonts.ready
        }
        const blob = await toBlob(canvasElement, {
          quality: 0.98,
          canvasWidth: 1080,
          canvasHeight: 1350,
          pixelRatio: 2,
          cacheBust: true,
          filter: () => true,
        })
        if (blob) {
          const supabase = createClient()
          const {
            data: { user },
          } = await supabase.auth.getUser()
          const safeUserId = user?.id || 'public'
          const filePath = `${safeUserId}/banners/banner-${Date.now()}.png`
          let targetBucket = 'blitzr-vault'
          const { error: uploadError } = await supabase.storage
            .from(targetBucket)
            .upload(filePath, blob, { contentType: 'image/png', upsert: true })
          if (uploadError) {
            targetBucket = 'product-images'
            await supabase.storage
              .from(targetBucket)
              .upload(filePath, blob, { contentType: 'image/png', upsert: true })
          }
          const {
            data: { publicUrl: compiledUrl },
          } = supabase.storage.from(targetBucket).getPublicUrl(filePath)
          if (compiledUrl) {
            targetMedia = compiledUrl
            setBannerUrl(compiledUrl)
          }
        }
      }

      if (!targetMedia) {
        targetMedia = publicationProxy.bannerUrl || publicationProxy.publicUrl
      }

      if (!targetMedia) {
        throw new Error('Primero genera el arte en el lienzo antes de publicar.')
      }

      const res = await fetch('/api/meta/feed/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: targetMedia,
          caption: publicationProxy.instagramCopy || copyMarketplaceEstudio,
          publicationId: publicationProxy.id || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al publicar en Instagram Feed')
      }

      setIsFeedPublished(true)
      toast.success('¡Arte 1080×1350 publicado en tu Feed con éxito!', { id: toastId })
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

  // 5. Paso 3: Generación de Escena Fotográfica de Estudio con IA (100% contextual y libre de CORS)
  const handleGenerateStudioScene = async (
    customPromptOverride?: string,
    themeOverride?: StudioStyleTheme
  ) => {
    setIsGeneratingScene(true)
    const toastId = toast.loading('🎨 Renderizando escenario fotográfico de estudio 1080×1350 con IA...')

    try {
      const effectiveStyle = themeOverride || styleTheme
      const themeLabel =
        effectiveStyle === 'clean-light'
          ? 'Clean Light'
          : effectiveStyle === 'bold-retail'
          ? 'Bold Retail'
          : 'Minimal Dark'

      const promptToUse =
        customPromptOverride !== undefined ? customPromptOverride : customScenePrompt

      const res = await fetch('/api/generate/visual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          niche,
          productDesc: productDesc.trim(),
          customPrompt: promptToUse,
          theme: themeLabel,
          styleTheme: effectiveStyle,
        }),
      })

      const data = await res.json()
      if (res.ok && data?.success && (data?.sceneDataUrl || data?.sceneUrl || data?.publicUrl)) {
        const rawUrl = data.sceneDataUrl || `${data.sceneUrl || data.publicUrl}?v=${Date.now()}`
        setSceneUrl(rawUrl)
        toast.success('¡Escenario fotográfico de estudio actualizado!', { id: toastId })
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
    const toastId = toast.loading('✨ Integrando producto con fondo transparente...')

    try {
      const res = await fetch('/api/images/remove-background', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: urlToProcess }),
      })

      const data = await res.json()
      if (!res.ok || !data.success || (!data.transparentDataUrl && !data.transparentUrl)) {
        throw new Error(data.error || 'No se pudo aislar el fondo')
      }

      setCutoutProductUrl(data.transparentDataUrl || data.transparentUrl)
      setUseCutout(true)
      toast.success('¡Producto recortado e integrado sobre la escena!', { id: toastId })
    } catch (err: any) {
      toast.error(err.message || 'Usando imagen original en el escenario', { id: toastId })
    } finally {
      setIsRemovingBg(false)
    }
  }

  // Auto-recorte de fondo y escena fotográfica al reanudar un proyecto desde la Bóveda en Paso 3
  useEffect(() => {
    if (step !== 3) return
    if (imageUrl && !isVideoMedia && !cutoutProductUrl && !isRemovingBg && !autoCutoutTriggeredRef.current) {
      autoCutoutTriggeredRef.current = true
      if (imageUrl.includes('-nobg.png')) {
        setCutoutProductUrl(imageUrl)
        setUseCutout(true)
      } else {
        handleRemoveBackground(imageUrl)
      }
    }
    if (!sceneUrl && !isGeneratingScene && !autoSceneTriggeredRef.current) {
      autoSceneTriggeredRef.current = true
      handleGenerateStudioScene(undefined, styleTheme)
    }
  }, [step, imageUrl, isVideoMedia, cutoutProductUrl, isRemovingBg, sceneUrl, isGeneratingScene])

  // 6B. Subir o Cambiar Foto del Producto directamente dentro de 03 • ESTUDIO
  const handleStudioProductUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Selecciona un archivo de imagen (JPG, PNG o WebP).')
      return
    }

    setIsUploadingToStorage(true)
    const toastId = toast.loading('Subiendo foto del producto y recortando fondo...')
    try {
      const supabase = createClient()
      const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
      const filePath = `${userId}/${Date.now()}_${cleanName}`
      const { data, error } = await supabase.storage
        .from('product-images')
        .upload(filePath, file, { cacheControl: '3600', upsert: false })
      if (error) throw error

      const {
        data: { publicUrl },
      } = supabase.storage.from('product-images').getPublicUrl(data.path)

      setMediaType('image')
      setImageUrl(publicUrl)
      setStoragePath(data.path)
      setCutoutProductUrl(null)
      toast.success('¡Foto cargada! Integrando en el escenario...', { id: toastId })
      await handleRemoveBackground(publicUrl)
    } catch (err: any) {
      toast.error(err.message || 'No se pudo subir la imagen', { id: toastId })
    } finally {
      setIsUploadingToStorage(false)
      if (studioFileInputRef.current) studioFileInputRef.current.value = ''
    }
  }

  // 6C. Sala de Chat Creativa IA (Copiloto de Diseño en Vivo -> POST /api/estudio/editar-arte)
  const handleSendStudioChat = async (quickPrompt?: string) => {
    const msg = (quickPrompt !== undefined ? quickPrompt : studioChatInput).trim()
    if (!msg || isSendingStudioChat) return

    if (quickPrompt === undefined) {
      setStudioChatInput('')
    }

    setStudioChatMessages((prev) => [...prev, { role: 'user', text: msg }])
    setIsSendingStudioChat(true)

    try {
      const res = await fetch('/api/estudio/editar-arte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mensaje: msg,
          estado_actual: {
            titular: headline,
            subtitulo: subline,
            badge: badgeText,
            precio: studioPrice,
            precio_anterior: studioComparePrice,
            estilo: styleTheme,
            escala_producto: studioProductScale,
            offset_y_producto: studioProductOffsetY,
            prompt_fondo: customScenePrompt,
            descripcion_producto: productDesc,
          },
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'No se pudo procesar el ajuste de diseño.')
      }

      if (data.titular !== undefined) setHeadline(data.titular)
      if (data.subtitulo !== undefined) setSubline(data.subtitulo)
      if (data.badge !== undefined) setBadgeText(data.badge)
      if (data.precio !== undefined) setStudioPrice(data.precio)
      if (data.precio_anterior !== undefined) setStudioComparePrice(data.precio_anterior)
      if (data.estilo) setStyleTheme(data.estilo)
      if (typeof data.escala_producto === 'number') setStudioProductScale(data.escala_producto)
      if (typeof data.offset_y_producto === 'number') setStudioProductOffsetY(data.offset_y_producto)

      setStudioChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: data.respuesta_chat || '¡Listo! Actualicé el diseño en tu lienzo.',
        },
      ])

      if (data.regenerar_fondo) {
        const nextPrompt = data.nuevo_prompt_fondo || msg
        setCustomScenePrompt(nextPrompt)
        await handleGenerateStudioScene(nextPrompt, data.estilo || styleTheme)
      }
    } catch (err: any) {
      setStudioChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: err.message || 'Ocurrió un detalle al aplicar el cambio. Intenta de nuevo.',
        },
      ])
    } finally {
      setIsSendingStudioChat(false)
    }
  }

  // Transición asistida a Paso 3 (dispara rembg en segundo plano si es imagen y sincroniza estrategia editada)
  const goToStep3 = () => {
    if (!isMallasOwner && productDesc.trim()) {
      const avatarText =
        diagnosticoIA?.clientes_objetivo ||
        cmoAnalysis?.avatar ||
        campaignData?.estrategia?.avatar_cliente ||
        ''
      const offerText =
        cmoAnalysis?.irresistibleOffer ||
        campaignData?.estrategia?.oferta_irresistible ||
        editableWaText ||
        productDesc.trim().slice(0, 180)
      const catalogoPrompt = [
        `Modelo Operativo: ${selectedModelo}`,
        `Producto / Idea: ${productDesc.trim()}`,
        `Nicho: ${niche} | Objetivo: ${goal}`,
        avatarText ? `Cliente Objetivo: ${avatarText}` : '',
        diagnosticoIA?.enfoque_andrea ? `Enfoque Andrea: ${diagnosticoIA.enfoque_andrea}` : '',
        offerText ? `Oferta Gancho: ${offerText}` : '',
        editableWaText ? `Guion WhatsApp: ${editableWaText}` : '',
        editableIgCopy ? `Copy Comercial: ${editableIgCopy}` : '',
      ]
        .filter(Boolean)
        .join('\n')
        .slice(0, 2500)

      syncNichoFromIdea({
        nombre_negocio: headline || productDesc.trim().slice(0, 40),
        giro_objetivo: avatarText ? `${avatarText.slice(0, 140)}` : niche,
        niche,
        productDesc: productDesc.trim(),
        oferta_gancho: offerText,
        keywords_busqueda: diagnosticoIA?.keywords_sugeridas?.join(', ') || '',
        catalogo_prompt: catalogoPrompt,
        modelo_negocio: selectedModelo,
        diagnostico_ia: diagnosticoIA || {},
        nombre_agente: 'Andrea',
      })
    }
    setStep(3)
    if (!isVideoMedia && imageUrl && !cutoutProductUrl && !isRemovingBg) {
      handleRemoveBackground(imageUrl)
    }
  }

  // 7. Paso 3: Compilación Final de Pancarta (Bake / Exportación Segura 1080x1350 HD)
  const handleBakeBanner = async () => {
    setIsBakingBanner(true)
    const toastId = toast.loading('Renderizando arte 1080×1350 HD y guardando en Bóveda...')

    try {
      // 1. Asegurar carga de tipografías web
      if (typeof document !== 'undefined' && document.fonts) {
        await document.fonts.ready
      }

      const canvasElement = document.getElementById('studio-canvas-container')
      if (!canvasElement) {
        throw new Error('No se encontró el contenedor #studio-canvas-container.')
      }

      // 2. Renderizado nativo a Blob 1080x1350 HD
      const blob = await toBlob(canvasElement, {
        quality: 0.98,
        canvasWidth: 1080,
        canvasHeight: 1350,
        pixelRatio: 2,
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
      const { error: uploadError } = await supabase.storage
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
      toast.success('¡Arte 1080×1350 guardado con éxito en tu Bóveda!', { id: toastId })
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

  // Descarga local directa de Pieza Visual / Flyer 1080x1350 HD en PNG desde 03 • ESTUDIO
  const handleDownloadFlyerLocal = async () => {
    setIsDownloadingFlyer(true)
    const toastId = toast.loading('Exportando PNG HD (1080×1350 px)...')
    try {
      if (typeof document !== 'undefined' && document.fonts) {
        await document.fonts.ready
      }
      const canvasElement = document.getElementById('studio-canvas-container')
      if (!canvasElement) {
        throw new Error('No se encontró el lienzo del estudio.')
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
        throw new Error('No se pudo generar el archivo PNG.')
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `blitzr-arte-1080x1350-${Date.now()}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 4000)
      toast.success('¡Flyer descargado listo para publicar en tus redes y estados!', { id: toastId })
    } catch (err: any) {
      toast.error(err.message || 'No se pudo descargar el flyer.', { id: toastId })
    } finally {
      setIsDownloadingFlyer(false)
    }
  }

  // Kit Inbound 03 • ESTUDIO conectado a Andrea IA (wa.me + Copys listos para copiar)
  const giroLimpioEstudio = cleanGiroTexto(
    productDesc || nicho?.oferta_gancho || nicho?.nombre_negocio || 'nuestros productos y servicios'
  )
  const nombreAgenteEstudio = nicho?.nombre_agente || (isMallasOwner ? 'Paola' : 'Andrea')
  const esPersonalizadoEstudio =
    modalidadEntrega === 'personalizado_bajo_pedido' ||
    /personaliz|3d|medida|dise[nñ]o|custom|pedido/i.test(giroLimpioEstudio)

  const defaultTriggerMsgEstudio = isMallasOwner
    ? 'Hola Paola 👋 Vi su promoción del Paquete Completo de Mantenimiento ($1,713 MXN) con envío gratis y me gustaría pedir informes.'
    : esPersonalizadoEstudio
    ? `Hola ${nombreAgenteEstudio} 👋 Vi su anuncio de ${giroLimpioEstudio} y me gustaría cotizar un pedido personalizado.`
    : selectedModelo === 'SERVICIOS_B2B' || modalidadEntrega === 'servicio_en_sitio'
    ? `Hola ${nombreAgenteEstudio} 👋 Vi su servicio de ${giroLimpioEstudio} y me gustaría solicitar una cotización o visita técnica.`
    : `Hola ${nombreAgenteEstudio} 👋 Vi su catálogo de ${giroLimpioEstudio} y me gustaría conocer precios y disponibilidad.`

  const activeTriggerMsgEstudio = (customTriggerMsg || defaultTriggerMsgEstudio).trim()
  const cleanPhoneWaMe = formatWaMePhone(waNumeroVinculado)
  const waMeLinkEstudio = cleanPhoneWaMe
    ? `https://wa.me/${cleanPhoneWaMe}?text=${encodeURIComponent(activeTriggerMsgEstudio)}`
    : `https://wa.me/52TUNUMERO?text=${encodeURIComponent(activeTriggerMsgEstudio)}`

  const copyWaStatusEstudio = isMallasOwner
    ? `⚙️ *MALLAS TLAXCALLI* • Paquete Completo de Mantenimiento ($1,713 MXN): Testalera + Transportadora Cal 14 + Balero 7210B alemán con Envío GRATIS y pago al recibir.\n📲 Responde este estado o toca aquí para pedir tu kit con Paola:\n${waMeLinkEstudio}`
    : esPersonalizadoEstudio
    ? `✨ ¡Hacemos realidad tus ideas en *${giroLimpioEstudio}*! Trabajamos diseños personalizados a tu medida y por catálogo.\n📲 Responde este estado o toca el enlace para enviarnos tu idea, foto o medidas y ${nombreAgenteEstudio} te cotiza al instante:\n${waMeLinkEstudio}`
    : selectedModelo === 'SERVICIOS_B2B'
    ? `🛠️ Especialistas en *${giroLimpioEstudio}* para empresas, comercios y proyectos. Diagnóstico técnico y garantía.\n📲 Toca el enlace para agendar cotización o visita técnica con ${nombreAgenteEstudio}:\n${waMeLinkEstudio}`
    : `🔥 ¡Ya disponible: *${giroLimpioEstudio}*! Calidad garantizada y atención inmediata 24/7.\n📲 Responde este estado o toca el enlace para ver catálogo y hacer tu pedido con ${nombreAgenteEstudio}:\n${waMeLinkEstudio}`

  const copyMarketplaceEstudio = isMallasOwner
    ? `🔥 PAQUETE COMPLETO MANTENIMIENTO TORTILLADORA ($1,713 MXN) — ENVÍO GRATIS\n\n✅ 1 Malla Testalera (23 cm x 1.40 m)\n✅ 1 Malla Transportadora (10 pulg x 9 m Calibre 14 reforzado)\n✅ 1 Balero 7210B alemán alta duración\n💰 Ahorra casi $1,000 MXN directo de fábrica vs refaccionaria. Pagas al recibir.\n\n📲 Pide tu paquete directo por WhatsApp con Paola aquí:\n${waMeLinkEstudio}`
    : esPersonalizadoEstudio
    ? `🔥 ${giroLimpioEstudio.toUpperCase()} — DISEÑOS PERSONALIZADOS Y CATÁLOGO\n\n✅ Piezas y pedidos hechos a tu medida con excelente acabado\n✅ Cotiza enviando tu idea, foto, medidas, color o archivo de referencia\n✅ Atención inmediata 24/7 con ${nombreAgenteEstudio}\n\n📲 Mándanos mensaje directo por WhatsApp para cotizar tu pedido:\n${waMeLinkEstudio}`
    : selectedModelo === 'SERVICIOS_B2B'
    ? `🛠️ SERVICIO PROFESIONAL: ${giroLimpioEstudio.toUpperCase()}\n\n✅ Atención especializada a empresas, oficinas, comercios y proyectos\n✅ Levantamiento técnico y cotización transparente\n✅ Atención inmediata 24/7 con ${nombreAgenteEstudio}\n\n📲 Agenda tu visita técnica o cotización por WhatsApp aquí:\n${waMeLinkEstudio}`
    : `✨ ${giroLimpioEstudio.toUpperCase()} — DISPONIBLE CON ENTREGA RÁPIDA\n\n✅ Excelente calidad y precios directos\n✅ Atención personalizada 24/7 con ${nombreAgenteEstudio}\n\n📲 Pide catálogo y haz tu pedido directo por WhatsApp aquí:\n${waMeLinkEstudio}`

  const copyReelsEstudio = editableTtScript
    ? `${editableTtScript}\n\n📲 Enlace directo en bio / comentarios para cotizar con ${nombreAgenteEstudio}:\n${waMeLinkEstudio}`
    : esPersonalizadoEstudio
    ? `🎥 [0-3s] ¿Buscas ${giroLimpioEstudio} hecho exactamente a tu gusto o medida?\n✨ [3-12s] Mira cómo cuidamos cada detalle en nuestros pedidos personalizados y de catálogo.\n📲 [12-20s] Toca el enlace de WhatsApp en mi perfil, mándanos tu idea o medidas y ${nombreAgenteEstudio} te cotiza en minutos:\n${waMeLinkEstudio}`
    : `🎥 [0-3s] Si estabas buscando ${giroLimpioEstudio} con calidad garantizada y atención rápida, mira esto.\n✨ [3-12s] Conoce por qué nuestros clientes nos eligen y cómo trabajamos cada pedido.\n📲 [12-20s] Toca el enlace de WhatsApp en mi perfil para hablar con ${nombreAgenteEstudio} 24/7:\n${waMeLinkEstudio}`

  return (
    <BlitzrPrismStage attenuated={step >= 2}>
      {/* ================= INDICADOR VERTICAL DE ETAPAS (FLANCO IZQUIERDO MEDIO - SOLO ESCRITORIO) ================= */}
      <div
        className="fixed left-6 top-1/2 -translate-y-1/2 z-30 hidden xl:flex flex-col items-start gap-4 select-none"
      >
        {/* Paso 01 */}
        <div
          onClick={step > 1 ? () => setStep(1) : undefined}
          className={`flex items-center gap-3 ${
            step > 1 ? 'cursor-pointer pointer-events-auto group' : 'pointer-events-none'
          }`}
        >
          <div
            className={`rounded-full transition-all duration-300 ${
              step === 1
                ? 'h-8 w-1 bg-cyan-400 shadow-[0_0_12px_#22d3ee]'
                : 'h-4 w-1 bg-white/30 group-hover:bg-cyan-400 group-hover:h-6'
            }`}
          />
          <span
            className={`text-xs font-mono tracking-wider transition-colors ${
              step === 1
                ? 'font-semibold text-cyan-400'
                : 'font-medium text-zinc-400 group-hover:text-cyan-300'
            }`}
          >
            01 • IDEA
          </span>
        </div>

        {/* Paso 03 */}
        <div
          onClick={step !== 3 && hasInitialCampaign ? () => setStep(3) : undefined}
          className={`flex items-center gap-3 ${
            step !== 3 && hasInitialCampaign ? 'cursor-pointer pointer-events-auto group' : 'pointer-events-none'
          }`}
        >
          <div
            className={`rounded-full transition-all duration-300 ${
              step === 3
                ? 'h-8 w-1 bg-cyan-400 shadow-[0_0_12px_#22d3ee]'
                : 'h-4 w-1 bg-white/15'
            }`}
          />
          <span
            className={`text-xs font-mono tracking-wider transition-colors ${
              step === 3 ? 'font-semibold text-cyan-400' : 'font-medium text-zinc-500'
            }`}
          >
            03 • ESTUDIO
          </span>
        </div>
      </div>

      {/* ===================== PASO 1: INGESTA E IDEA ===================== */}
      {step === 1 && (
        <>
          {/* Controles Flotantes Esquina Inferior Izquierda: Nicho y Objetivo */}
          <NicheGoalGlassCard
            niche={niche}
            onNicheChange={handleNicheChange}
            goal={goal}
            onGoalChange={setGoal}
            disabled={isGenerating}
          />

          {/* Controles Flotantes Esquina Inferior Derecha: Motor Gemini, Archivos, Idea y Disparo */}
          <Step1ActionPanel
            userId={userId}
            productDesc={productDesc}
            setProductDesc={setProductDesc}
            imageUrl={imageUrl}
            setImageUrl={setImageUrl}
            mediaType={mediaType}
            setMediaType={setMediaType}
            storagePath={storagePath}
            setStoragePath={setStoragePath}
            imageBase64={imageBase64}
            setImageBase64={setImageBase64}
            isUploadingToStorage={isUploadingToStorage}
            setIsUploadingToStorage={setIsUploadingToStorage}
            isGenerating={isGenerating}
            generationMode={generationMode}
            onGenerate={handleGenerate}
            onResetCutout={() => setCutoutProductUrl(null)}
            clienteObjetivoTipo={clienteObjetivoTipo}
            setClienteObjetivoTipo={setClienteObjetivoTipo}
            modalidadEntrega={modalidadEntrega}
            setModalidadEntrega={setModalidadEntrega}
            volumenCompra={volumenCompra}
            setVolumenCompra={setVolumenCompra}
          />

          {/* TARJETA / MODAL DE DIAGNÓSTICO INTELIGENTE BLITZR (3 MODELOS) */}
          {showDiagnosticModal && diagnosticoIA && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 overflow-y-auto select-auto">
              <div className="w-full max-w-3xl bg-zinc-950/95 border border-cyan-500/30 rounded-3xl p-6 md:p-7 shadow-[0_0_50px_rgba(6,182,212,0.18)] space-y-5 my-auto">
                {/* Header */}
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-800/80 pb-4">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[11px] font-mono uppercase tracking-wider font-semibold">
                      <Sparkles className="w-3.5 h-3.5" /> Diagnóstico Inteligente BLITZR
                    </div>
                    <h2 className="text-lg md:text-xl font-bold text-white">
                      {diagnosticoIA.titulo_veredicto}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDiagnosticModal(false)}
                    className="text-xs text-zinc-400 hover:text-white px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800"
                  >
                    Editar idea
                  </button>
                </div>

                {/* 3 Puntajes Comparativos */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    {
                      id: 'DISTRIBUIDOR_B2B' as ModeloNegocioType,
                      label: 'Distribuidor / Mayoreo B2B',
                      score: diagnosticoIA.scores?.distribuidor ?? 50,
                      icon: Building2,
                      color: 'text-emerald-400',
                      bar: 'bg-emerald-500',
                    },
                    {
                      id: 'SERVICIOS_B2B' as ModeloNegocioType,
                      label: 'Servicios / Instalaciones B2B',
                      score: diagnosticoIA.scores?.servicios ?? 50,
                      icon: Wrench,
                      color: 'text-cyan-400',
                      bar: 'bg-cyan-500',
                    },
                    {
                      id: 'EMPRENDEDOR_B2C' as ModeloNegocioType,
                      label: 'Particular / Catálogo B2C',
                      score: diagnosticoIA.scores?.particular ?? 50,
                      icon: ShoppingBag,
                      color: 'text-amber-400',
                      bar: 'bg-amber-500',
                    },
                  ].map((item) => {
                    const Icon = item.icon
                    const isRecommended = diagnosticoIA.modelo_recomendado === item.id
                    return (
                      <div
                        key={item.id}
                        className={`p-3.5 rounded-2xl border ${
                          isRecommended
                            ? 'bg-zinc-900/90 border-cyan-500/40'
                            : 'bg-zinc-900/40 border-zinc-800/80'
                        } space-y-2`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
                            <Icon className={`w-4 h-4 ${item.color}`} />
                            {item.label}
                          </span>
                          <span className={`text-sm font-black font-mono ${item.color}`}>
                            {item.score}%
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${item.bar} rounded-full transition-all duration-500`}
                            style={{ width: `${Math.min(100, Math.max(8, item.score))}%` }}
                          />
                        </div>
                        {isRecommended && (
                          <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-cyan-300">
                            ★ Recomendado por IA
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Explicación Estratégica + Clientes Objetivo */}
                <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800/90 space-y-3 text-xs">
                  <p className="text-zinc-200 leading-relaxed">
                    {diagnosticoIA.explicacion_estrategica}
                  </p>
                  <div className="grid sm:grid-cols-2 gap-3 pt-2 border-t border-zinc-800/80">
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 block mb-0.5">
                        Clientes Objetivo Sugeridos
                      </span>
                      <p className="text-zinc-200 font-medium">
                        {diagnosticoIA.clientes_objetivo}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 block mb-0.5">
                        Estrategia de Cierre Andrea IA
                      </span>
                      <p className="text-zinc-200 font-medium">
                        {diagnosticoIA.enfoque_andrea}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Selector Manual de los 3 Modelos Operativos (Pre-marcado con el recomendado) */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-300 block">
                    Selecciona el modelo operativo con el que deseas configurar tu plataforma (puedes cambiarlo manualmente):
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[
                      {
                        id: 'DISTRIBUIDOR_B2B' as ModeloNegocioType,
                        title: '1. Distribuidor B2B',
                        desc: 'Cazador 24/7 en INEGI/Maps + Primer contacto en frío + Andrea cierra paquetes/mayoreo.',
                      },
                      {
                        id: 'SERVICIOS_B2B' as ModeloNegocioType,
                        title: '2. Servicios / Instalaciones B2B',
                        desc: 'Prospección corporativa de empresas/oficinas + Andrea agenda visitas técnicas y cotizaciones.',
                      },
                      {
                        id: 'EMPRENDEDOR_B2C' as ModeloNegocioType,
                        title: '3. Particular B2C (Inbound)',
                        desc: 'Protección Anti-Baneo: Cero spam en frío. Atraes clientes con 03 • ESTUDIO y Andrea responde 24/7.',
                      },
                    ].map((opt) => {
                      const active = selectedModelo === opt.id
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setSelectedModelo(opt.id)}
                          className={`text-left p-3.5 rounded-2xl border transition-all cursor-pointer ${
                            active
                              ? 'bg-cyan-500/15 border-cyan-400 text-white shadow-[0_0_20px_rgba(34,211,238,0.15)]'
                              : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-white">{opt.title}</span>
                            {active && <Check className="w-4 h-4 text-cyan-400 shrink-0" />}
                          </div>
                          <p className="text-[11px] leading-snug text-zinc-300/90">{opt.desc}</p>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Botón de Confirmación */}
                <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() =>
                      executeCampaignGeneration(pendingMode, selectedModelo, diagnosticoIA)
                    }
                    className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-bold text-xs tracking-wide shadow-[0_0_25px_rgba(34,211,238,0.35)] transition cursor-pointer"
                  >
                    Confirmar Modelo ({selectedModelo.replace('_', ' ')}) y Abrir Estudio Creativo →
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ===================== PASO 2: CENTRO DE MANDO (EL EMBUDO) ===================== */}
      {step === 2 && (
        <div className="w-full min-h-screen relative select-auto">
          <div className="max-w-7xl w-full mx-auto pt-20 md:pt-24 pb-24 px-5 sm:px-8 xl:pl-44 xl:pr-8 space-y-6 animate-in fade-in duration-300">
            {/* CABECERA MINIMALISTA PASO 2: BOTÓN AJUSTAR IDEA */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] animate-pulse" />
                <span className="text-xs font-mono uppercase tracking-[0.15em] text-cyan-300/90 font-semibold">
                  Centro de Mando Estratégico
                </span>
              </div>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="bg-zinc-900/60 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-white/10 rounded-full px-3.5 py-1.5 text-xs font-medium backdrop-blur-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95"
              >
                <span>←</span>
                <span>Ajustar Idea</span>
              </button>
            </div>

            {/* ================= SÍNTESIS EJECUTIVA: BENTO GRID 12 COLS (R2) ================= */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-6">
              {/* Veredicto del CMO (lg:col-span-5) */}
              <div className="lg:col-span-5 min-w-0 bg-zinc-900/50 border border-purple-500/25 rounded-2xl p-5 backdrop-blur-xl relative overflow-hidden flex flex-col justify-between shadow-lg">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shadow-[0_0_6px_#c084fc]" />
                      <span className="text-[10px] font-semibold tracking-[0.15em] uppercase text-purple-300 font-mono">
                        DIAGNÓSTICO CMO
                      </span>
                    </div>
                    {headline && (
                      <span className="text-[10px] text-zinc-400 font-mono tracking-wider bg-white/[0.04] px-2 py-0.5 rounded border border-white/[0.06] truncate max-w-[180px]">
                        {headline}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-zinc-200 leading-relaxed font-normal break-words">
                    {campaignData?.veredicto_cmo ||
                      'Tu cliente principal duda antes de comprar; este ángulo derriba su escepticismo mostrando valor real desde los primeros 3 segundos.'}
                  </p>
                </div>
              </div>

              {/* Pilares Estratégicos (lg:col-span-7) */}
              <div className="lg:col-span-7 min-w-0 grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Pilar 1: Avatar del Cliente */}
                <div className="min-w-0 bg-zinc-950/60 border border-white/[0.06] rounded-xl p-4 backdrop-blur-md flex flex-col space-y-2">
                  <span className="text-[10px] tracking-[0.15em] uppercase text-zinc-400 font-medium">
                    Avatar del Cliente
                  </span>
                  <p className="text-xs text-zinc-300 leading-relaxed break-words">
                    {cmoAnalysis?.avatar || campaignData?.estrategia?.avatar_cliente || 'Audiencia calificada lista para comprar.'}
                  </p>
                </div>

                {/* Pilar 2: Ángulo Gancho */}
                <div className="min-w-0 bg-zinc-950/60 border border-white/[0.06] rounded-xl p-4 backdrop-blur-md flex flex-col space-y-2">
                  <span className="text-[10px] tracking-[0.15em] uppercase text-zinc-400 font-medium">
                    Ángulo Gancho
                  </span>
                  <p className="text-xs text-zinc-300 leading-relaxed break-words">
                    {cmoAnalysis?.angle || campaignData?.estrategia?.angulo_gancho || 'Enfoque directo al dolor principal y solución inmediata.'}
                  </p>
                </div>

                {/* Pilar 3: Oferta Irresistible */}
                <div className="min-w-0 bg-zinc-950/60 border border-white/[0.06] rounded-xl p-4 backdrop-blur-md flex flex-col space-y-2">
                  <span className="text-[10px] tracking-[0.15em] uppercase text-zinc-400 font-medium">
                    Oferta Irresistible
                  </span>
                  <p className="text-xs text-zinc-300 leading-relaxed break-words">
                    {cmoAnalysis?.irresistibleOffer || campaignData?.estrategia?.oferta_irresistible || 'Propuesta de valor clara con llamado a la acción directo.'}
                  </p>
                </div>
              </div>
            </div>

            {/* ================= R3: ESTUDIO DE GUIONES Y COPYS CON PESTAÑAS OBSIDIAN GLASS ================= */}
            <div className="bg-zinc-900/40 border border-white/[0.08] rounded-2xl p-5 sm:p-6 backdrop-blur-xl shadow-2xl space-y-4">
              {/* Barra Superior: Pestañas a la izquierda + Botón Copiar a la derecha */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.06]">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveChannelTab('tiktok')}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
                      activeChannelTab === 'tiktok'
                        ? 'bg-pink-500/20 text-pink-200 border border-pink-500/50 shadow-[0_0_14px_rgba(236,72,153,0.35)]'
                        : 'bg-zinc-950/60 text-zinc-400 border border-white/5 hover:border-white/15 hover:text-zinc-200 hover:bg-zinc-900/40'
                    }`}
                  >
                    <span>🎬</span>
                    <span>TikTok & Reels</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveChannelTab('instagram')}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
                      activeChannelTab === 'instagram'
                        ? 'bg-purple-500/20 text-purple-200 border border-purple-500/50 shadow-[0_0_14px_rgba(168,85,247,0.35)]'
                        : 'bg-zinc-950/60 text-zinc-400 border border-white/5 hover:border-white/15 hover:text-zinc-200 hover:bg-zinc-900/40'
                    }`}
                  >
                    <span>📸</span>
                    <span>Instagram Feed</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveChannelTab('whatsapp')}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
                      activeChannelTab === 'whatsapp'
                        ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/50 shadow-[0_0_14px_rgba(16,185,129,0.35)]'
                        : 'bg-zinc-950/60 text-zinc-400 border border-white/5 hover:border-white/15 hover:text-zinc-200 hover:bg-zinc-900/40'
                    }`}
                  >
                    <span>💬</span>
                    <span>WhatsApp Cierre</span>
                  </button>
                </div>

                {/* Botón Copiar Texto con Feedback */}
                <button
                  type="button"
                  onClick={handleCopyCurrentTab}
                  className={`self-end sm:self-auto text-xs px-3.5 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer ${
                    isCopied
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50 shadow-[0_0_12px_rgba(52,211,153,0.3)]'
                      : 'bg-zinc-950/60 text-zinc-300 hover:text-white border-white/10 hover:border-white/20 hover:bg-zinc-900/60'
                  }`}
                >
                  {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{isCopied ? '¡Copiado!' : 'Copiar texto'}</span>
                </button>
              </div>

              {/* Área de Lectura y Edición Amplia Sin Scroll Interno */}
              <div className="pt-2">
                <textarea
                  ref={copyTextareaRef}
                  value={
                    activeChannelTab === 'tiktok'
                      ? editableTtScript
                      : activeChannelTab === 'instagram'
                      ? editableIgCopy
                      : editableWaText
                  }
                  onChange={(e) => {
                    const val = e.target.value
                    if (activeChannelTab === 'tiktok') setEditableTtScript(val)
                    else if (activeChannelTab === 'instagram') setEditableIgCopy(val)
                    else setEditableWaText(val)
                    adjustTextareaHeight()
                  }}
                  rows={8}
                  className="w-full bg-transparent border-0 focus:ring-0 focus:outline-none text-sm md:text-base text-zinc-200 leading-relaxed resize-none p-0 overflow-hidden font-sans placeholder-zinc-500 selection:bg-cyan-500/30"
                  placeholder={
                    activeChannelTab === 'tiktok'
                      ? 'Guion de video para Reels y TikTok...'
                      : activeChannelTab === 'instagram'
                      ? 'Copy principal y llamado a la acción para Feed...'
                      : 'Texto de estado de WhatsApp y cierre por mensaje directo...'
                  }
                />
              </div>

              {/* Pie de Canal con Acciones Contextuales */}
              <div className="pt-4 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
                {activeChannelTab === 'tiktok' && (
                  <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                    <ReelPublishButton item={publicationProxy} />
                    {isVideoMedia && (
                      <button
                        type="button"
                        onClick={handlePublishTikTok}
                        disabled={isPublishingTikTok}
                        className="px-4 py-2 bg-[#fe2c55]/20 hover:bg-[#fe2c55]/30 text-[#fe2c55] border border-[#fe2c55]/40 text-xs font-semibold rounded-xl transition flex items-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
                      >
                        {isPublishingTikTok ? '⏳ Enviando...' : '🎵 Borrador TikTok'}
                      </button>
                    )}
                  </div>
                )}

                {activeChannelTab === 'instagram' && (
                  <div className="flex flex-wrap items-center gap-3 w-full">
                    <button
                      type="button"
                      onClick={handlePublishIgFeed}
                      disabled={isPublishingFeed || isFeedPublished || !uploadedMediaUrl || isVideoMedia}
                      className={`flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                        isFeedPublished
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                          : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.3)] active:scale-95'
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

                    {publicationId && !isVideoMedia && (
                      <div className="sm:ml-auto">
                        <GenerateBannerButton
                          contentId={publicationId}
                          existingBannerUrl={bannerUrl}
                          visualPrompt="High-converting commercial product advertisement banner"
                        />
                      </div>
                    )}
                  </div>
                )}

                {activeChannelTab === 'whatsapp' && (
                  <button
                    type="button"
                    onClick={() => setIsShareModalOpen(true)}
                    className="w-full sm:w-auto px-5 py-2.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-semibold rounded-xl transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)] flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                  >
                    <span>📲</span>
                    <span>Compartir en WhatsApp / Estado</span>
                  </button>
                )}
              </div>
            </div>

            {/* ================= 4. VISTA PREVIA EN VIVO + COPILOTO DE REFINAMIENTO ================= */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pt-4 border-t border-white/[0.08]">
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
                <div className="bg-zinc-900/40 border border-white/[0.08] rounded-2xl p-4 sm:p-5 backdrop-blur-xl shadow-xl space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                      Copiloto de Refinamiento IA
                    </h4>
                  </div>
                  <p className="text-xs text-zinc-400">
                    ¿Quieres ajustar el tono o agregar una promoción especial? Pídeselo al copiloto o edita directamente en la pestaña de arriba.
                  </p>
                  <div className="bg-zinc-950/70 border border-white/10 rounded-xl p-2 flex items-end gap-2 focus-within:border-cyan-400/50 transition-all">
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
                      className="p-2.5 bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500 hover:from-blue-500 hover:to-emerald-400 disabled:bg-none disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded-xl transition-all flex-shrink-0 shadow-sm flex items-center justify-center cursor-pointer active:scale-95"
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

            {/* ================= R4: DOCK FLOTANTE INFERIOR DE AVANCE ================= */}
            <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-zinc-950/80 border border-white/10 rounded-2xl px-6 py-4 backdrop-blur-xl shadow-2xl">
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse flex-shrink-0" />
                <span className="text-xs md:text-sm text-zinc-300 font-medium">
                  Estrategia lista • Siguiente fase: Generación de creativos 4:5
                </span>
              </div>
              <button
                type="button"
                onClick={goToStep3}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500 hover:from-blue-500 hover:to-emerald-400 text-white font-bold text-xs md:text-sm shadow-[0_0_25px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.45)] transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] flex-shrink-0"
              >
                <span>Ir al Estudio Visual</span>
                <span>→</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== PASO 3: ESTUDIO PUBLICITARIO PROFESIONAL (LIENZO UNIFICADO 1080×1350 + SALA DE CHAT IA EN VIVO) ===================== */}
      {step === 3 && (
        <div className="w-full min-h-screen relative select-auto">
          <div className="max-w-7xl w-full mx-auto pt-20 md:pt-24 pb-24 px-5 sm:px-8 xl:pl-44 xl:pr-8 space-y-5 animate-in fade-in duration-300">
            {/* Header Superior de Estudio */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-1">
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
                  <span className="text-emerald-400">03 •</span>
                  <span>Estudio Publicitario Profesional (1080×1350 HD)</span>
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Lienzo unificado de nivel agencia con integración de producto sin fondo y Copiloto de Diseño IA en tiempo real.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowCmoStrategyPanel((prev) => !prev)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                    showCmoStrategyPanel
                      ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400/50 shadow-[0_0_15px_rgba(6,182,212,0.25)]'
                      : 'bg-zinc-900/80 text-zinc-300 border-white/10 hover:border-cyan-400/40 hover:text-white'
                  }`}
                >
                  <span>🧠</span>
                  <span>{showCmoStrategyPanel ? 'Ocultar Estrategia CMO' : 'Ver Estrategia CMO'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="bg-zinc-900/60 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-white/10 rounded-full px-3.5 py-1.5 text-xs font-medium backdrop-blur-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95"
                >
                  <span>←</span>
                  <span>Editar Idea (01)</span>
                </button>
              </div>
            </div>

            {/* PANEL COLAPSABLE SUPERIOR: ESTRATEGIA CMO (AVATAR, ÁNGULO DE GANCHO Y OFERTA) */}
            {showCmoStrategyPanel && (
              <div className="bg-zinc-900/90 border border-cyan-500/30 rounded-2xl p-5 shadow-xl space-y-4 animate-in fade-in duration-200">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                      Estrategia Comercial CMO • Modelo Activo: {selectedModelo}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
                  >
                    Abrir vista extendida de guiones (02) →
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-3.5 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">
                      🎯 Avatar / Clientes Objetivo
                    </span>
                    <p className="text-xs text-zinc-200 leading-relaxed">
                      {diagnosticoIA?.clientes_objetivo ||
                        cmoAnalysis?.avatar ||
                        campaignData?.estrategia?.avatar_cliente ||
                        'Clientes interesados en atención rápida y garantía de calidad.'}
                    </p>
                  </div>
                  <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-3.5 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400">
                      ⚡ Ángulo de Gancho
                    </span>
                    <p className="text-xs text-zinc-200 leading-relaxed">
                      {cmoAnalysis?.angle ||
                        campaignData?.estrategia?.angulo_gancho ||
                        subline ||
                        'Atención personalizada e inmediata por WhatsApp.'}
                    </p>
                  </div>
                  <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-3.5 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                      🤖 Rol de Cierre ({nombreAgenteEstudio} IA)
                    </span>
                    <p className="text-xs text-zinc-200 leading-relaxed">
                      {diagnosticoIA?.enfoque_andrea ||
                        cmoAnalysis?.irresistibleOffer ||
                        campaignData?.estrategia?.oferta_irresistible ||
                        'Cierre consultivo automatizado 24/7 en WhatsApp.'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* LAYOUT PRINCIPAL DE ESTUDIO: IZQUIERDA (LIENZO UNIFICADO 1080×1350) + DERECHA (SALA DE CHAT CREATIVA IA EN VIVO) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* COLUMNA IZQUIERDA: LIENZO UNIFICADO 4:5 (1080×1350) + PLANTILLAS + EJECUCIÓN */}
              <div className="lg:col-span-6 space-y-4">
                <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4">
                  {/* Barra Superior del Lienzo: 3 Plantillas Profesionales de 1 Clic */}
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                        <Palette className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Plantilla de Diseño (1 Clic)</span>
                      </span>

                      <div className="flex items-center gap-2">
                        <input
                          ref={studioFileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleStudioProductUpload}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => studioFileInputRef.current?.click()}
                          disabled={isUploadingToStorage || isRemovingBg}
                          className="px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/15 text-[11px] text-zinc-200 font-medium transition cursor-pointer"
                        >
                          {isUploadingToStorage
                            ? 'Subiendo...'
                            : imageUrl && !isVideoMedia
                            ? '📷 Cambiar Foto Producto'
                            : '📷 Subir Foto Producto'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleGenerateStudioScene(undefined, styleTheme)}
                          disabled={isGeneratingScene}
                          className="px-2.5 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/30 text-[11px] text-cyan-200 font-semibold transition cursor-pointer"
                        >
                          {isGeneratingScene ? '⏳ Generando...' : '🔄 Nuevo Fondo IA'}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      {(
                        [
                          { id: 'minimal-dark', label: '1. Estudio Editorial' },
                          { id: 'clean-light', label: '2. Escena Lifestyle IA' },
                          { id: 'bold-retail', label: '3. Oferta Marketplace' },
                        ] as const
                      ).map((tpl) => {
                        const active = styleTheme === tpl.id
                        return (
                          <button
                            key={tpl.id}
                            type="button"
                            onClick={() => setStyleTheme(tpl.id)}
                            className={`py-2 px-2.5 text-[11px] font-bold rounded-xl transition-all cursor-pointer ${
                              active
                                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20 border border-cyan-300/40'
                                : 'bg-zinc-950 text-zinc-400 border border-zinc-800 hover:text-zinc-200 hover:border-zinc-700'
                            }`}
                          >
                            {tpl.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Contenedor Único del Lienzo Interactivo 1080×1350 */}
                  <div className="relative">
                    {isGeneratingScene && (
                      <div className="absolute inset-0 z-40 rounded-2xl bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
                        <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mb-3" />
                        <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider">
                          Renderizando Escenario Fotográfico IA (1080×1350)...
                        </span>
                        <p className="text-[11px] text-zinc-400 mt-1">
                          Diseñando iluminación comercial y superficie acorde a tu giro.
                        </p>
                      </div>
                    )}

                    <StudioCanvasPreview
                      sceneUrl={sceneUrl}
                      productImageUrl={!isVideoMedia ? imageUrl : null}
                      cutoutProductUrl={useCutout ? cutoutProductUrl : null}
                      isLoadingProduct={isRemovingBg}
                      headline={headline}
                      editableHeadline={headline}
                      subline={subline}
                      badgeText={badgeText}
                      styleTheme={styleTheme}
                      editableIgCopy={editableIgCopy}
                      niche={niche}
                      price={studioPrice}
                      onPriceChange={setStudioPrice}
                      comparePrice={studioComparePrice}
                      onComparePriceChange={setStudioComparePrice}
                      productScale={studioProductScale}
                      onProductScaleChange={setStudioProductScale}
                      productPosY={studioProductOffsetY}
                      onProductPosYChange={setStudioProductOffsetY}
                    />
                  </div>

                  {/* Toggle de Recorte Alfa si el usuario subió foto de producto */}
                  {imageUrl && !isVideoMedia && (
                    <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-zinc-950/80 border border-zinc-800/80 text-xs">
                      <label className="flex items-center gap-2 cursor-pointer text-zinc-300 select-none">
                        <input
                          type="checkbox"
                          checked={useCutout && Boolean(cutoutProductUrl)}
                          disabled={!cutoutProductUrl || isRemovingBg}
                          onChange={(e) => setUseCutout(e.target.checked)}
                          className="w-3.5 h-3.5 rounded border-zinc-700 bg-zinc-900 text-cyan-500 cursor-pointer"
                        />
                        <span>Integrar producto sin fondo (Recorte Alfa PNG)</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleRemoveBackground()}
                          disabled={isRemovingBg}
                          className="text-[11px] text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
                        >
                          {isRemovingBg ? 'Recortando...' : 'Re-aislar fondo'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setImageUrl(null)
                            setCutoutProductUrl(null)
                          }}
                          className="text-[11px] text-zinc-500 hover:text-rose-400 underline cursor-pointer"
                        >
                          Quitar foto
                        </button>
                      </div>
                    </div>
                  )}

                  {/* BOTONES REALES DE EJECUCIÓN: DESCARGAR PNG HD (1080×1350) + GUARDAR EN BÓVEDA + PUBLICAR EN IG/FB */}
                  <div className="pt-2 space-y-2.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={handleDownloadFlyerLocal}
                        disabled={isDownloadingFlyer || isBakingBanner || isGeneratingScene}
                        className="w-full py-3 px-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 text-white font-bold text-xs md:text-sm rounded-xl transition-all shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
                      >
                        {isDownloadingFlyer ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Exportando 1080×1350...</span>
                          </>
                        ) : (
                          <>
                            <Download className="w-4 h-4" />
                            <span>Descargar PNG HD (1080×1350)</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={handleBakeBanner}
                        disabled={isBakingBanner || isGeneratingScene}
                        className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 font-bold text-xs md:text-sm rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
                      >
                        {isBakingBanner ? (
                          <>
                            <div className="w-4 h-4 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                            <span>Guardando en Bóveda...</span>
                          </>
                        ) : (
                          <>
                            <span>💾</span>
                            <span>Guardar en Bóveda</span>
                          </>
                        )}
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handlePublishIgFeed}
                      disabled={isPublishingFeed || isFeedPublished || isVideoMedia}
                      className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        isFeedPublished
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-zinc-950 hover:bg-zinc-800/90 text-zinc-200 border border-purple-500/40 hover:border-purple-400'
                      } disabled:opacity-40`}
                    >
                      {isPublishingFeed
                        ? '⏳ Publicando arte 1080×1350 en Instagram / Facebook...'
                        : isFeedPublished
                        ? '✅ Publicado en Instagram / Facebook Feed'
                        : '🚀 Publicar Directo en Instagram / Facebook'}
                    </button>
                  </div>
                </div>
              </div>

              {/* COLUMNA DERECHA: SALA DE CHAT CREATIVA IA (COPILOTO DE DISEÑO EN VIVO) + AJUSTES MANUALES */}
              <div className="lg:col-span-6 space-y-4">
                <div className="bg-zinc-900/90 border border-cyan-500/30 rounded-2xl p-5 shadow-[0_0_40px_rgba(6,182,212,0.12)] flex flex-col justify-between space-y-4">
                  {/* Cabecera del Copiloto */}
                  <div className="flex items-start justify-between gap-3 border-b border-zinc-800 pb-3.5">
                    <div className="space-y-1">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-400/30 text-cyan-300 text-[10px] font-bold uppercase tracking-wider">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                        <span>Copiloto de Diseño en Vivo • Gemini IA</span>
                      </div>
                      <h3 className="text-base font-bold text-white">
                        Sala de Chat Creativa IA
                      </h3>
                      <p className="text-xs text-zinc-400">
                        Pide cambios de escenario/fondo, iluminación, textos, precios, descuentos o tamaño del producto con lenguaje natural.
                      </p>
                    </div>
                  </div>

                  {/* Chips Rápidos de 1 Clic */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      Acciones Rápidas (1 Clic):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        'Fondo minimalista claro',
                        'Ambiente oscuro con luz neón',
                        'Mesa de madera con iluminación cálida',
                        'Cambiar a modo oferta con 20% de descuento',
                        'Agrandar producto',
                        'Quitar etiqueta de precio',
                      ].map((chip) => (
                        <button
                          key={chip}
                          type="button"
                          disabled={isSendingStudioChat || isGeneratingScene}
                          onClick={() => handleSendStudioChat(chip)}
                          className="text-[11px] px-2.5 py-1 rounded-full bg-zinc-950 hover:bg-cyan-500/15 text-zinc-300 hover:text-cyan-200 border border-zinc-800 hover:border-cyan-400/40 transition cursor-pointer disabled:opacity-50"
                        >
                          ✨ {chip}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Historial de Mensajes del Chat Creativo */}
                  <div className="bg-zinc-950/90 border border-zinc-800/90 rounded-xl p-3.5 h-[250px] overflow-y-auto space-y-3">
                    {studioChatMessages.map((m, idx) => (
                      <div
                        key={idx}
                        className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                            m.role === 'user'
                              ? 'bg-cyan-600 text-white font-medium rounded-br-sm'
                              : 'bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-bl-sm'
                          }`}
                        >
                          {m.text}
                        </div>
                      </div>
                    ))}
                    {isSendingStudioChat && (
                      <div className="flex justify-start">
                        <div className="bg-zinc-900 border border-cyan-500/30 text-cyan-300 rounded-2xl px-3.5 py-2 text-xs flex items-center gap-2">
                          <div className="w-3 h-3 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                          <span>Aplicando cambios al lienzo...</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Input Conversacional del Chat Creativo */}
                  <div className="flex items-end gap-2 bg-zinc-950 border border-zinc-800 focus-within:border-cyan-400/60 rounded-xl p-2 transition">
                    <textarea
                      rows={2}
                      value={studioChatInput}
                      onChange={(e) => setStudioChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          handleSendStudioChat()
                        }
                      }}
                      disabled={isSendingStudioChat}
                      placeholder='Ej. "Pon el fondo sobre una mesa de madera con plantas y cambia el título a Impresión 3D a Medida en $250"...'
                      className="w-full bg-transparent border-0 text-xs text-zinc-100 placeholder-zinc-500 focus:ring-0 focus:outline-none resize-none px-2 py-1 leading-relaxed"
                    />
                    <button
                      type="button"
                      onClick={() => handleSendStudioChat()}
                      disabled={!studioChatInput.trim() || isSendingStudioChat}
                      className="p-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-40 text-white transition cursor-pointer flex-shrink-0"
                      title="Aplicar al lienzo"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Acordeón Opcional de Edición Manual Directa */}
                  <div className="pt-2 border-t border-zinc-800/80">
                    <button
                      type="button"
                      onClick={() => setShowManualControls((prev) => !prev)}
                      className="w-full flex items-center justify-between text-xs font-semibold text-zinc-400 hover:text-zinc-200 py-1 cursor-pointer"
                    >
                      <span>⌨️ Edición Manual de Textos y Precios</span>
                      <span>{showManualControls ? '▲' : '▼'}</span>
                    </button>

                    {showManualControls && (
                      <div className="mt-3 space-y-3 pt-2 border-t border-zinc-800/50 animate-in fade-in duration-150">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          <div>
                            <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">
                              Insignia Superior
                            </label>
                            <input
                              type="text"
                              value={badgeText}
                              onChange={(e) => setBadgeText(e.target.value)}
                              placeholder="Ej. HECHO A MEDIDA"
                              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-cyan-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">
                              Precio ($ MXN)
                            </label>
                            <input
                              type="text"
                              value={studioPrice}
                              onChange={(e) => setStudioPrice(e.target.value)}
                              placeholder="Vacío = sin precio"
                              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-cyan-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">
                              Precio Anterior
                            </label>
                            <input
                              type="text"
                              value={studioComparePrice}
                              onChange={(e) => setStudioComparePrice(e.target.value)}
                              placeholder="Opcional (tachado)"
                              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-cyan-500"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">
                            Titular Principal
                          </label>
                          <input
                            type="text"
                            value={headline}
                            onChange={(e) => setHeadline(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 font-semibold focus:outline-none focus:border-cyan-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">
                            Subtítulo Editorial
                          </label>
                          <textarea
                            rows={2}
                            value={subline}
                            onChange={(e) => setSubline(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 resize-none focus:outline-none focus:border-cyan-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

          {/* ================= KIT DE ATRACCIÓN INBOUND 1-CLIC CONECTADO A ANDREA IA (wa.me + COPYS) ================= */}
          <div className="bg-zinc-900/90 border border-cyan-500/25 rounded-2xl p-5 md:p-6 shadow-[0_0_40px_rgba(6,182,212,0.1)] space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-zinc-800/90 pb-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-cyan-500/15 border border-cyan-400/30 text-cyan-300 text-[11px] font-bold uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Kit de Atracción Inbound 1-Clic → {nombreAgenteEstudio} IA 24/7</span>
                </div>
                <h3 className="text-base md:text-lg font-bold text-white">
                  Copys Listos y Enlace Directo <code className="text-cyan-300 font-mono text-sm">wa.me</code> para Redes, Estados y Marketplace
                </h3>
                <p className="text-xs text-zinc-400">
                  Publica tu flyer junto con estos textos. Cuando un cliente toque tu enlace, entrará directo al WhatsApp donde {nombreAgenteEstudio} atiende, pide especificaciones y cierra el pedido 24/7 sin riesgo de bloqueo.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {cleanPhoneWaMe ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    WhatsApp Vinculado: +{cleanPhoneWaMe}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => router.push('/dashboard/whatsapp')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-200 text-xs font-semibold transition cursor-pointer"
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-amber-300" />
                    <span>Vincular mi número en WhatsApp →</span>
                  </button>
                )}
              </div>
            </div>

            {/* TARJETA DESTACADA: ENLACE DIRECTO WA.ME PRELLENADO */}
            <div className="bg-zinc-950/80 border border-emerald-500/30 rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                    Enlace Directo a {nombreAgenteEstudio} IA (Bio de IG / TikTok / Botón de Anuncio)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => copyToClipboard(waMeLinkEstudio, 'Enlace wa.me')}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer active:scale-95"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar Enlace wa.me</span>
                  </button>
                  {cleanPhoneWaMe && (
                    <a
                      href={waMeLinkEstudio}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-semibold flex items-center gap-1 transition"
                    >
                      <span>Probar</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
                <div className="lg:col-span-7">
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                    Mensaje Disparador que enviará el cliente al abrir tu WhatsApp
                  </label>
                  <input
                    type="text"
                    value={customTriggerMsg || defaultTriggerMsgEstudio}
                    onChange={(e) => setCustomTriggerMsg(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500/60"
                  />
                </div>
                <div className="lg:col-span-5">
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                    URL Generada Lista para Pegar
                  </label>
                  <div className="bg-zinc-900/90 border border-zinc-800 rounded-lg px-3 py-2 text-[11px] font-mono text-emerald-300 truncate select-all">
                    {waMeLinkEstudio}
                  </div>
                </div>
              </div>
            </div>

            {/* 3 TARJETAS COMPACTAS DE COPYS POR CANAL CON BOTÓN COPIAR 1-CLIC */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 1. Estados de WhatsApp */}
              <div className="bg-zinc-950/75 border border-zinc-800 hover:border-emerald-500/30 rounded-xl p-4 flex flex-col justify-between space-y-3 transition">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                      <span>🟢</span> 1. Estado de WhatsApp
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(copyWaStatusEstudio, 'Copy Estado de WhatsApp')}
                      className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition active:scale-95"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Copiar</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Sube el flyer a tu Estado y pega este texto corto con llamado a la acción directo:
                  </p>
                  <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-lg p-3 text-xs text-zinc-200 whitespace-pre-wrap leading-relaxed max-h-44 overflow-y-auto">
                    {copyWaStatusEstudio}
                  </div>
                </div>
              </div>

              {/* 2. Facebook Marketplace / Grupos */}
              <div className="bg-zinc-950/75 border border-zinc-800 hover:border-blue-500/30 rounded-xl p-4 flex flex-col justify-between space-y-3 transition">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-blue-300 uppercase tracking-wider flex items-center gap-1.5">
                      <span>📘</span> 2. FB Marketplace / Grupos
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(copyMarketplaceEstudio, 'Copy Facebook Marketplace')}
                      className="px-2.5 py-1 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-300 text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition active:scale-95"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Copiar</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Título llamativo + beneficios + enlace directo para grupos de compra-venta y Marketplace:
                  </p>
                  <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-lg p-3 text-xs text-zinc-200 whitespace-pre-wrap leading-relaxed max-h-44 overflow-y-auto">
                    {copyMarketplaceEstudio}
                  </div>
                </div>
              </div>

              {/* 3. Reels / TikTok */}
              <div className="bg-zinc-950/75 border border-zinc-800 hover:border-purple-500/30 rounded-xl p-4 flex flex-col justify-between space-y-3 transition">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                      <span>🎵</span> 3. Reels / TikTok
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(copyReelsEstudio, 'Guion y Copy Reels / TikTok')}
                      className="px-2.5 py-1 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition active:scale-95"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Copiar</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Guion y descripción para video corto redirigiendo al enlace de tu perfil o comentarios:
                  </p>
                  <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-lg p-3 text-xs text-zinc-200 whitespace-pre-wrap leading-relaxed max-h-44 overflow-y-auto">
                    {copyReelsEstudio}
                  </div>
                </div>
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
    </BlitzrPrismStage>
  )
}

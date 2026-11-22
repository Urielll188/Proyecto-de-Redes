export interface ProspectoVps {
  id_cliente_agencia?: string
  nombre: string
  fuente: string
  google_maps_url: string
  estatus_maps?: string
  telefono: string
  direccion: string
  municipio: string
  segmento_cliente: string
  oferta_recomendada?: string
  estatus_contacto_wa?: string
}

export type ModeloNegocioType = 'DISTRIBUIDOR_B2B' | 'SERVICIOS_B2B' | 'EMPRENDEDOR_B2C'

export interface DiagnosticoModeloIA {
  ok?: boolean
  origen_diagnostico?: string
  modelo_recomendado: ModeloNegocioType
  scores: {
    distribuidor: number
    servicios: number
    particular: number
  }
  titulo_veredicto: string
  explicacion_estrategica: string
  clientes_objetivo: string
  keywords_sugeridas: string[]
  enfoque_andrea: string
  cliente_objetivo_tipo?: string
  modalidad_entrega?: string
  volumen_compra?: string
}

export interface NichoVps {
  cliente_id: string
  nombre_negocio: string
  nombre_agente: string
  giro_objetivo: string
  codigo_scian_inegi: string
  keywords_busqueda: string
  oferta_gancho: string
  catalogo_y_reglas: string
  protegido: boolean
  activo: boolean
  total_prospectos: number
  enviados_wa: number
  modelo_negocio?: ModeloNegocioType
  diagnostico_ia?: DiagnosticoModeloIA | Record<string, unknown>
}

export type EstrategiaRutaType = 'cercanos_primero' | 'lejanos_primero' | 'por_horario'

export interface PedidoVps {
  id: number
  folio: string
  fecha_cierre: string
  cliente_tortilleria: string
  telefono: string
  direccion_gps: string
  municipio: string
  google_maps_url: string
  horario_recepcion: string
  metodo_pago: string
  monto_venta: number
  comision_agencia: number
  estatus_entrega: string
  tipo_pedido?: string
  orden_parada?: number
  distancia_tramo_km?: number
  distancia_origen_km?: number
  motivo_orden?: string
  lat?: number
  lng?: number
  es_demo?: boolean
}

export interface SeguimientoVps {
  nombre_tortilleria: string
  telefono: string
  municipio: string
  etapa_seguimiento: string
  ultimo_mensaje_cliente: string
  mensaje_ia_sugerido: string
}

export interface FotoPauVps {
  nombre: string
  tipo: string
  url: string
}

export interface DatosSegurosVps {
  ok?: boolean
  vpsOffline?: boolean
  error?: string
  cliente?: string
  municipios_autorizados?: string[]
  total_reales_bd?: number
  prospectos?: ProspectoVps[]
  pedidos?: PedidoVps[]
  seguimientos?: SeguimientoVps[]
  fotos_negocio_pau?: FotoPauVps[]
}

export async function fetchVpsGet(endpoint: string, params?: Record<string, string>) {
  const qs = new URLSearchParams({ endpoint, ...(params || {}) })
  const res = await fetch(`/api/vps/proxy?${qs.toString()}`, { cache: 'no-store' })
  return res.json()
}

export async function fetchVpsPost(endpoint: string, body: Record<string, unknown>) {
  const res = await fetch('/api/vps/proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint, ...body }),
  })
  return res.json()
}

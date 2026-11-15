export interface ProspectoVps {
  nombre: string
  fuente: string
  google_maps_url: string
  estatus_maps?: string
  telefono: string
  direccion: string
  municipio: string
  segmento_cliente: string
}

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

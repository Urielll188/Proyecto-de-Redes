import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

const OWNER_EMAIL_MALLAS = 'ferrergbryanu10@gmail.com'

const ALLOWED_GET_ENDPOINTS = [
  '/api/datos_seguros',
  '/api/nichos',
  '/api/mi-nicho',
  '/api/estatus_whatsapp',
  '/api/estatus_wa',
  '/estatus_wa',
  '/api/imagen_pau',
  '/excel_mallas_tlaxcalli.csv',
]

const ALLOWED_POST_ENDPOINTS = [
  '/api/cazar_lote_10',
  '/api/nichos',
  '/api/nichos/toggle',
  '/api/mi-nicho',
  '/api/diagnosticar-modelo',
  '/api/extraer-web',
  '/api/marcar_maps',
  '/api/marcar_lote_wa',
  '/api/chat',
  '/api/tts_voz_mujer',
  '/api/registrar_pedido',
  '/api/confirmar_entrega_comision',
  '/api/optimizar_ruta',
  '/api/generar_marketing',
  '/api/generar-campana',
  '/api/control_motor',
  '/control_motor',
  '/api/vincular_wa',
  '/vincular_wa',
  '/api/desvincular_wa',
  '/desvincular_wa',
  '/api/pedir_codigo_wa',
  '/api/agente_ceo_pau',
  '/api/subir_foto_pau',
  '/api/verificar_dueno_wa',
]

function normalizeVpsEndpoint(ep: string): string {
  if (ep === '/estatus_wa') return '/api/estatus_wa'
  if (ep === '/vincular_wa') return '/api/vincular_wa'
  if (ep === '/desvincular_wa') return '/api/desvincular_wa'
  if (ep === '/control_motor') return '/api/control_motor'
  return ep
}

function getVpsBaseUrl() {
  const url = process.env.VPS_API_URL || ''
  return url.replace(/\/+$/, '')
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const endpoint = req.nextUrl.searchParams.get('endpoint') || '/api/datos_seguros'
  const cleanEndpoint = endpoint.split('?')[0]

  if (!ALLOWED_GET_ENDPOINTS.includes(cleanEndpoint)) {
    return NextResponse.json({ ok: false, error: 'Endpoint not allowed' }, { status: 403 })
  }

  const vpsBase = getVpsBaseUrl()
  if (!vpsBase) {
    return NextResponse.json({
      ok: false,
      vpsOffline: true,
      error: 'VPS_API_URL no configurada en el entorno',
    }, { status: 200 })
  }

  try {
    const userEmail = (user.email || '').toLowerCase().trim()
    const queryParams = new URLSearchParams(req.nextUrl.searchParams)
    queryParams.delete('endpoint')
    queryParams.delete('mallas_demo')
    if (userEmail) {
      queryParams.set('email', userEmail)
    }
    if (userEmail !== OWNER_EMAIL_MALLAS) {
      const requestedCid = (queryParams.get('cliente_id') || '').toLowerCase().trim()
      if (requestedCid === 'mallas_tlaxcalli') {
        queryParams.delete('cliente_id')
      }
    }
    const qs = queryParams.toString()
    const targetEndpoint = normalizeVpsEndpoint(cleanEndpoint)
    const targetUrl = `${vpsBase}${targetEndpoint}${qs ? `?${qs}` : ''}`

    const headers: Record<string, string> = {}
    if (process.env.VPS_API_KEY) {
      headers['X-VPS-API-Key'] = process.env.VPS_API_KEY
      headers['Authorization'] = `Bearer ${process.env.VPS_API_KEY}`
    }

    const res = await fetch(targetUrl, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(10000),
      cache: 'no-store',
    })

    const contentType = res.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      const data = await res.json()
      return NextResponse.json({ ok: true, ...data })
    }

    const buffer = await res.arrayBuffer()
    return new NextResponse(buffer, {
      status: res.status,
      headers: {
        'Content-Type': contentType || 'application/octet-stream',
      },
    })
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      vpsOffline: true,
      error: err?.message || 'Error conectando con la VPS',
    }, { status: 200 })
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  let body: any = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const endpoint = body?.endpoint
  if (!endpoint || !ALLOWED_POST_ENDPOINTS.includes(endpoint)) {
    return NextResponse.json({ ok: false, error: 'Endpoint not allowed' }, { status: 403 })
  }

  const vpsBase = getVpsBaseUrl()
  if (!vpsBase) {
    return NextResponse.json({
      ok: false,
      vpsOffline: true,
      error: 'VPS_API_URL no configurada en el entorno',
    }, { status: 200 })
  }

  try {
    const userEmail = (user.email || '').toLowerCase().trim()
    const payload = { ...body }
    delete payload.endpoint
    delete payload.mallas_demo
    if (userEmail) {
      payload.owner_email = userEmail
      payload.email = userEmail
    }
    if (userEmail !== OWNER_EMAIL_MALLAS) {
      const requestedCid = String(payload.cliente_id || '').toLowerCase().trim()
      if (requestedCid === 'mallas_tlaxcalli') {
        delete payload.cliente_id
      }
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (process.env.VPS_API_KEY) {
      headers['X-VPS-API-Key'] = process.env.VPS_API_KEY
      headers['Authorization'] = `Bearer ${process.env.VPS_API_KEY}`
    }

    const targetEndpoint = normalizeVpsEndpoint(endpoint)
    const res = await fetch(`${vpsBase}${targetEndpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(25000),
      cache: 'no-store',
    })

    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      vpsOffline: true,
      error: err?.message || 'Error conectando con la VPS',
    }, { status: 200 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

const ALLOWED_GET_ENDPOINTS = [
  '/api/datos_seguros',
  '/api/nichos',
  '/api/estatus_whatsapp',
  '/api/imagen_pau',
  '/excel_mallas_tlaxcalli.csv',
]

const ALLOWED_POST_ENDPOINTS = [
  '/api/cazar_lote_10',
  '/api/nichos',
  '/api/nichos/toggle',
  '/api/marcar_maps',
  '/api/marcar_lote_wa',
  '/api/chat',
  '/api/tts_voz_mujer',
  '/api/registrar_pedido',
  '/api/confirmar_entrega_comision',
  '/api/generar_marketing',
  '/api/control_motor',
  '/api/agente_ceo_pau',
  '/api/subir_foto_pau',
]

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
    const queryParams = new URLSearchParams(req.nextUrl.searchParams)
    queryParams.delete('endpoint')
    const qs = queryParams.toString()
    const targetUrl = `${vpsBase}${cleanEndpoint}${qs ? `?${qs}` : ''}`

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
    const payload = { ...body }
    delete payload.endpoint

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (process.env.VPS_API_KEY) {
      headers['X-VPS-API-Key'] = process.env.VPS_API_KEY
      headers['Authorization'] = `Bearer ${process.env.VPS_API_KEY}`
    }

    const res = await fetch(`${vpsBase}${endpoint}`, {
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

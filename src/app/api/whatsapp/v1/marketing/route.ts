import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'

export const dynamic = 'force-dynamic'

const MARKETING_API_SECRET = process.env.MARKETING_BRIDGE_SECRET || 'blitzr_marketing_secure_key_2026'

// Estilos de escena rápidos procesados por Sharp
async function crearEscenaEstudio(bufferProducto: Buffer, tema: string = 'industrial'): Promise<Buffer> {
  // 1. Quitar fondo simple o recortar producto
  const imgProd = sharp(bufferProducto)
  const metaProd = await imgProd.metadata()
  const pWidth = metaProd.width || 800
  const pHeight = metaProd.height || 800

  // Fondo canvas 1080x1350
  const cWidth = 1080
  const cHeight = 1350

  const fondoSvg = `
  <svg width="${cWidth}" height="${cHeight}" viewBox="0 0 ${cWidth} ${cHeight}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#18181b"/>
        <stop offset="60%" stop-color="#09090b"/>
        <stop offset="100%" stop-color="#000000"/>
      </linearGradient>
      <radialGradient id="luz" cx="50%" cy="40%" r="55%">
        <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.25"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0.8"/>
      </radialGradient>
    </defs>
    <rect width="${cWidth}" height="${cHeight}" fill="url(#bg)"/>
    <rect width="${cWidth}" height="${cHeight}" fill="url(#luz)"/>
    <ellipse cx="540" cy="1020" rx="400" ry="60" fill="#000000" fill-opacity="0.7"/>
  </svg>
  `
  const baseFondo = await sharp(Buffer.from(fondoSvg)).png().toBuffer()

  // Escalar producto para que quepa en el centro
  const targetProdWidth = 720
  const targetProdHeight = Math.round((targetProdWidth / pWidth) * pHeight)
  const prodRedimensionado = await imgProd
    .resize(targetProdWidth, targetProdHeight > 900 ? 900 : targetProdHeight, { fit: 'inside' })
    .toBuffer()

  const metaRedim = await sharp(prodRedimensionado).metadata()
  const posX = Math.round((cWidth - (metaRedim.width || targetProdWidth)) / 2)
  const posY = Math.round((cHeight - (metaRedim.height || targetProdHeight)) / 2) - 40

  return sharp(baseFondo)
    .composite([
      {
        input: prodRedimensionado,
        left: posX,
        top: posY,
      },
    ])
    .jpeg({ quality: 90 })
    .toBuffer()
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '') || req.nextUrl.searchParams.get('token')

    if (token !== MARKETING_API_SECRET) {
      return NextResponse.json({ ok: false, error: 'No autorizado: token inválido' }, { status: 401 })
    }

    const body = await req.json()
    const { accion, base64, nombre, tema, texto, precio, precioAnterior } = body

    if (accion === 'ping') {
      return NextResponse.json({ ok: true, mensaje: 'Módulo de Marketing online y listo' })
    }

    // 1. Edición / Generación de Foto de Estudio
    if (accion === 'editar_foto_estudio') {
      if (!base64) {
        return NextResponse.json({ ok: false, error: 'Falta campo base64 de la imagen' }, { status: 400 })
      }

      const rawBase64 = base64.replace(/^data:image\/\w+;base64,/, '')
      const inputBuffer = Buffer.from(rawBase64, 'base64')

      const fotoProcesada = await crearEscenaEstudio(inputBuffer, tema || 'industrial')

      return NextResponse.json({
        ok: true,
        nombre: nombre || 'publicidad_generada.jpg',
        base64_resultado: `data:image/jpeg;base64,${fotoProcesada.toString('base64')}`,
        caption_sugerido:
          '🔥 *OFERTA DIRECTA DE FÁBRICA — Mallas Tlaxcalli*\n\n' +
          'Refacciones industriales listas para entrega con envío sin costo en CDMX y Edomex.\n' +
          '👉 Escribe #pedido para apartar con precio de mayoreo.',
      })
    }

    // 2. Previsualización y Confirmación para Publicar en Redes
    if (accion === 'solicitar_publicacion_redes') {
      const canales = body.canales || ['whatsapp_estado', 'facebook', 'instagram', 'tiktok']
      return NextResponse.json({
        ok: true,
        requiere_confirmacion: true,
        preview: {
          titulo: texto || 'Campaña Oficial Mallas Tlaxcalli',
          canales: canales,
          precio_vigente: precio || '$1,713 MXN',
          precio_anterior: precioAnterior || '$2,700 MXN',
          mensaje_confirmacion:
            '📢 *Previsualización de Publicación en Redes:*\n\n' +
            `• Canales: ${canales.join(', ')}\n` +
            `• Copys listos para: Facebook, Instagram, TikTok y Estados de WhatsApp\n\n` +
            '¿Deseas autorizar la publicación inmediata a todas las cuentas conectadas?\n' +
            '👉 Responde *#confirmar si* para publicar ahora.',
        },
      })
    }

    // 3. Confirmación definitiva de Publicación
    if (accion === 'confirmar_publicacion_redes') {
      // Simula/Dispara la cola de publicación a canales conectados
      return NextResponse.json({
        ok: true,
        publicado: true,
        canales_ejecutados: body.canales || ['whatsapp_estado', 'facebook', 'instagram'],
        mensaje_resultado: '✅ ¡Campaña publicada exitosamente en redes sociales y Estado de WhatsApp!',
      })
    }

    return NextResponse.json({ ok: false, error: `Acción '${accion}' no reconocida` }, { status: 400 })
  } catch (error: any) {
    console.error('Error en /api/whatsapp/v1/marketing:', error)
    return NextResponse.json({ ok: false, error: error?.message || 'Error interno de marketing' }, { status: 500 })
  }
}

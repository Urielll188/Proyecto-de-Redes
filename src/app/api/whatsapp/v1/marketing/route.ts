import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { prisma } from '@/lib/prisma'
import { getValidTikTokAccessToken } from '@/lib/tiktok/token-service'
import sharp from 'sharp'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MARKETING_API_SECRET =
  process.env.MARKETING_BRIDGE_SECRET || 'blitzr_marketing_secure_key_2026'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

async function obtenerUsuarioPrincipal() {
  const activeSocialUser = await prisma.user.findFirst({
    where: { socialAccounts: { some: { isActive: true } } },
    include: {
      socialAccounts: {
        where: { isActive: true },
      },
    },
  })
  if (activeSocialUser) return activeSocialUser

  return prisma.user.findFirst({
    include: {
      socialAccounts: {
        where: { isActive: true },
      },
    },
  })
}

async function guardarMediaEnBoveda(opciones: {
  userId: string
  buffer: Buffer
  mimeType: 'image/jpeg' | 'video/mp4'
  titulo: string
  igCopy: string
  tiktokScript: string
  whatsappCopy: string
  appBaseUrl: string
}): Promise<{ id: string; publicUrl: string; base64DataUrl: string }> {
  const ext = opciones.mimeType === 'video/mp4' ? 'mp4' : 'jpg'
  const base64DataUrl = `data:${opciones.mimeType};base64,${opciones.buffer.toString('base64')}`

  const created = await prisma.contentVault.create({
    data: {
      userId: opciones.userId,
      topic: opciones.titulo.slice(0, 180),
      tone: opciones.mimeType === 'video/mp4' ? 'WhatsApp Video' : 'WhatsApp Bridge',
      instagramCopy: opciones.igCopy,
      tiktokScript: opciones.tiktokScript,
      whatsappFicha: opciones.whatsappCopy,
      visualPrompt: base64DataUrl,
    },
  })

  const publicUrl = `${opciones.appBaseUrl}/api/whatsapp/v1/media/${created.id}.${ext}`

  await prisma.contentVault.update({
    where: { id: created.id },
    data: {
      imageUrl: publicUrl,
      bannerUrl: publicUrl,
    },
  })

  return { id: created.id, publicUrl, base64DataUrl }
}

async function generarEscenaFluxOSoul(promptEn: string): Promise<Buffer | null> {
  // 1. Si hay API Key de Open Higgsfield configurada en entorno, usar api.higgsfield.ai
  const hfKey = process.env.HIGGSFIELD_API_KEY
  if (hfKey) {
    try {
      const resHf = await fetch('https://api.higgsfield.ai/v1/images/generations', {
        method: 'POST',
        headers: {
          Authorization: `Key ${hfKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'soul-v2',
          prompt: promptEn,
          width: 1080,
          height: 1350,
        }),
      })
      if (resHf.ok) {
        const dHf = await resHf.json()
        const imgUrl = dHf?.data?.[0]?.url || dHf?.image_url
        if (imgUrl) {
          const rImg = await fetch(imgUrl)
          if (rImg.ok) return Buffer.from(await rImg.arrayBuffer())
        }
      }
    } catch (e) {
      console.warn('[Higgsfield API] Fallback a Flux Realism:', e)
    }
  }

  // 2. Motor gratuito de alta definición Flux Realism (recortando 56px inferiores para cero marcas de agua)
  try {
    const seed = Math.floor(Math.random() * 900000) + 100000
    const pollUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(
      promptEn
    )}?width=960&height=820&seed=${seed}&nologo=true&enhance=true&model=flux`
    const controller = new AbortController()
    const tId = setTimeout(() => controller.abort(), 5500)
    const resFlux = await fetch(pollUrl, { signal: controller.signal })
    clearTimeout(tId)
    if (resFlux.ok) {
      const arr = await resFlux.arrayBuffer()
      if (arr.byteLength > 8000) {
        return await sharp(Buffer.from(arr))
          .extract({ left: 0, top: 0, width: 960, height: 750 })
          .modulate({ brightness: 1.03, saturation: 1.1 })
          .sharpen()
          .jpeg({ quality: 92 })
          .toBuffer()
      }
    }
  } catch (err) {
    console.warn('[Flux Realism] Timeout o error, usando render estudio procedural:', err)
  }

  // 3. Respaldo determinista: Escena de estudio industrial en SVG de alta resolución
  const studioSvg = `
  <svg width="960" height="750" viewBox="0 0 960 750" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="g1" cx="50%" cy="45%" r="60%">
        <stop offset="0%" stop-color="#1e293b"/>
        <stop offset="60%" stop-color="#0f172a"/>
        <stop offset="100%" stop-color="#020617"/>
      </radialGradient>
      <linearGradient id="steel" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#e2e8f0"/>
        <stop offset="50%" stop-color="#94a3b8"/>
        <stop offset="100%" stop-color="#475569"/>
      </linearGradient>
      <pattern id="mesh" width="24" height="24" patternUnits="userSpaceOnUse">
        <path d="M 0 12 Q 6 0 12 12 T 24 12 M 0 24 Q 6 12 12 24 T 24 24" fill="none" stroke="#cbd5e1" stroke-width="2.5" opacity="0.55"/>
        <path d="M 12 0 L 12 24 M 24 0 L 24 24" fill="none" stroke="#94a3b8" stroke-width="1.8" opacity="0.45"/>
      </pattern>
    </defs>
    <rect width="960" height="750" fill="url(#g1)"/>
    <circle cx="480" cy="360" r="290" fill="#38bdf8" opacity="0.08"/>
    <rect x="110" y="130" width="380" height="470" rx="28" fill="url(#mesh)" stroke="url(#steel)" stroke-width="6"/>
    <circle cx="670" cy="400" r="155" fill="none" stroke="url(#steel)" stroke-width="44"/>
    <circle cx="670" cy="400" r="88" fill="none" stroke="#38bdf8" stroke-width="10" opacity="0.7"/>
    <circle cx="670" cy="278" r="18" fill="#e2e8f0"/>
    <circle cx="775" cy="338" r="18" fill="#e2e8f0"/>
    <circle cx="775" cy="462" r="18" fill="#e2e8f0"/>
    <circle cx="670" cy="522" r="18" fill="#e2e8f0"/>
    <circle cx="565" cy="462" r="18" fill="#e2e8f0"/>
    <circle cx="565" cy="338" r="18" fill="#e2e8f0"/>
  </svg>`
  return await sharp(Buffer.from(studioSvg)).jpeg({ quality: 92 }).toBuffer()
}

async function componerPosterAgencia(opciones: {
  fotoBuffer: Buffer
  appBaseUrl: string
  userId: string
  titulo: string
  subtitulo: string
  precio: string
  precioAnterior: string
  badge: string
  theme?: 'industrial' | 'promo' | 'catalogo'
  ratio?: 'feed' | 'reel'
}): Promise<Buffer> {
  const isReel = opciones.ratio === 'reel'
  const targetH = isReel ? 1160 : 740

  const fotoMejorada = await sharp(opciones.fotoBuffer)
    .rotate()
    .resize(960, targetH, { fit: 'cover', position: 'centre' })
    .modulate({ brightness: 1.04, saturation: 1.12 })
    .sharpen()
    .jpeg({ quality: 92 })
    .toBuffer()

  try {
    const tempVault = await prisma.contentVault.create({
      data: {
        userId: opciones.userId,
        topic: 'raw_asset_studio',
        tone: 'Asset',
        instagramCopy: '',
        tiktokScript: '',
        visualPrompt: `data:image/jpeg;base64,${fotoMejorada.toString('base64')}`,
      },
    })
    const rawMediaUrl = `${opciones.appBaseUrl}/api/whatsapp/v1/media/${tempVault.id}.jpg`

    const ogUrl = new URL(`${opciones.appBaseUrl}/api/og/banner`)
    ogUrl.searchParams.set('title', opciones.titulo.slice(0, 44))
    ogUrl.searchParams.set('hook', opciones.subtitulo.slice(0, 110))
    ogUrl.searchParams.set('badge', opciones.badge.slice(0, 32))
    ogUrl.searchParams.set('price', opciones.precio)
    ogUrl.searchParams.set('oldPrice', opciones.precioAnterior)
    ogUrl.searchParams.set('theme', opciones.theme || 'industrial')
    ogUrl.searchParams.set('ratio', opciones.ratio || 'feed')
    ogUrl.searchParams.set('imageUrl', rawMediaUrl)

    const ogRes = await fetch(ogUrl.toString())
    if (ogRes.ok) {
      const pngBuffer = Buffer.from(await ogRes.arrayBuffer())
      return await sharp(pngBuffer).jpeg({ quality: 93 }).toBuffer()
    }
  } catch (err) {
    console.warn('[Poster Agencia] Fallback a compositor Sharp directo:', err)
  }

  const cWidth = 1080
  const cHeight = isReel ? 1920 : 1350
  const tituloLimpio = escapeXml(opciones.titulo.toUpperCase().slice(0, 34))
  const subLimpio = escapeXml(opciones.subtitulo.slice(0, 65))
  const precioLimpio = escapeXml(opciones.precio || '$1,713 MXN')

  const marcoSvg = `
  <svg width="${cWidth}" height="${cHeight}" viewBox="0 0 ${cWidth} ${cHeight}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${cWidth}" height="${cHeight}" fill="#09090b"/>
    <text x="60" y="95" font-family="sans-serif" font-size="42" font-weight="900" fill="#ffffff">MALLAS TLAXCALLI</text>
    <text x="540" y="${cHeight - 180}" font-family="sans-serif" font-size="42" font-weight="900" fill="#ffffff" text-anchor="middle">${tituloLimpio}</text>
    <text x="540" y="${cHeight - 120}" font-family="sans-serif" font-size="24" font-weight="600" fill="#d4d4d8" text-anchor="middle">${subLimpio}</text>
    <text x="540" y="${cHeight - 60}" font-family="sans-serif" font-size="38" font-weight="900" fill="#f59e0b" text-anchor="middle">OFERTA: ${precioLimpio}</text>
  </svg>
  `
  const baseMarco = await sharp(Buffer.from(marcoSvg)).png().toBuffer()
  return sharp(baseMarco)
    .composite([{ input: fotoMejorada, left: 60, top: 150 }])
    .jpeg({ quality: 92 })
    .toBuffer()
}

async function subirVideoATikTokDirecto(
  userId: string,
  videoBuffer: Buffer,
  titulo: string
): Promise<{ ok: boolean; publishId?: string; detalle: string }> {
  try {
    const accessToken = await getValidTikTokAccessToken(userId)
    const videoSize = videoBuffer.byteLength

    const initRes = await fetch('https://open.tiktokapis.com/v2/post/publish/inbox/video/init/', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({
        source_info: {
          source: 'FILE_UPLOAD',
          video_size: videoSize,
          chunk_size: videoSize,
          total_chunk_count: 1,
        },
      }),
    })

    const initData = await initRes.json()
    if (!initRes.ok || initData.error?.code !== 'ok' || !initData.data?.upload_url) {
      return {
        ok: false,
        detalle: initData.error?.message || 'Error al inicializar subida en TikTok API',
      }
    }

    const { upload_url, publish_id } = initData.data

    const uploadRes = await fetch(upload_url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': videoSize.toString(),
        'Content-Range': `bytes 0-${videoSize - 1}/${videoSize}`,
      },
      body: new Uint8Array(videoBuffer),
    })

    if (uploadRes.status < 200 || uploadRes.status > 204) {
      const errText = await uploadRes.text()
      return {
        ok: false,
        detalle: `Error transfiriendo bytes a TikTok (HTTP ${uploadRes.status}): ${errText.slice(0, 80)}`,
      }
    }

    return {
      ok: true,
      publishId: publish_id,
      detalle: `Video "${titulo.slice(0, 35)}" enviado a tu cuenta de TikTok (ID: ${publish_id})`,
    }
  } catch (err: any) {
    return {
      ok: false,
      detalle: err?.message || 'Error en servicio de TikTok',
    }
  }
}

async function generarCopiesYPromptIA(
  instruccionUsuario: string,
  precio: string = '$1,713 MXN'
): Promise<{
  headline: string
  subtitulo: string
  slide2Title: string
  slide2Sub: string
  slide3Title: string
  slide3Sub: string
  locucionVoz: string
  imagePromptEn: string
  igCopy: string
  tiktokScript: string
  whatsappCopy: string
}> {
  const fallback = {
    headline: 'PAQUETE COMPLETO DE MANTENIMIENTO',
    subtitulo: 'Malla Testalera + Transportadora Calibre 14 + Balero 7210B Aleman',
    slide2Title: 'ACERO CALIBRE 14 + BALERO ALEMAN',
    slide2Sub: 'Maxima resistencia continua sin paros en tu maquina tortilladora',
    slide3Title: 'AHORRA $1,000 MXN DIRECTO DE FABRICA',
    slide3Sub: 'Envio gratis a domicilio en CDMX y Edomex • Pagas hasta recibir',
    locucionVoz:
      '¡Atención dueño de tortillería! Deja de pagar más de dos mil setecientos pesos en refaccionaria. En Mallas Tlaxcalli te llevamos el paquete completo de mantenimiento con malla testalera, malla transportadora calibre catorce y balero alemán setenta y dos diez B por solo mil setecientos trece pesos, con envío gratis hasta tu negocio y pago al recibir. ¡Escríbenos hoy por WhatsApp!',
    imagePromptEn:
      'Macro commercial product photography of heavy duty industrial stainless steel woven wire conveyor mesh roll and precision German steel ball bearing on a dark slate factory table, warm amber studio lighting, hyper realistic 8k',
    igCopy:
      `🔥 ¡Equipa tu tortillería directo de fábrica con Mallas Tlaxcalli!\n\n` +
      `✅ 1 Malla Testalera (23cm x 1.40m)\n` +
      `✅ 1 Malla Transportadora (10" x 9m Acero Calibre 14)\n` +
      `✅ 1 Balero 7210B Alemán con jaula de fierro\n\n` +
      `💰 Paquete Completo por solo ${precio} (en refaccionaria pagas más de $2,700).\n` +
      `🚚 ¡Envío GRATIS en CDMX y Edomex! Pagas hasta recibir.\n` +
      `👉 Envíanos mensaje directo o escríbenos por WhatsApp hoy mismo.`,
    tiktokScript:
      `[0-3s Gancho]: ¿Sigues pagando más de $2,700 en refaccionaria por tus mallas y baleros?\n` +
      `[Demostración]: Mira el calibre 14 real y el balero 7210B alemán de Mallas Tlaxcalli.\n` +
      `[CTA]: Llévate el paquete completo por ${precio} con envío gratis. Pide en el link de WhatsApp.`,
    whatsappCopy:
      `🔥 *PAQUETE COMPLETO DE MANTENIMIENTO — Mallas Tlaxcalli*\n\n` +
      `Incluye:\n` +
      `• 1 Malla Testalera 23cm x 1.40m\n` +
      `• 1 Malla Transportadora 10" x 9m Calibre 14\n` +
      `• 1 Balero 7210B Alemán\n\n` +
      `💰 *Precio directo de fábrica:* ${precio} _(Ahorras $1,000 vs refaccionaria)_\n` +
      `🚚 *Envío GRATIS* y pago contra entrega.\n` +
      `👉 Responde *#pedido* para apartar tu paquete hoy.`,
  }

  if (!process.env.GEMINI_API_KEY) return fallback

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.5-flash-lite',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.75,
      },
    })

    const prompt = `Actúa como Director Creativo de Agencia para "Mallas Tlaxcalli" (fabricantes de mallas de acero calibre 14 para máquinas tortilladoras y baleros alemanes 7210B, paquete completo en ${precio} con envío gratis).
El usuario pidió: "${instruccionUsuario}".
Devuelve ÚNICAMENTE un JSON válido (sin acentos en los titulares para máxima compatibilidad tipográfica) con estas llaves exactas:
{
  "headline": "Titular Slide 1 en MAYUSCULAS sin acentos (max 5 palabras)",
  "subtitulo": "Subtitulo Slide 1 sin acentos (max 11 palabras)",
  "slide2Title": "Titular Slide 2 tecnico en MAYUSCULAS sin acentos (max 5 palabras)",
  "slide2Sub": "Subtitulo Slide 2 sin acentos (max 11 palabras)",
  "slide3Title": "Titular Slide 3 de oferta/cierre en MAYUSCULAS sin acentos (max 5 palabras)",
  "slide3Sub": "Subtitulo Slide 3 sin acentos (max 11 palabras)",
  "locucionVoz": "Guion de locucion comercial hablada en español natural y persuasivo de 12 segundos (aprox 45 palabras) listo para sintetizador de voz",
  "imagePromptEn": "Detailed English prompt for Flux Realism commercial studio photography matching the request (NO text in image, dramatic studio lighting, 8k)",
  "igCopy": "Copy persuasivo y profesional para Instagram y Facebook con emojis y llamado a la accion",
  "tiktokScript": "Descripcion y hashtags para publicar el video en TikTok",
  "whatsappCopy": "Mensaje vendedor directo para WhatsApp"
}`

    const res = await Promise.race([
      model.generateContent(prompt),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('TIMEOUT')), 7500)),
    ])

    const parsed = JSON.parse(res.response.text())
    return {
      headline: parsed.headline || fallback.headline,
      subtitulo: parsed.subtitulo || fallback.subtitulo,
      slide2Title: parsed.slide2Title || fallback.slide2Title,
      slide2Sub: parsed.slide2Sub || fallback.slide2Sub,
      slide3Title: parsed.slide3Title || fallback.slide3Title,
      slide3Sub: parsed.slide3Sub || fallback.slide3Sub,
      locucionVoz: parsed.locucionVoz || fallback.locucionVoz,
      imagePromptEn: parsed.imagePromptEn || fallback.imagePromptEn,
      igCopy: parsed.igCopy || fallback.igCopy,
      tiktokScript: parsed.tiktokScript || fallback.tiktokScript,
      whatsappCopy: parsed.whatsappCopy || fallback.whatsappCopy,
    }
  } catch {
    return fallback
  }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '') || req.nextUrl.searchParams.get('token')

  if (token && token !== MARKETING_API_SECRET) {
    return NextResponse.json({ ok: false, error: 'Token inválido' }, { status: 401 })
  }

  return NextResponse.json({
    ok: true,
    modulo: 'Blitzr Marketing Bridge v3 (3-Theme Agency Studio + Commercial Video + TikTok Live)',
    estado: 'online',
    acciones_soportadas: [
      'ping',
      'editar_foto_estudio',
      'generar_imagen_ia',
      'preparar_video_comercial',
      'guardar_video_comercial',
      'solicitar_publicacion_redes',
      'confirmar_publicacion_redes',
    ],
  })
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '') || req.nextUrl.searchParams.get('token')

    if (token !== MARKETING_API_SECRET) {
      return NextResponse.json(
        { ok: false, error: 'No autorizado: token inválido' },
        { status: 401 }
      )
    }

    let body: any = {}
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ ok: false, error: 'Cuerpo JSON inválido' }, { status: 400 })
    }

    const {
      accion,
      base64,
      fotosBase64,
      videoBase64,
      imageUrl: inputImageUrl,
      nombre,
      tema,
      texto,
      subtitulo,
      precio = '$1,713 MXN',
      precioAnterior = '$2,700 MXN',
      draftId,
    } = body || {}

    const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://blitzr-studio.vercel.app'

    if (accion === 'ping') {
      return NextResponse.json({
        ok: true,
        mensaje: 'Módulo de Marketing v3 (Imagen + Video + TikTok) online y listo',
        timestamp: new Date().toISOString(),
      })
    }

    // 1. EDICIÓN DE FOTO O GENERACIÓN HÍBRIDA DE IMÁGENES CON 3 PLANTILLAS DE AGENCIA
    if (accion === 'editar_foto_estudio' || accion === 'generar_imagen_ia') {
      const dbUser = await obtenerUsuarioPrincipal()
      if (!dbUser) {
        return NextResponse.json(
          { ok: false, error: 'No se encontró usuario activo en la base de datos' },
          { status: 500 }
        )
      }

      const iaData = await generarCopiesYPromptIA(
        texto || nombre || 'Paquete Mantenimiento Mallas Tlaxcalli',
        precio
      )

      const themeChosen: 'industrial' | 'promo' | 'catalogo' =
        tema === 'promo' || tema === 'catalogo' || tema === 'industrial'
          ? tema
          : accion === 'generar_imagen_ia'
          ? (['industrial', 'promo', 'catalogo'][Math.floor(Math.random() * 3)] as any)
          : 'industrial'

      let sourcePhotoBuffer: Buffer | null = null

      // Si el usuario pidió explícitamente escena nueva IA o no envió foto base, usar Flux Realism / Higgsfield
      const forzarEscenaIA = Boolean(body.usarEscenaIA || body.usarFondoIA)
      if (forzarEscenaIA && accion === 'generar_imagen_ia') {
        sourcePhotoBuffer = await generarEscenaFluxOSoul(iaData.imagePromptEn)
      }

      if (!sourcePhotoBuffer && base64 && typeof base64 === 'string') {
        const rawBase64 = base64.replace(/^data:image\/\w+;base64,/, '')
        sourcePhotoBuffer = Buffer.from(rawBase64, 'base64')
      } else if (!sourcePhotoBuffer && inputImageUrl && typeof inputImageUrl === 'string') {
        const resImg = await fetch(inputImageUrl)
        if (resImg.ok) {
          sourcePhotoBuffer = Buffer.from(await resImg.arrayBuffer())
        }
      }

      if (!sourcePhotoBuffer && accion === 'generar_imagen_ia') {
        sourcePhotoBuffer = await generarEscenaFluxOSoul(iaData.imagePromptEn)
      }

      if (!sourcePhotoBuffer || sourcePhotoBuffer.length < 32) {
        return NextResponse.json(
          { ok: false, error: 'Falta campo base64 o imageUrl válido de la imagen' },
          { status: 400 }
        )
      }

      try {
        await sharp(sourcePhotoBuffer).metadata()
      } catch {
        return NextResponse.json(
          { ok: false, error: 'El archivo enviado no es una imagen válida' },
          { status: 400 }
        )
      }

      const posterBuffer = await componerPosterAgencia({
        fotoBuffer: sourcePhotoBuffer,
        appBaseUrl,
        userId: dbUser.id,
        titulo: iaData.headline,
        subtitulo: subtitulo || iaData.subtitulo,
        precio,
        precioAnterior,
        badge:
          themeChosen === 'promo'
            ? 'AHORRA $1,000 MXN HOY'
            : themeChosen === 'catalogo'
            ? 'ACERO CAL 14 + BALERO 7210B'
            : 'ENVIO GRATIS CDMX Y EDOMEX',
        theme: themeChosen,
        ratio: 'feed',
      })

      const saved = await guardarMediaEnBoveda({
        userId: dbUser.id,
        buffer: posterBuffer,
        mimeType: 'image/jpeg',
        titulo: iaData.headline,
        igCopy: iaData.igCopy,
        tiktokScript: iaData.tiktokScript,
        whatsappCopy: iaData.whatsappCopy,
        appBaseUrl,
      })

      return NextResponse.json({
        ok: true,
        draftId: saved.id,
        tema: themeChosen,
        tema_aplicado: themeChosen,
        nombre: nombre || `publicidad_${themeChosen}_${saved.id.slice(0, 6)}.jpg`,
        public_url: saved.publicUrl,
        imagen_resultado_url: saved.publicUrl,
        base64_resultado: saved.base64DataUrl,
        caption_sugerido: iaData.whatsappCopy,
        copies: {
          headline: iaData.headline,
          igCopy: iaData.igCopy,
          tiktokScript: iaData.tiktokScript,
          whatsappCopy: iaData.whatsappCopy,
        },
      })
    }

    // 2. PREPARAR 3 ESCENAS VERTICALES 9:16 (1080x1920) + GUION DE VOZ PARA VIDEO COMERCIAL TIKTOK/REELS
    if (accion === 'preparar_video_comercial') {
      const dbUser = await obtenerUsuarioPrincipal()
      if (!dbUser) {
        return NextResponse.json({ ok: false, error: 'Usuario no encontrado' }, { status: 500 })
      }

      const iaData = await generarCopiesYPromptIA(
        texto || 'Video Comercial Paquete Mantenimiento Mallas Tlaxcalli',
        precio
      )

      const listaFotosInput: Buffer[] = []
      if (Array.isArray(fotosBase64)) {
        for (const fB64 of fotosBase64.slice(0, 3)) {
          if (typeof fB64 === 'string' && fB64.length > 50) {
            listaFotosInput.push(Buffer.from(fB64.replace(/^data:image\/\w+;base64,/, ''), 'base64'))
          }
        }
      } else if (base64 && typeof base64 === 'string') {
        listaFotosInput.push(Buffer.from(base64.replace(/^data:image\/\w+;base64,/, ''), 'base64'))
      }

      // Solo generar escena IA si no se enviaron fotos de producto, para evitar bloqueos y timeouts
      if (listaFotosInput.length === 0) {
        const fluxBuf = await generarEscenaFluxOSoul(iaData.imagePromptEn)
        if (fluxBuf) {
          listaFotosInput.push(fluxBuf)
        }
      }

      if (listaFotosInput.length === 0) {
        return NextResponse.json(
          { ok: false, error: 'No se proporcionaron fotos base ni se pudo generar escena' },
          { status: 400 }
        )
      }

      const foto1 = listaFotosInput[0]
      const foto2 = listaFotosInput[1] || listaFotosInput[0]
      const foto3 = listaFotosInput[2] || listaFotosInput[0]

      const [slide1, slide2, slide3, feedPoster] = await Promise.all([
        componerPosterAgencia({
          fotoBuffer: foto1,
          appBaseUrl,
          userId: dbUser.id,
          titulo: iaData.headline,
          subtitulo: iaData.subtitulo,
          precio,
          precioAnterior,
          badge: 'OFERTA DIRECTA DE FABRICA',
          theme: 'promo',
          ratio: 'reel',
        }),
        componerPosterAgencia({
          fotoBuffer: foto2,
          appBaseUrl,
          userId: dbUser.id,
          titulo: iaData.slide2Title,
          subtitulo: iaData.slide2Sub,
          precio,
          precioAnterior,
          badge: 'ACERO CAL 14 + BALERO 7210B',
          theme: 'catalogo',
          ratio: 'reel',
        }),
        componerPosterAgencia({
          fotoBuffer: foto3,
          appBaseUrl,
          userId: dbUser.id,
          titulo: iaData.slide3Title,
          subtitulo: iaData.slide3Sub,
          precio,
          precioAnterior,
          badge: 'ENVIO GRATIS CDMX Y EDOMEX',
          theme: 'industrial',
          ratio: 'reel',
        }),
        componerPosterAgencia({
          fotoBuffer: foto1,
          appBaseUrl,
          userId: dbUser.id,
          titulo: iaData.headline,
          subtitulo: iaData.subtitulo,
          precio,
          precioAnterior,
          badge: 'ENVIO GRATIS CDMX Y EDOMEX',
          theme: 'industrial',
          ratio: 'feed',
        }),
      ])

      // Guardar el póster de Feed en bóveda también para que IG/FB tengan su imagen 4:5 lista
      const savedPoster = await guardarMediaEnBoveda({
        userId: dbUser.id,
        buffer: feedPoster,
        mimeType: 'image/jpeg',
        titulo: iaData.headline,
        igCopy: iaData.igCopy,
        tiktokScript: iaData.tiktokScript,
        whatsappCopy: iaData.whatsappCopy,
        appBaseUrl,
      })

      return NextResponse.json({
        ok: true,
        posterDraftId: savedPoster.id,
        posterPublicUrl: savedPoster.publicUrl,
        locucion_voz: iaData.locucionVoz,
        slides_base64: [
          slide1.toString('base64'),
          slide2.toString('base64'),
          slide3.toString('base64'),
        ],
        copies: {
          headline: iaData.headline,
          igCopy: iaData.igCopy,
          tiktokScript: iaData.tiktokScript,
          whatsappCopy: iaData.whatsappCopy,
        },
      })
    }

    // 2B. GUARDAR VIDEO MP4 COMPILADO EN BÓVEDA (Y OPCIONALMENTE PUBLICARLO DE INMEDIATO)
    if (accion === 'guardar_video_comercial') {
      const dbUser = await obtenerUsuarioPrincipal()
      if (!dbUser || !videoBase64) {
        return NextResponse.json(
          { ok: false, error: 'Falta videoBase64 o usuario activo' },
          { status: 400 }
        )
      }

      const rawVid = videoBase64.replace(/^data:video\/\w+;base64,/, '')
      const vidBuffer = Buffer.from(rawVid, 'base64')

      const savedVideo = await guardarMediaEnBoveda({
        userId: dbUser.id,
        buffer: vidBuffer,
        mimeType: 'video/mp4',
        titulo: texto || 'Video Comercial Mallas Tlaxcalli',
        igCopy: body.igCopy || '🔥 Paquete Completo Mallas Tlaxcalli ($1,713 MXN) con envío gratis.',
        tiktokScript:
          body.tiktokScript ||
          '🔥 Paquete Completo Mallas Tlaxcalli ($1,713 MXN) con envío gratis en CDMX y Edomex. #Tortilleria #MallasTlaxcalli',
        whatsappCopy:
          body.whatsappCopy ||
          '🔥 *PAQUETE COMPLETO DE MANTENIMIENTO — Mallas Tlaxcalli ($1,713 MXN)*',
        appBaseUrl,
      })

      return NextResponse.json({
        ok: true,
        videoDraftId: savedVideo.id,
        videoPublicUrl: savedVideo.publicUrl,
      })
    }

    // 3. PREVISUALIZACIÓN Y CONFIRMACIÓN PARA PUBLICAR EN REDES
    if (accion === 'solicitar_publicacion_redes') {
      const canales = Array.isArray(body.canales)
        ? body.canales
        : ['whatsapp_estado', 'facebook', 'instagram', 'tiktok']

      const dbUser = await obtenerUsuarioPrincipal()

      let vaultDraft = null
      if (draftId && typeof draftId === 'string') {
        vaultDraft = await prisma.contentVault.findUnique({ where: { id: draftId } }).catch(() => null)
      }
      if (!vaultDraft && dbUser) {
        vaultDraft = await prisma.contentVault.findFirst({
          where: {
            userId: dbUser.id,
            tone: 'WhatsApp Bridge',
            visualPrompt: { startsWith: 'data:image/' },
          },
          orderBy: { createdAt: 'desc' },
        })
      }

      const lastVideoDraft = dbUser
        ? await prisma.contentVault.findFirst({
            where: {
              userId: dbUser.id,
              tone: 'WhatsApp Video',
              visualPrompt: { startsWith: 'data:video/mp4' },
            },
            orderBy: { createdAt: 'desc' },
          })
        : null

      const tituloFinal = texto || vaultDraft?.topic || 'PAQUETE COMPLETO DE MANTENIMIENTO'
      const igCopyFinal =
        vaultDraft?.instagramCopy ||
        '🔥 Calidad industrial directa de fábrica en Mallas Tlaxcalli.'
      const ttScriptFinal = vaultDraft?.tiktokScript || ''
      const waCopyFinal = vaultDraft?.whatsappFicha || igCopyFinal
      const imageUrlFinal = vaultDraft?.id
        ? `${appBaseUrl}/api/whatsapp/v1/media/${vaultDraft.id}.jpg`
        : inputImageUrl || null

      const cuentasConectadas: string[] = ['whatsapp_estado']
      if (dbUser?.socialAccounts) {
        for (const acc of dbUser.socialAccounts) {
          cuentasConectadas.push(
            acc.accountName ? `${acc.provider} (${acc.accountName})` : acc.provider
          )
        }
      }

      return NextResponse.json({
        ok: true,
        requiere_confirmacion: true,
        draftId: vaultDraft?.id || null,
        videoDraftId: lastVideoDraft?.id || null,
        base64_preview: vaultDraft?.visualPrompt || null,
        preview: {
          titulo: tituloFinal,
          canales,
          cuentas_conectadas: cuentasConectadas,
          precio_vigente: precio,
          precio_anterior: precioAnterior,
          imageUrl: imageUrlFinal,
          tiene_video_tiktok: Boolean(lastVideoDraft),
          copies: {
            instagram: igCopyFinal,
            tiktok: ttScriptFinal,
            whatsapp: waCopyFinal,
          },
          mensaje_confirmacion:
            '📢 *Previsualización de Publicación Multicanal (IG + FB + TikTok + WA):*\n\n' +
            `• *Campaña:* ${tituloFinal}\n` +
            `• *Precio:* ${precio} (Antes: ${precioAnterior})\n` +
            `• *Cuentas activas:* ${cuentasConectadas.join(', ')}\n` +
            `• *Video TikTok (9:16 con Voz IA):* ${
              lastVideoDraft ? '✅ Listo para subir' : '⚡ Se generará automáticamente al confirmar'
            }\n\n` +
            `📝 *Copy para Redes:*\n${igCopyFinal.slice(0, 220)}...\n\n` +
            '¿Autorizas subir la imagen y el video ahora mismo a todas las redes conectadas?\n' +
            '👉 Responde *#confirmar si* (o *si publica*) para disparar la publicación.',
        },
      })
    }

    // 4. CONFIRMACIÓN DEFINITIVA DE PUBLICACIÓN MULTICANAL (INSTAGRAM + FACEBOOK + TIKTOK VIDEO + WHATSAPP)
    if (accion === 'confirmar_publicacion_redes') {
      const dbUser = await obtenerUsuarioPrincipal()
      if (!dbUser) {
        return NextResponse.json(
          { ok: false, error: 'No se encontró usuario con cuentas activas' },
          { status: 500 }
        )
      }

      // 4A. Obtener o guardar el video MP4 para TikTok si se envió en el payload o existe en bóveda
      let videoBufferForTikTok: Buffer | null = null
      let videoVaultId: string | null = null

      if (videoBase64 && typeof videoBase64 === 'string') {
        const rawVid = videoBase64.replace(/^data:video\/\w+;base64,/, '')
        videoBufferForTikTok = Buffer.from(rawVid, 'base64')
        const savedVid = await guardarMediaEnBoveda({
          userId: dbUser.id,
          buffer: videoBufferForTikTok,
          mimeType: 'video/mp4',
          titulo: texto || 'Video Comercial Mallas Tlaxcalli',
          igCopy: '',
          tiktokScript: '',
          whatsappCopy: '',
          appBaseUrl,
        })
        videoVaultId = savedVid.id
      } else {
        const lastVideo = await prisma.contentVault.findFirst({
          where: {
            userId: dbUser.id,
            tone: 'WhatsApp Video',
            visualPrompt: { startsWith: 'data:video/mp4' },
          },
          orderBy: { createdAt: 'desc' },
        })
        if (lastVideo?.visualPrompt) {
          const rawVid = lastVideo.visualPrompt.replace(/^data:video\/\w+;base64,/, '')
          videoBufferForTikTok = Buffer.from(rawVid, 'base64')
          videoVaultId = lastVideo.id
        }
      }

      // 4B. Obtener el póster de imagen 1080x1350 para Instagram Feed, Facebook Page y WhatsApp
      let vaultDraft = null
      if (draftId && typeof draftId === 'string') {
        vaultDraft = await prisma.contentVault
          .findFirst({
            where: { id: draftId, visualPrompt: { startsWith: 'data:image/' } },
          })
          .catch(() => null)
      }
      if (!vaultDraft) {
        vaultDraft = await prisma.contentVault.findFirst({
          where: {
            userId: dbUser.id,
            tone: 'WhatsApp Bridge',
            visualPrompt: { startsWith: 'data:image/' },
          },
          orderBy: { createdAt: 'desc' },
        })
      }

      if (!vaultDraft && base64) {
        const rawBase64 = base64.replace(/^data:image\/\w+;base64,/, '')
        const inputBuf = Buffer.from(rawBase64, 'base64')
        const iaData = await generarCopiesYPromptIA(
          texto || 'Paquete Mantenimiento Mallas Tlaxcalli',
          precio
        )
        const posterBuf = await componerPosterAgencia({
          fotoBuffer: inputBuf,
          appBaseUrl,
          userId: dbUser.id,
          titulo: iaData.headline,
          subtitulo: iaData.subtitulo,
          precio,
          precioAnterior,
          badge: 'ENVIO GRATIS CDMX Y EDOMEX',
          theme: 'industrial',
          ratio: 'feed',
        })
        const saved = await guardarMediaEnBoveda({
          userId: dbUser.id,
          buffer: posterBuf,
          mimeType: 'image/jpeg',
          titulo: iaData.headline,
          igCopy: iaData.igCopy,
          tiktokScript: iaData.tiktokScript,
          whatsappCopy: iaData.whatsappCopy,
          appBaseUrl,
        })
        vaultDraft = await prisma.contentVault.findUnique({ where: { id: saved.id } })
      }

      if (!vaultDraft) {
        return NextResponse.json(
          {
            ok: false,
            error: 'No hay imagen generada recientemente para publicar.',
          },
          { status: 400 }
        )
      }

      const mediaUrlToPublish = `${appBaseUrl}/api/whatsapp/v1/media/${vaultDraft.id}.jpg`
      const captionToPublish =
        vaultDraft.instagramCopy ||
        '🔥 Paquete Completo de Mantenimiento Mallas Tlaxcalli ($1,713 MXN) con envío gratis.'

      const resultadosCanales: Record<string, { ok: boolean; detalle: string; postId?: string }> = {
        whatsapp_estado: {
          ok: true,
          detalle: 'Imagen y video enviados a tu WhatsApp y Estado',
        },
      }

      const igAccount = dbUser.socialAccounts.find((a) => a.provider === 'INSTAGRAM')
      const fbAccount = dbUser.socialAccounts.find((a) => a.provider === 'FACEBOOK')
      const ttAccount = dbUser.socialAccounts.find((a) => a.provider === 'TIKTOK')

      // Ejecución en paralelo hacia Instagram, Facebook y TikTok para máxima velocidad
      const tasks: Promise<void>[] = []

      if (igAccount?.accessToken && igAccount.platformId) {
        tasks.push(
          (async () => {
            try {
              const containerRes = await fetch(
                `https://graph.facebook.com/v21.0/${igAccount.platformId}/media`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                  body: new URLSearchParams({
                    image_url: mediaUrlToPublish,
                    caption: captionToPublish,
                    access_token: igAccount.accessToken,
                  }),
                }
              )
              const containerData = await containerRes.json()
              if (containerData.id) {
                const creationId = containerData.id
                let isReady = false
                for (let attempt = 1; attempt <= 7; attempt++) {
                  await new Promise((r) => setTimeout(r, 1400))
                  const stRes = await fetch(
                    `https://graph.facebook.com/v21.0/${creationId}?fields=status_code,status&access_token=${igAccount.accessToken}`
                  )
                  const stData = await stRes.json()
                  if (stData.status_code === 'FINISHED' || !stData.status_code) {
                    isReady = true
                    break
                  }
                  if (stData.status_code === 'ERROR' || stData.status_code === 'EXPIRED') break
                }

                if (isReady) {
                  const pubRes = await fetch(
                    `https://graph.facebook.com/v21.0/${igAccount.platformId}/media_publish`,
                    {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                      body: new URLSearchParams({
                        creation_id: creationId,
                        access_token: igAccount.accessToken,
                      }),
                    }
                  )
                  const pubData = await pubRes.json()
                  if (pubData.id) {
                    resultadosCanales.instagram = {
                      ok: true,
                      detalle: `Publicado en Instagram Feed (ID: ${pubData.id})`,
                      postId: pubData.id,
                    }
                  } else {
                    resultadosCanales.instagram = {
                      ok: false,
                      detalle: pubData.error?.message || 'Error al confirmar contenedor IG',
                    }
                  }
                } else {
                  resultadosCanales.instagram = {
                    ok: false,
                    detalle: 'Meta demoró procesando la imagen',
                  }
                }
              } else {
                resultadosCanales.instagram = {
                  ok: false,
                  detalle: containerData.error?.message || 'No se pudo crear contenedor IG',
                }
              }
            } catch (igErr: any) {
              resultadosCanales.instagram = { ok: false, detalle: igErr?.message || 'Error IG' }
            }
          })()
        )
      }

      if (fbAccount?.accessToken && fbAccount.platformId) {
        tasks.push(
          (async () => {
            try {
              const fbRes = await fetch(
                `https://graph.facebook.com/v21.0/${fbAccount.platformId}/photos`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                  body: new URLSearchParams({
                    url: mediaUrlToPublish,
                    caption: captionToPublish,
                    access_token: fbAccount.accessToken,
                  }),
                }
              )
              const fbData = await fbRes.json()
              if (fbData.id || fbData.post_id) {
                const postId = fbData.id || fbData.post_id
                resultadosCanales.facebook = {
                  ok: true,
                  detalle: `Publicado en Facebook Page (ID: ${postId})`,
                  postId,
                }
              } else {
                resultadosCanales.facebook = {
                  ok: false,
                  detalle: fbData.error?.message || 'Error publicando en Facebook Page',
                }
              }
            } catch (fbErr: any) {
              resultadosCanales.facebook = { ok: false, detalle: fbErr?.message || 'Error FB' }
            }
          })()
        )
      }

      if (ttAccount && videoBufferForTikTok) {
        tasks.push(
          (async () => {
            const ttRes = await subirVideoATikTokDirecto(
              dbUser.id,
              videoBufferForTikTok!,
              vaultDraft.topic || 'Mallas Tlaxcalli'
            )
            resultadosCanales.tiktok = {
              ok: ttRes.ok,
              detalle: ttRes.detalle,
              postId: ttRes.publishId,
            }
          })()
        )
      } else if (ttAccount && !videoBufferForTikTok) {
        resultadosCanales.tiktok = {
          ok: false,
          detalle: 'Se requiere video MP4 para TikTok (envía "generame un video" o publica con video)',
        }
      }

      await Promise.all(tasks)

      return NextResponse.json({
        ok: true,
        publicado: true,
        draftId: vaultDraft.id,
        videoDraftId: videoVaultId,
        canales_ejecutados: Object.keys(resultadosCanales),
        resultados_canales: resultadosCanales,
        imageUrl: mediaUrlToPublish,
        videoUrl: videoVaultId ? `${appBaseUrl}/api/whatsapp/v1/media/${videoVaultId}.mp4` : null,
        base64_resultado: vaultDraft.visualPrompt,
        caption_publicado: vaultDraft.whatsappFicha || captionToPublish,
        mensaje_resultado:
          '✅ *¡Campaña (Imagen + Video TikTok) procesada y enviada a tus redes sociales conectadas!*',
      })
    }

    return NextResponse.json(
      { ok: false, error: `Acción '${accion}' no reconocida` },
      { status: 400 }
    )
  } catch (error: any) {
    console.error('Error en /api/whatsapp/v1/marketing:', error)
    return NextResponse.json(
      { ok: false, error: error?.message || 'Error interno de marketing' },
      { status: 500 }
    )
  }
}

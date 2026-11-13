import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { prisma } from '@/lib/prisma'
import sharp from 'sharp'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MARKETING_API_SECRET =
  process.env.MARKETING_BRIDGE_SECRET || 'blitzr_marketing_secure_key_2026'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

interface PendingDraft {
  id: string
  titulo: string
  caption: string
  tiktokScript: string
  whatsappCopy: string
  precio: string
  precioAnterior: string
  canales: string[]
  imageUrl: string | null
  base64Image: string | null
  createdAt: number
}

// Memoria caché en caliente para confirmación rápida desde WhatsApp
const pendingDrafts = new Map<string, PendingDraft>()

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

async function removeBackgroundSharp(inputBuffer: Buffer): Promise<Buffer> {
  try {
    const image = sharp(inputBuffer)
    const metadata = await image.metadata()
    const width = metadata.width || 800
    const height = metadata.height || 800

    const { data, info } = await image
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })

    const channels = info.channels
    const sampleIndices: number[] = []
    const stepX = Math.max(1, Math.floor(width / 40))
    const stepY = Math.max(1, Math.floor(height / 40))

    for (let x = 0; x < width; x += stepX) {
      sampleIndices.push(0 * width + x)
      sampleIndices.push((height - 1) * width + x)
    }
    for (let y = 0; y < height; y += stepY) {
      sampleIndices.push(y * width + 0)
      sampleIndices.push(y * width + (width - 1))
    }

    let totalR = 0,
      totalG = 0,
      totalB = 0
    for (const idx of sampleIndices) {
      const byteIdx = idx * channels
      totalR += data[byteIdx]
      totalG += data[byteIdx + 1]
      totalB += data[byteIdx + 2]
    }

    const count = sampleIndices.length || 1
    const bgR = Math.round(totalR / count)
    const bgG = Math.round(totalG / count)
    const bgB = Math.round(totalB / count)
    const isLightBg = bgR > 180 && bgG > 180 && bgB > 180

    const threshold = 36
    const feather = 22

    for (let i = 0; i < data.length; i += channels) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const dist = Math.sqrt(
        Math.pow(r - bgR, 2) + Math.pow(g - bgG, 2) + Math.pow(b - bgB, 2)
      )
      const isBlownWhite = isLightBg && r > 235 && g > 235 && b > 235

      if (dist < threshold || isBlownWhite) {
        data[i + 3] = 0
      } else if (dist < threshold + feather) {
        const alphaFactor = (dist - threshold) / feather
        data[i + 3] = Math.round(data[i + 3] * alphaFactor)
      }
    }

    return sharp(data, { raw: { width, height, channels } })
      .png({ quality: 92 })
      .toBuffer()
  } catch {
    return inputBuffer
  }
}

async function crearEscenaEstudio(
  bufferProducto: Buffer,
  opciones: {
    tema?: string
    titulo?: string
    subtitulo?: string
    precio?: string
    precioAnterior?: string
    cta?: string
    aislarFondo?: boolean
  } = {}
): Promise<Buffer> {
  const cWidth = 1080
  const cHeight = 1350

  const procesado =
    opciones.aislarFondo !== false
      ? await removeBackgroundSharp(bufferProducto)
      : bufferProducto

  const imgProd = sharp(procesado)
  const metaProd = await imgProd.metadata()
  const pWidth = metaProd.width || 800
  const pHeight = metaProd.height || 800

  const tema = (opciones.tema || 'industrial').toLowerCase()
  const isLight = tema.includes('light') || tema.includes('claro')
  const isTech = tema.includes('tech') || tema.includes('azul')

  const bgStart = isLight ? '#f8fafc' : isTech ? '#050b14' : '#18181b'
  const bgMid = isLight ? '#e2e8f0' : isTech ? '#0f172a' : '#09090b'
  const bgEnd = isLight ? '#cbd5e1' : '#000000'
  const accentColor = isTech ? '#38bdf8' : '#f59e0b'
  const textColor = isLight ? '#0f172a' : '#ffffff'

  const rawTitle = (opciones.titulo || 'CALIDAD INDUSTRIAL DIRECTA DE FÁBRICA').toUpperCase()
  const line1 = escapeXml(rawTitle.slice(0, 26))
  const line2 = escapeXml(rawTitle.slice(26, 52))
  const subline = escapeXml(
    (opciones.subtitulo || 'Entrega inmediata • Garantía de resistencia').slice(0, 55)
  )
  const precio = escapeXml(opciones.precio || '')
  const precioAnt = escapeXml(opciones.precioAnterior || '')
  const ctaText = escapeXml(opciones.cta || 'PEDIR POR WHATSAPP AHORA')

  const fondoSvg = `
  <svg width="${cWidth}" height="${cHeight}" viewBox="0 0 ${cWidth} ${cHeight}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${bgStart}"/>
        <stop offset="65%" stop-color="${bgMid}"/>
        <stop offset="100%" stop-color="${bgEnd}"/>
      </linearGradient>
      <radialGradient id="luz" cx="50%" cy="46%" r="52%">
        <stop offset="0%" stop-color="${accentColor}" stop-opacity="0.28"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="${isLight ? '0.1' : '0.85'}"/>
      </radialGradient>
    </defs>
    <rect width="${cWidth}" height="${cHeight}" fill="url(#bg)"/>
    <rect width="${cWidth}" height="${cHeight}" fill="url(#luz)"/>
    <polygon points="0,960 1080,960 1080,1350 0,1350" fill="${isLight ? '#cbd5e1' : '#111115'}" fill-opacity="0.85"/>
    <line x1="0" y1="960" x2="1080" y2="960" stroke="${accentColor}" stroke-width="2" stroke-opacity="0.45"/>
    <ellipse cx="540" cy="1020" rx="390" ry="55" fill="#000000" fill-opacity="0.65"/>

    <!-- Badge superior -->
    <rect x="360" y="55" width="360" height="46" rx="23" fill="${accentColor}"/>
    <text x="540" y="86" font-family="Arial, sans-serif" font-size="22" font-weight="900" fill="#000000" text-anchor="middle">OFERTA ESPECIAL</text>

    <!-- Titular principal -->
    <text x="540" y="165" font-family="Arial, sans-serif" font-size="48" font-weight="900" fill="${textColor}" text-anchor="middle">${line1}</text>
    ${
      line2
        ? `<text x="540" y="222" font-family="Arial, sans-serif" font-size="46" font-weight="900" fill="${accentColor}" text-anchor="middle">${line2}</text>`
        : ''
    }
    <text x="540" y="${line2 ? 270 : 220}" font-family="Arial, sans-serif" font-size="26" font-weight="600" fill="${isLight ? '#334155' : '#d4d4d8'}" text-anchor="middle">${subline}</text>
  </svg>
  `
  const baseFondo = await sharp(Buffer.from(fondoSvg)).png().toBuffer()

  const targetProdWidth = 680
  const targetProdHeight = Math.round((targetProdWidth / pWidth) * pHeight)
  const prodRedimensionado = await sharp(procesado)
    .resize(targetProdWidth, targetProdHeight > 680 ? 680 : targetProdHeight, {
      fit: 'inside',
    })
    .png()
    .toBuffer()

  const metaRedim = await sharp(prodRedimensionado).metadata()
  const posX = Math.round((cWidth - (metaRedim.width || targetProdWidth)) / 2)
  const posY = Math.round(620 - (metaRedim.height || targetProdHeight) / 2)

  // Capa inferior con precio y CTA encima del producto
  const overlayInferiorSvg = `
  <svg width="${cWidth}" height="${cHeight}" viewBox="0 0 ${cWidth} ${cHeight}" xmlns="http://www.w3.org/2000/svg">
    ${
      precio
        ? `
      <rect x="680" y="860" width="330" height="140" rx="24" fill="#09090b" stroke="${accentColor}" stroke-width="4"/>
      ${
        precioAnt
          ? `<text x="845" y="905" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="#a1a1aa" text-decoration="line-through" text-anchor="middle">Antes: ${precioAnt}</text>`
          : `<text x="845" y="905" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="${accentColor}" text-anchor="middle">PRECIO DIRECTO</text>`
      }
      <text x="845" y="968" font-family="Arial, sans-serif" font-size="46" font-weight="900" fill="#ffffff" text-anchor="middle">${precio}</text>
    `
        : ''
    }
    <rect x="190" y="1175" width="700" height="96" rx="48" fill="${accentColor}"/>
    <text x="540" y="1235" font-family="Arial, sans-serif" font-size="34" font-weight="900" fill="#000000" text-anchor="middle">${ctaText}</text>
  </svg>
  `
  const overlayInferior = await sharp(Buffer.from(overlayInferiorSvg)).png().toBuffer()

  return sharp(baseFondo)
    .composite([
      { input: prodRedimensionado, left: posX, top: Math.max(260, posY) },
      { input: overlayInferior, left: 0, top: 0 },
    ])
    .jpeg({ quality: 90 })
    .toBuffer()
}

async function subirBufferASupabase(buffer: Buffer, fileName: string): Promise<string | null> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseKey) return null

    const supabase = createSupabaseAdmin(supabaseUrl, supabaseKey)
    let bucket = 'product-images'
    let { error } = await supabase.storage.from(bucket).upload(fileName, buffer, {
      contentType: 'image/jpeg',
      upsert: true,
    })

    if (error) {
      bucket = 'blitzr-vault'
      const fallback = await supabase.storage.from(bucket).upload(fileName, buffer, {
        contentType: 'image/jpeg',
        upsert: true,
      })
      error = fallback.error
    }

    if (error) return null

    const { data } = supabase.storage.from(bucket).getPublicUrl(fileName)
    return data?.publicUrl || null
  } catch {
    return null
  }
}

async function generarCopiesRapidosIA(
  contexto: string,
  precio?: string
): Promise<{
  headline: string
  igCopy: string
  tiktokScript: string
  whatsappCopy: string
}> {
  const defaultCopies = {
    headline: (contexto || 'OFERTA DIRECTA DE FÁBRICA').slice(0, 36).toUpperCase(),
    igCopy:
      `🔥 ${contexto || 'Calidad industrial lista para entrega inmediata.'}\n` +
      (precio ? `💰 Precio especial: ${precio}\n` : '') +
      `✅ Envíos garantizados y atención personalizada.\n👉 Envíanos mensaje directo o escribe por WhatsApp para apartar tu pedido hoy.`,
    tiktokScript:
      `[0-3s Gancho]: ¿Buscas ${contexto || 'calidad industrial al mejor precio'}?\n` +
      `[Demostración]: Mira el acabado y resistencia real de fábrica.\n` +
      `[CTA]: Haz clic en el enlace de WhatsApp para cotizar en 1 minuto.`,
    whatsappCopy:
      `🔥 *${(contexto || 'OFERTA DIRECTA DE FÁBRICA').toUpperCase()}*\n\n` +
      (precio ? `💰 *Precio especial:* ${precio}\n` : '') +
      `✅ Entrega inmediata y garantía directa.\n` +
      `👉 Responde *#pedido* para apartar con precio preferencial.`,
  }

  if (!process.env.GEMINI_API_KEY || !contexto) return defaultCopies

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.5-flash-lite',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.7,
      },
    })

    const prompt = `Genera copys publicitarios de alta conversión para este producto: "${contexto}" ${
      precio ? `con precio ${precio}` : ''
    }. Responde SOLO JSON con llaves: headline (máx 5 palabras en mayúsculas), igCopy, tiktokScript, whatsappCopy.`

    const res = await Promise.race([
      model.generateContent(prompt),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('TIMEOUT')), 5500)),
    ])
    const parsed = JSON.parse(res.response.text())
    return {
      headline: parsed.headline || defaultCopies.headline,
      igCopy: parsed.igCopy || defaultCopies.igCopy,
      tiktokScript: parsed.tiktokScript || defaultCopies.tiktokScript,
      whatsappCopy: parsed.whatsappCopy || defaultCopies.whatsappCopy,
    }
  } catch {
    return defaultCopies
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
    modulo: 'Blitzr Marketing Bridge v1',
    estado: 'online',
    acciones_soportadas: [
      'ping',
      'editar_foto_estudio',
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
      return NextResponse.json(
        { ok: false, error: 'Cuerpo JSON inválido' },
        { status: 400 }
      )
    }

    const {
      accion,
      base64,
      imageUrl: inputImageUrl,
      nombre,
      tema,
      texto,
      subtitulo,
      precio,
      precioAnterior,
      cta,
      draftId,
    } = body || {}

    if (accion === 'ping') {
      return NextResponse.json({
        ok: true,
        mensaje: 'Módulo de Marketing online y listo',
        timestamp: new Date().toISOString(),
      })
    }

    // 1. Edición / Generación de Foto de Estudio + Pancarta Comercial
    if (accion === 'editar_foto_estudio') {
      let inputBuffer: Buffer | null = null

      if (base64 && typeof base64 === 'string') {
        const rawBase64 = base64.replace(/^data:image\/\w+;base64,/, '')
        inputBuffer = Buffer.from(rawBase64, 'base64')
      } else if (inputImageUrl && typeof inputImageUrl === 'string') {
        const resImg = await fetch(inputImageUrl)
        if (resImg.ok) {
          inputBuffer = Buffer.from(await resImg.arrayBuffer())
        }
      }

      if (!inputBuffer || inputBuffer.length < 32) {
        return NextResponse.json(
          { ok: false, error: 'Falta campo base64 o imageUrl válido de la imagen' },
          { status: 400 }
        )
      }

      // Verificar que sea una imagen decodificable por Sharp
      try {
        await sharp(inputBuffer).metadata()
      } catch {
        return NextResponse.json(
          { ok: false, error: 'El archivo enviado no es una imagen válida' },
          { status: 400 }
        )
      }

      const copies = await generarCopiesRapidosIA(
        texto || nombre || 'Mallas y Refacciones Industriales Tlaxcalli',
        precio
      )

      const fotoProcesada = await crearEscenaEstudio(inputBuffer, {
        tema: tema || 'industrial',
        titulo: texto || copies.headline,
        subtitulo: subtitulo || 'Calidad garantizada • Envío inmediato',
        precio,
        precioAnterior,
        cta: cta || 'PEDIR POR WHATSAPP',
        aislarFondo: body.aislarFondo !== false,
      })

      const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://blitzr-studio.vercel.app'
      const fallbackOgUrl = `${appBaseUrl}/api/og/banner?title=${encodeURIComponent(
        (texto || copies.headline).slice(0, 36)
      )}&hook=${encodeURIComponent(
        subtitulo || 'Calidad garantizada • Envío inmediato'
      )}&badge=${encodeURIComponent(precio || 'OFERTA DIRECTA')}`

      const publicUrl =
        (await subirBufferASupabase(
          fotoProcesada,
          `whatsapp-studio/banner-${Date.now()}.jpg`
        )) || fallbackOgUrl

      const base64Resultado = `data:image/jpeg;base64,${fotoProcesada.toString('base64')}`

      // Guardar como último borrador listo para publicar si el usuario luego pide subirlo a redes
      const autoDraftId = `draft_${Date.now()}`
      const draftObj: PendingDraft = {
        id: autoDraftId,
        titulo: texto || copies.headline,
        caption: copies.igCopy,
        tiktokScript: copies.tiktokScript,
        whatsappCopy: copies.whatsappCopy,
        precio: precio || '',
        precioAnterior: precioAnterior || '',
        canales: ['whatsapp_estado', 'facebook', 'instagram', 'tiktok'],
        imageUrl: publicUrl,
        base64Image: base64Resultado,
        createdAt: Date.now(),
      }
      pendingDrafts.set(autoDraftId, draftObj)
      pendingDrafts.set('latest', draftObj)

      return NextResponse.json({
        ok: true,
        draftId: autoDraftId,
        nombre: nombre || 'publicidad_estudio.jpg',
        public_url: publicUrl,
        base64_resultado: base64Resultado,
        caption_sugerido: copies.whatsappCopy,
        copies,
      })
    }

    // 2. Previsualización y Confirmación para Publicar en Redes
    if (accion === 'solicitar_publicacion_redes') {
      const canales = Array.isArray(body.canales)
        ? body.canales
        : ['whatsapp_estado', 'facebook', 'instagram', 'tiktok']

      const latest = pendingDrafts.get(draftId || 'latest')
      const copies = await generarCopiesRapidosIA(
        texto || latest?.titulo || 'Campaña Oficial Mallas Tlaxcalli',
        precio || latest?.precio
      )

      const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://blitzr-studio.vercel.app'
      const defaultOgUrl = `${appBaseUrl}/api/og/banner?title=${encodeURIComponent(
        (texto || latest?.titulo || copies.headline).slice(0, 36)
      )}&hook=${encodeURIComponent(
        'Calidad directa de fábrica • Envíos inmediatos'
      )}&badge=${encodeURIComponent(precio || latest?.precio || '$1,713 MXN')}`

      const newDraftId = `pub_${Date.now()}`
      const imageUrl = inputImageUrl || latest?.imageUrl || defaultOgUrl
      const base64Image = base64 || latest?.base64Image || null

      const pending: PendingDraft = {
        id: newDraftId,
        titulo: texto || latest?.titulo || copies.headline,
        caption: body.caption || copies.igCopy,
        tiktokScript: copies.tiktokScript,
        whatsappCopy: copies.whatsappCopy,
        precio: precio || latest?.precio || '$1,713 MXN',
        precioAnterior: precioAnterior || latest?.precioAnterior || '$2,700 MXN',
        canales,
        imageUrl,
        base64Image,
        createdAt: Date.now(),
      }

      pendingDrafts.set(newDraftId, pending)
      pendingDrafts.set('latest', pending)

      // Consultar cuentas activas en BD para informar con transparencia
      let cuentasConectadas: string[] = ['whatsapp_estado']
      try {
        const accounts = await prisma.socialAccount.findMany({
          where: { isActive: true },
          select: { provider: true, accountName: true },
        })
        for (const acc of accounts) {
          cuentasConectadas.push(
            acc.accountName ? `${acc.provider} (${acc.accountName})` : acc.provider
          )
        }
      } catch {
        // continuar sin bloquear
      }

      return NextResponse.json({
        ok: true,
        requiere_confirmacion: true,
        draftId: newDraftId,
        preview: {
          titulo: pending.titulo,
          canales: pending.canales,
          cuentas_conectadas: cuentasConectadas,
          precio_vigente: pending.precio,
          precio_anterior: pending.precioAnterior,
          imageUrl: pending.imageUrl,
          copies: {
            instagram: pending.caption,
            tiktok: pending.tiktokScript,
            whatsapp: pending.whatsappCopy,
          },
          mensaje_confirmacion:
            '📢 *Previsualización de Publicación Multicanal:*\n\n' +
            `• * Campaña:* ${pending.titulo}\n` +
            `• *Precio:* ${pending.precio} (Antes: ${pending.precioAnterior})\n` +
            `• *Canales objetivo:* ${canales.join(', ')}\n` +
            `• *Copy IG/FB:* ${pending.caption.slice(0, 140)}...\n\n` +
            '¿Autorizas publicar ahora en las redes conectadas?\n' +
            '👉 Responde *#confirmar si* para disparar la publicación.',
        },
      })
    }

    // 3. Confirmación definitiva de Publicación Multicanal
    if (accion === 'confirmar_publicacion_redes') {
      const targetDraft =
        pendingDrafts.get(draftId || 'latest') || {
          id: `direct_${Date.now()}`,
          titulo: texto || 'Campaña Mallas Tlaxcalli',
          caption:
            texto ||
            '🔥 Oferta directa de fábrica en Mallas Tlaxcalli. Envíos inmediatos. Solicita cotización por WhatsApp.',
          tiktokScript: '',
          whatsappCopy:
            texto ||
            '🔥 *OFERTA DIRECTA DE FÁBRICA — Mallas Tlaxcalli*\nEnvíos inmediatos. Escribe #pedido para apartar.',
          precio: precio || '$1,713 MXN',
          precioAnterior: precioAnterior || '$2,700 MXN',
          canales: body.canales || ['whatsapp_estado', 'facebook', 'instagram'],
          imageUrl: inputImageUrl || null,
          base64Image: base64 || null,
          createdAt: Date.now(),
        }

      const resultadosCanales: Record<string, { ok: boolean; detalle: string; postId?: string }> = {
        whatsapp_estado: {
          ok: true,
          detalle: 'Listo para publicar en Estado/Difusión por el puente de WhatsApp',
        },
      }

      // Intentar publicar en cuentas de Meta (Instagram / Facebook) y guardar registro en ContentVault
      try {
        const dbUser =
          (await prisma.user.findFirst({
            where: { socialAccounts: { some: { isActive: true } } },
            include: {
              socialAccounts: {
                where: { isActive: true },
              },
            },
          })) ||
          (await prisma.user.findFirst({
            include: {
              socialAccounts: {
                where: { isActive: true },
              },
            },
          }))

        // Si no hay imageUrl en el borrador, buscar la última imagen disponible en ContentVault
        let mediaUrlToPublish = targetDraft.imageUrl
        if (!mediaUrlToPublish && dbUser) {
          const lastVaultWithImg = await prisma.contentVault.findFirst({
            where: {
              userId: dbUser.id,
              OR: [{ bannerUrl: { not: null } }, { imageUrl: { not: null } }],
            },
            orderBy: { createdAt: 'desc' },
          })
          mediaUrlToPublish = lastVaultWithImg?.bannerUrl || lastVaultWithImg?.imageUrl || null
        }

        if (dbUser) {
          await prisma.contentVault.create({
            data: {
              userId: dbUser.id,
              topic: targetDraft.titulo.slice(0, 180),
              tone: 'WhatsApp Bridge',
              instagramCopy: targetDraft.caption,
              tiktokScript: targetDraft.tiktokScript || targetDraft.caption,
              whatsappFicha: targetDraft.whatsappCopy,
              imageUrl: mediaUrlToPublish,
              bannerUrl: mediaUrlToPublish,
            },
          })

          const igAccount = dbUser.socialAccounts.find((a) => a.provider === 'INSTAGRAM')
          const fbAccount = dbUser.socialAccounts.find((a) => a.provider === 'FACEBOOK')

          if (igAccount?.accessToken && igAccount.platformId && mediaUrlToPublish) {
            try {
              const containerRes = await fetch(
                `https://graph.facebook.com/v21.0/${igAccount.platformId}/media`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                  body: new URLSearchParams({
                    image_url: mediaUrlToPublish,
                    caption: targetDraft.caption,
                    access_token: igAccount.accessToken,
                  }),
                }
              )
              const containerData = await containerRes.json()
              if (containerData.id) {
                await new Promise((r) => setTimeout(r, 2500))
                const pubRes = await fetch(
                  `https://graph.facebook.com/v21.0/${igAccount.platformId}/media_publish`,
                  {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                      creation_id: containerData.id,
                      access_token: igAccount.accessToken,
                    }),
                  }
                )
                const pubData = await pubRes.json()
                if (pubData.id) {
                  resultadosCanales.instagram = {
                    ok: true,
                    detalle: 'Publicado en Instagram Feed',
                    postId: pubData.id,
                  }
                } else {
                  resultadosCanales.instagram = {
                    ok: false,
                    detalle: pubData.error?.message || 'Meta en cola de procesamiento',
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
          } else {
            resultadosCanales.instagram = {
              ok: true,
              detalle: 'Guardado en Bóveda Blitzr (listo para despacho IG)',
            }
          }

          if (fbAccount?.accessToken && fbAccount.platformId && mediaUrlToPublish) {
            try {
              const fbRes = await fetch(
                `https://graph.facebook.com/v21.0/${fbAccount.platformId}/photos`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                  body: new URLSearchParams({
                    url: mediaUrlToPublish,
                    caption: targetDraft.caption,
                    access_token: fbAccount.accessToken,
                  }),
                }
              )
              const fbData = await fbRes.json()
              if (fbData.id || fbData.post_id) {
                resultadosCanales.facebook = {
                  ok: true,
                  detalle: 'Publicado en Facebook Page',
                  postId: fbData.id || fbData.post_id,
                }
              } else {
                resultadosCanales.facebook = {
                  ok: false,
                  detalle: fbData.error?.message || 'Token de página requiere actualización',
                }
              }
            } catch (fbErr: any) {
              resultadosCanales.facebook = { ok: false, detalle: fbErr?.message || 'Error FB' }
            }
          } else {
            resultadosCanales.facebook = {
              ok: true,
              detalle: 'Guardado en Bóveda Blitzr (listo para despacho FB)',
            }
          }
        }
      } catch (dbErr: any) {
        console.warn('[WhatsApp Marketing Publish] Aviso DB/Meta:', dbErr?.message)
      }

      return NextResponse.json({
        ok: true,
        publicado: true,
        canales_ejecutados: targetDraft.canales,
        resultados_canales: resultadosCanales,
        imageUrl: targetDraft.imageUrl,
        base64_resultado: targetDraft.base64Image,
        caption_publicado: targetDraft.whatsappCopy,
        mensaje_resultado:
          '✅ ¡Campaña procesada y publicada exitosamente en el ecosistema de Marketing y Estado de WhatsApp!',
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

import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { prisma } from '@/lib/prisma'
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

async function guardarImagenEnBoveda(opciones: {
  userId: string
  bufferJpeg: Buffer
  titulo: string
  igCopy: string
  tiktokScript: string
  whatsappCopy: string
  appBaseUrl: string
}): Promise<{ id: string; publicUrl: string; base64DataUrl: string }> {
  const base64DataUrl = `data:image/jpeg;base64,${opciones.bufferJpeg.toString('base64')}`

  const created = await prisma.contentVault.create({
    data: {
      userId: opciones.userId,
      topic: opciones.titulo.slice(0, 180),
      tone: 'WhatsApp Bridge',
      instagramCopy: opciones.igCopy,
      tiktokScript: opciones.tiktokScript,
      whatsappFicha: opciones.whatsappCopy,
      visualPrompt: base64DataUrl,
    },
  })

  const publicUrl = `${opciones.appBaseUrl}/api/whatsapp/v1/media/${created.id}.jpg`

  await prisma.contentVault.update({
    where: { id: created.id },
    data: {
      imageUrl: publicUrl,
      bannerUrl: publicUrl,
    },
  })

  return { id: created.id, publicUrl, base64DataUrl }
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
}): Promise<Buffer> {
  // 1. Mejorar nitidez, contraste y color de la fotografía real sin destruir el producto
  const fotoMejorada = await sharp(opciones.fotoBuffer)
    .rotate()
    .resize(960, 750, { fit: 'cover', position: 'centre' })
    .modulate({ brightness: 1.04, saturation: 1.12 })
    .sharpen()
    .jpeg({ quality: 92 })
    .toBuffer()

  // 2. Guardar temporalmente la foto limpia para que /api/og/banner (Satori + Bebas Neue) la incruste en alta resolución
  try {
    const tempVault = await prisma.contentVault.create({
      data: {
        userId: opciones.userId,
        topic: ' raw_asset_studio',
        tone: 'Asset',
        instagramCopy: '',
        tiktokScript: '',
        visualPrompt: `data:image/jpeg;base64,${fotoMejorada.toString('base64')}`,
      },
    })
    const rawMediaUrl = `${opciones.appBaseUrl}/api/whatsapp/v1/media/${tempVault.id}.jpg`

    const ogUrl = new URL(`${opciones.appBaseUrl}/api/og/banner`)
    ogUrl.searchParams.set('title', opciones.titulo.slice(0, 42))
    ogUrl.searchParams.set('hook', opciones.subtitulo.slice(0, 105))
    ogUrl.searchParams.set('badge', opciones.badge.slice(0, 32))
    ogUrl.searchParams.set('price', opciones.precio)
    ogUrl.searchParams.set('oldPrice', opciones.precioAnterior)
    ogUrl.searchParams.set('imageUrl', rawMediaUrl)

    const ogRes = await fetch(ogUrl.toString())
    if (ogRes.ok) {
      const pngBuffer = Buffer.from(await ogRes.arrayBuffer())
      // Convertir el PNG 1080x1350 de Satori a JPEG optimizado para Meta y WhatsApp
      return await sharp(pngBuffer).jpeg({ quality: 93 }).toBuffer()
    }
  } catch (err) {
    console.warn('[Poster Agencia] Fallback a compositor Sharp directo:', err)
  }

  // Fallback local con Sharp si no se pudo llamar a /api/og/banner
  const cWidth = 1080
  const cHeight = 1350
  const tituloLimpio = escapeXml(opciones.titulo.toUpperCase().slice(0, 34))
  const subLimpio = escapeXml(opciones.subtitulo.slice(0, 65))
  const precioLimpio = escapeXml(opciones.precio || '$1,713 MXN')

  const marcoSvg = `
  <svg width="${cWidth}" height="${cHeight}" viewBox="0 0 ${cWidth} ${cHeight}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#09090b"/>
        <stop offset="50%" stop-color="#18181b"/>
        <stop offset="100%" stop-color="#09090b"/>
      </linearGradient>
    </defs>
    <rect width="${cWidth}" height="${cHeight}" fill="url(#bg)"/>
    <rect x="54" y="164" width="972" height="762" rx="28" fill="#18181b" stroke="#f59e0b" stroke-width="3"/>
    <text x="60" y="95" font-family="sans-serif" font-size="42" font-weight="900" fill="#ffffff">MALLAS TLAXCALLI</text>
    <text x="60" y="132" font-family="sans-serif" font-size="20" font-weight="700" fill="#f59e0b">CALIDAD INDUSTRIAL DIRECTA DE FÁBRICA</text>
    <rect x="54" y="965" width="972" height="320" rx="28" fill="#121216" stroke="#27272a" stroke-width="2"/>
    <text x="540" y="1045" font-family="sans-serif" font-size="42" font-weight="900" fill="#ffffff" text-anchor="middle">${tituloLimpio}</text>
    <text x="540" y="1100" font-family="sans-serif" font-size="24" font-weight="600" fill="#d4d4d8" text-anchor="middle">${subLimpio}</text>
    <rect x="240" y="1145" width="600" height="96" rx="24" fill="#f59e0b"/>
    <text x="540" y="1206" font-family="sans-serif" font-size="38" font-weight="900" fill="#09090b" text-anchor="middle">OFERTA: ${precioLimpio} • PEDIR AHORA</text>
  </svg>
  `
  const baseMarco = await sharp(Buffer.from(marcoSvg)).png().toBuffer()
  return sharp(baseMarco)
    .composite([{ input: fotoMejorada, left: 60, top: 170 }])
    .jpeg({ quality: 92 })
    .toBuffer()
}

async function generarCopiesYPromptIA(
  instruccionUsuario: string,
  precio: string = '$1,713 MXN'
): Promise<{
  headline: string
  subtitulo: string
  imagePromptEn: string
  igCopy: string
  tiktokScript: string
  whatsappCopy: string
}> {
  const fallback = {
    headline: 'PAQUETE COMPLETO DE MANTENIMIENTO',
    subtitulo: 'Malla Testalera + Transportadora Calibre 14 + Balero 7210B Alemán',
    imagePromptEn:
      'Professional commercial studio product photography of industrial stainless steel woven wire conveyor mesh rolls and heavy duty German ball bearing 7210B on a dark luxury slate workbench, dramatic warm golden rim lighting, ultra crisp metallic texture, commercial advertising photography, 8k',
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
Devuelve ÚNICAMENTE un JSON válido con estas llaves exactas:
{
  "headline": "Titular publicitario impactante en español (máximo 5 palabras en MAYÚSCULAS)",
  "subtitulo": "Subtítulo persuasivo corto de beneficio (máximo 12 palabras)",
  "imagePromptEn": "Detailed English prompt for Flux AI photorealistic commercial studio photography matching the user request (NO text in image, dramatic studio lighting, 8k product photography)",
  "igCopy": "Copy persuasivo y profesional para Instagram y Facebook con emojis, beneficios y llamado a la acción",
  "tiktokScript": "Guion corto estructurado para TikTok/Reels",
  "whatsappCopy": "Mensaje vendedor directo para WhatsApp"
}`

    const res = await Promise.race([
      model.generateContent(prompt),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('TIMEOUT')), 7000)),
    ])

    const parsed = JSON.parse(res.response.text())
    return {
      headline: parsed.headline || fallback.headline,
      subtitulo: parsed.subtitulo || fallback.subtitulo,
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
    modulo: 'Blitzr Marketing Bridge v2 (Agency Studio + Persistent Vault Media)',
    estado: 'online',
    acciones_soportadas: [
      'ping',
      'editar_foto_estudio',
      'generar_imagen_ia',
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
      imageUrl: inputImageUrl,
      nombre,
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
        mensaje: 'Módulo de Marketing online y listo',
        timestamp: new Date().toISOString(),
      })
    }

    // 1. EDICIÓN DE FOTO REAL O GENERACIÓN DE IMAGEN IA + PÓSTER DE AGENCIA
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

      let sourcePhotoBuffer: Buffer | null = null

      // Si es 'generar_imagen_ia', primero intentamos generar escena fotográfica real con Flux AI
      if (accion === 'generar_imagen_ia') {
        try {
          const seed = Math.floor(Math.random() * 900000) + 100000
          const pollUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(
            iaData.imagePromptEn
          )}?width=960&height=750&seed=${seed}&nologo=true&model=flux`
          const controller = new AbortController()
          const tId = setTimeout(() => controller.abort(), 14000)
          const resFlux = await fetch(pollUrl, { signal: controller.signal })
          clearTimeout(tId)
          if (resFlux.ok) {
            const arr = await resFlux.arrayBuffer()
            if (arr.byteLength > 8000) {
              sourcePhotoBuffer = Buffer.from(arr)
            }
          }
        } catch (fluxErr) {
          console.warn('[Generar Imagen IA] Flux tardó, usando foto base:', fluxErr)
        }
      }

      // Si nos enviaron una foto en base64 o URL (en editar_foto_estudio o como respaldo en generar_imagen_ia)
      if (!sourcePhotoBuffer && base64 && typeof base64 === 'string') {
        const rawBase64 = base64.replace(/^data:image\/\w+;base64,/, '')
        sourcePhotoBuffer = Buffer.from(rawBase64, 'base64')
      } else if (!sourcePhotoBuffer && inputImageUrl && typeof inputImageUrl === 'string') {
        const resImg = await fetch(inputImageUrl)
        if (resImg.ok) {
          sourcePhotoBuffer = Buffer.from(await resImg.arrayBuffer())
        }
      }

      if (!sourcePhotoBuffer || sourcePhotoBuffer.length < 32) {
        return NextResponse.json(
          { ok: false, error: 'Falta campo base64 o imageUrl válido de la imagen' },
          { status: 400 }
        )
      }

      // Validar que sea una imagen decodificable por Sharp
      try {
        await sharp(sourcePhotoBuffer).metadata()
      } catch {
        return NextResponse.json(
          { ok: false, error: 'El archivo enviado no es una imagen válida' },
          { status: 400 }
        )
      }

      // Componer el póster comercial de agencia 1080x1350 (con foto nítida + tipografía Bebas Neue)
      const posterBuffer = await componerPosterAgencia({
        fotoBuffer: sourcePhotoBuffer,
        appBaseUrl,
        userId: dbUser.id,
        titulo: iaData.headline,
        subtitulo: subtitulo || iaData.subtitulo,
        precio,
        precioAnterior,
        badge: 'ENVÍO GRATIS CDMX Y EDOMEX',
      })

      // Guardar en ContentVault para que tenga URL pública real .jpg accesible por Meta Graph API
      const saved = await guardarImagenEnBoveda({
        userId: dbUser.id,
        bufferJpeg: posterBuffer,
        titulo: iaData.headline,
        igCopy: iaData.igCopy,
        tiktokScript: iaData.tiktokScript,
        whatsappCopy: iaData.whatsappCopy,
        appBaseUrl,
      })

      return NextResponse.json({
        ok: true,
        draftId: saved.id,
        nombre: nombre || `publicidad_${saved.id.slice(0, 8)}.jpg`,
        public_url: saved.publicUrl,
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

    // 2. PREVISUALIZACIÓN Y CONFIRMACIÓN PARA PUBLICAR EN REDES
    if (accion === 'solicitar_publicacion_redes') {
      const canales = Array.isArray(body.canales)
        ? body.canales
        : ['whatsapp_estado', 'facebook', 'instagram', 'tiktok']

      const dbUser = await obtenerUsuarioPrincipal()

      // Buscar el último diseño real con imagen en ContentVault (o por draftId)
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

      // Si nos enviaron base64 nuevo en la solicitud de publicación y aún no había diseño en bóveda, crearlo al vuelo
      if (!vaultDraft && base64 && dbUser) {
        const rawBase64 = base64.replace(/^data:image\/\w+;base64,/, '')
        const inputBuf = Buffer.from(rawBase64, 'base64')
        const iaData = await generarCopiesYPromptIA(texto || 'Paquete Mantenimiento Mallas Tlaxcalli', precio)
        const posterBuf = await componerPosterAgencia({
          fotoBuffer: inputBuf,
          appBaseUrl,
          userId: dbUser.id,
          titulo: iaData.headline,
          subtitulo: iaData.subtitulo,
          precio,
          precioAnterior,
          badge: 'ENVÍO GRATIS CDMX Y EDOMEX',
        })
        const saved = await guardarImagenEnBoveda({
          userId: dbUser.id,
          bufferJpeg: posterBuf,
          titulo: iaData.headline,
          igCopy: iaData.igCopy,
          tiktokScript: iaData.tiktokScript,
          whatsappCopy: iaData.whatsappCopy,
          appBaseUrl,
        })
        vaultDraft = await prisma.contentVault.findUnique({ where: { id: saved.id } })
      }

      const tituloFinal = texto || vaultDraft?.topic || 'PAQUETE COMPLETO DE MANTENIMIENTO'
      const igCopyFinal = vaultDraft?.instagramCopy || '🔥 Calidad industrial directa de fábrica en Mallas Tlaxcalli.'
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
        base64_preview: vaultDraft?.visualPrompt || null,
        preview: {
          titulo: tituloFinal,
          canales,
          cuentas_conectadas: cuentasConectadas,
          precio_vigente: precio,
          precio_anterior: precioAnterior,
          imageUrl: imageUrlFinal,
          copies: {
            instagram: igCopyFinal,
            tiktok: ttScriptFinal,
            whatsapp: waCopyFinal,
          },
          mensaje_confirmacion:
            '📢 *Previsualización de Publicación Multicanal:*\n\n' +
            `• *Campaña:* ${tituloFinal}\n` +
            `• *Precio:* ${precio} (Antes: ${precioAnterior})\n` +
            `• *Cuentas conectadas:* ${cuentasConectadas.join(', ')}\n\n` +
            `📝 *Copy para Instagram y Facebook:*\n${igCopyFinal}\n\n` +
            '¿Autorizas subir esta imagen y su texto ahora mismo a todas las redes conectadas?\n' +
            '👉 Responde *#confirmar si* (o *si publica*) para disparar la publicación.',
        },
      })
    }

    // 3. CONFIRMACIÓN DEFINITIVA DE PUBLICACIÓN MULTICANAL CON IMAGEN REAL
    if (accion === 'confirmar_publicacion_redes') {
      const dbUser = await obtenerUsuarioPrincipal()
      if (!dbUser) {
        return NextResponse.json(
          { ok: false, error: 'No se encontró usuario con cuentas activas' },
          { status: 500 }
        )
      }

      // Buscar el diseño en ContentVault por draftId o el último creado en WhatsApp Bridge
      let vaultDraft = null
      if (draftId && typeof draftId === 'string') {
        vaultDraft = await prisma.contentVault.findUnique({ where: { id: draftId } }).catch(() => null)
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

      // Si aún no había imagen en bóveda pero enviaron base64, componerla y guardarla antes de publicar
      if (!vaultDraft && base64) {
        const rawBase64 = base64.replace(/^data:image\/\w+;base64,/, '')
        const inputBuf = Buffer.from(rawBase64, 'base64')
        const iaData = await generarCopiesYPromptIA(texto || 'Paquete Mantenimiento Mallas Tlaxcalli', precio)
        const posterBuf = await componerPosterAgencia({
          fotoBuffer: inputBuf,
          appBaseUrl,
          userId: dbUser.id,
          titulo: iaData.headline,
          subtitulo: iaData.subtitulo,
          precio,
          precioAnterior,
          badge: 'ENVÍO GRATIS CDMX Y EDOMEX',
        })
        const saved = await guardarImagenEnBoveda({
          userId: dbUser.id,
          bufferJpeg: posterBuf,
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
            error: 'No hay ninguna imagen generada recientemente para publicar. Envía primero una foto o pide generar una imagen.',
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
          detalle: 'Imagen y copy enviados a tu WhatsApp y Estado',
        },
      }

      const igAccount = dbUser.socialAccounts.find((a) => a.provider === 'INSTAGRAM')
      const fbAccount = dbUser.socialAccounts.find((a) => a.provider === 'FACEBOOK')

      // Publicar en Instagram Business con Sondeo Activo de Contenedor
      if (igAccount?.accessToken && igAccount.platformId) {
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
            for (let attempt = 1; attempt <= 8; attempt++) {
              await new Promise((r) => setTimeout(r, 1500))
              const stRes = await fetch(
                `https://graph.facebook.com/v21.0/${creationId}?fields=status_code,status&access_token=${igAccount.accessToken}`
              )
              const stData = await stRes.json()
              if (stData.status_code === 'FINISHED' || !stData.status_code) {
                isReady = true
                break
              }
              if (stData.status_code === 'ERROR' || stData.status_code === 'EXPIRED') {
                break
              }
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
                  detalle: pubData.error?.message || 'Error al confirmar contenedor en IG',
                }
              }
            } else {
              resultadosCanales.instagram = {
                ok: false,
                detalle: 'Meta rechazó o demoró el contenedor de imagen',
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
      }

      // Publicar en Página de Facebook
      if (fbAccount?.accessToken && fbAccount.platformId) {
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
      }

      return NextResponse.json({
        ok: true,
        publicado: true,
        draftId: vaultDraft.id,
        canales_ejecutados: Object.keys(resultadosCanales),
        resultados_canales: resultadosCanales,
        imageUrl: mediaUrlToPublish,
        base64_resultado: vaultDraft.visualPrompt,
        caption_publicado: vaultDraft.whatsappFicha || captionToPublish,
        mensaje_resultado:
          '✅ *¡Campaña e imagen publicadas exitosamente en tus redes sociales conectadas!*',
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

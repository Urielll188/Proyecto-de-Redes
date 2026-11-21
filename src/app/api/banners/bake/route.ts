import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import sharp, { type OverlayOptions } from 'sharp'

export const dynamic = 'force-dynamic'

function escapeXml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function wrapText(text: string, maxChars: number = 22): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ''

  for (const w of words) {
    if ((current + ' ' + w).trim().length <= maxChars) {
      current = (current + ' ' + w).trim()
    } else {
      if (current) lines.push(current)
      current = w
    }
  }
  if (current) lines.push(current)
  return lines.slice(0, 3)
}

export async function POST(request: NextRequest) {
  try {
    // 1. Validar sesión con Supabase Auth
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'No autorizado: Inicia sesión para continuar' },
        { status: 401 }
      )
    }

    const dbUser = await prisma.user.findUnique({
      where: { supabaseAuthId: user.id },
      select: { id: true },
    })

    if (!dbUser) {
      return NextResponse.json(
        { success: false, error: 'Usuario no registrado en la base de datos' },
        { status: 401 }
      )
    }

    // 2. Extraer datos del body
    let body: any = {}
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, error: 'Cuerpo de la petición inválido. Se espera JSON.' },
        { status: 400 }
      )
    }

    const {
      publicationId,
      sceneUrl,
      productImageUrl,
      headline = 'OFERTA EXCLUSIVA',
      subline = 'Disponible por tiempo limitado en nuestra tienda.',
      ctaText = 'Pedir por WhatsApp',
      badgeText = 'NUEVO LANZAMIENTO',
      styleTheme = 'minimal-dark',
      finalBannerUrl: clientFinalBannerUrl,
    } = body || {}

    // Si el banner ya fue rasterizado y subido directamente por el cliente con html2canvas
    if (clientFinalBannerUrl) {
      if (publicationId && typeof publicationId === 'string') {
        try {
          await prisma.contentVault.updateMany({
            where: { id: publicationId, userId: dbUser.id },
            data: { bannerUrl: clientFinalBannerUrl },
          })
        } catch (dbErr) {
          console.warn('No se pudo actualizar bannerUrl en Prisma:', dbErr)
        }
      }

      return NextResponse.json({
        success: true,
        finalBannerUrl: clientFinalBannerUrl,
      })
    }

    if (!sceneUrl) {
      return NextResponse.json(
        { success: false, error: 'Parámetro "sceneUrl" es requerido.' },
        { status: 400 }
      )
    }

    // 3. Descargar y preparar la escena base (1080 x 1350 píxeles, ratio 4:5)
    let baseSceneBuffer: Buffer
    try {
      const sceneRes = await fetch(sceneUrl)
      if (!sceneRes.ok) throw new Error(`HTTP ${sceneRes.status}`)
      const arrayBuf = await sceneRes.arrayBuffer()
      baseSceneBuffer = await sharp(Buffer.from(arrayBuf))
        .resize(1080, 1350, { fit: 'cover' })
        .png()
        .toBuffer()
    } catch (fetchErr) {
      console.warn('No se pudo descargar sceneUrl, creando escena base procedural:', fetchErr)
      baseSceneBuffer = await sharp({
        create: {
          width: 1080,
          height: 1350,
          channels: 4,
          background: { r: 18, g: 18, b: 24, alpha: 1 },
        },
      })
        .png()
        .toBuffer()
    }

    const composites: OverlayOptions[] = []

    // 4. Procesar imagen de producto si se especificó y es distinta a la escena
    if (
      productImageUrl &&
      typeof productImageUrl === 'string' &&
      productImageUrl !== sceneUrl &&
      !productImageUrl.includes('studio-scenes')
    ) {
      try {
        const prodRes = await fetch(productImageUrl)
        if (prodRes.ok) {
          const prodBuf = Buffer.from(await prodRes.arrayBuffer())
          const resizedProd = await sharp(prodBuf)
            .resize(650, 650, { fit: 'inside' })
            .png()
            .toBuffer()

          const prodMetadata = await sharp(resizedProd).metadata()
          const pWidth = prodMetadata.width || 500
          const pHeight = prodMetadata.height || 500

          // Amputar el 12% inferior para eliminar residuo del plato/mesa original (guillotina)
          const croppedHeight = Math.max(10, Math.round(pHeight * 0.88))
          const croppedProd = await sharp(resizedProd)
            .extract({ left: 0, top: 0, width: pWidth, height: croppedHeight })
            .png()
            .toBuffer()

          const left = Math.round((1080 - pWidth) / 2)
          // Calibración para asentar la base guillotinada sobre la superficie plana
          const top = Math.round(820 - croppedHeight / 2)

          composites.push({
            input: croppedProd,
            top,
            left,
          })
        }
      } catch (prodErr) {
        console.warn('Error al superponer imagen de producto:', prodErr)
      }
    }

    // 5. Configurar paletas y estilos para el SVG de alta resolución (1080x1350)
    let badgeBg = '#3f3f46'
    let badgeTextColor = '#ffffff'
    let headlineColor = '#ffffff'
    let sublineColor = '#e4e4e7'
    let ctaBg = '#ffffff'
    let ctaTextColor = '#09090b'

    if (styleTheme === 'bold-retail') {
      badgeBg = '#f59e0b'
      badgeTextColor = '#000000'
      headlineColor = '#fde047'
      sublineColor = '#ffffff'
      ctaBg = '#ea580c'
      ctaTextColor = '#ffffff'
    } else if (styleTheme === 'clean-light') {
      badgeBg = '#10b981'
      badgeTextColor = '#000000'
      headlineColor = '#f4f4f5'
      sublineColor = '#d4d4d8'
      ctaBg = '#10b981'
      ctaTextColor = '#000000'
    }

    const headlineLines = wrapText(headline, 20)
    const sublineLines = wrapText(subline, 36)

    const headlineSvg = headlineLines
      .map(
        (line, idx) =>
          `<tspan x="70" dy="${idx === 0 ? 0 : 66}">${escapeXml(line)}</tspan>`
      )
      .join('')

    const sublineSvg = sublineLines
      .map(
        (line, idx) =>
          `<tspan x="70" dy="${idx === 0 ? 0 : 36}">${escapeXml(line)}</tspan>`
      )
      .join('')

    const badgeWidth = Math.max(180, Math.min(480, (badgeText.length + 3) * 16))
    const ctaWidth = Math.max(260, Math.min(500, (ctaText.length + 4) * 18))

    const svgOverlay = `
    <svg width="1080" height="1350" viewBox="0 0 1080 1350" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <!-- Gradiente Superior para Legibilidad de Titulares -->
        <linearGradient id="topVignette" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#000000" stop-opacity="0.80"/>
          <stop offset="60%" stop-color="#000000" stop-opacity="0.30"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0.0"/>
        </linearGradient>

        <!-- Gradiente Inferior para Botón de Acción -->
        <linearGradient id="bottomVignette" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#000000" stop-opacity="0.0"/>
          <stop offset="40%" stop-color="#000000" stop-opacity="0.45"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0.88"/>
        </linearGradient>

        <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="#000000" flood-opacity="0.7"/>
        </filter>
      </defs>

      <!-- Capas de viñeta -->
      <rect width="1080" height="520" fill="url(#topVignette)"/>
      <rect y="900" width="1080" height="450" fill="url(#bottomVignette)"/>

      <!-- Badge Superior -->
      ${
        badgeText.trim()
          ? `
      <g filter="url(#shadow)">
        <rect x="70" y="70" width="${badgeWidth}" height="52" rx="26" ry="26" fill="${badgeBg}"/>
        <text x="${70 + badgeWidth / 2}" y="103" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="800" fill="${badgeTextColor}" text-anchor="middle" letter-spacing="1.5">
          ${escapeXml(badgeText.toUpperCase())}
        </text>
      </g>
      `
          : ''
      }

      <!-- Titular Principal -->
      <text x="70" y="195" font-family="system-ui, -apple-system, sans-serif" font-size="58" font-weight="900" fill="${headlineColor}" filter="url(#shadow)" letter-spacing="-1">
        ${headlineSvg}
      </text>

      <!-- Subtítulo -->
      ${
        sublineLines.length > 0
          ? `
      <text x="70" y="${195 + headlineLines.length * 66 + 20}" font-family="system-ui, -apple-system, sans-serif" font-size="26" font-weight="500" fill="${sublineColor}" filter="url(#shadow)">
        ${sublineSvg}
      </text>
      `
          : ''
      }

      <!-- Botón CTA Inferior -->
      <g filter="url(#shadow)">
        <rect x="70" y="1190" width="${ctaWidth}" height="84" rx="42" ry="42" fill="${ctaBg}"/>
        <text x="${70 + ctaWidth / 2}" y="1243" font-family="system-ui, -apple-system, sans-serif" font-size="28" font-weight="800" fill="${ctaTextColor}" text-anchor="middle">
          ${escapeXml(ctaText)} →
        </text>
      </g>
    </svg>
    `

    composites.push({
      input: Buffer.from(svgOverlay),
      top: 0,
      left: 0,
    })

    // 6. Generación del Buffer Final de Alta Densidad en PNG
    const finalBuffer = await sharp(baseSceneBuffer)
      .composite(composites)
      .png({ quality: 95, compressionLevel: 8 })
      .toBuffer()

    // 7. Almacenamiento en Supabase Storage
    const targetPath = `${dbUser.id}/banners/banner-${publicationId || Date.now()}-${Date.now()}.png`
    let targetBucket = 'blitzr-vault'

    let { error: uploadError } = await supabase.storage
      .from(targetBucket)
      .upload(targetPath, finalBuffer, {
        contentType: 'image/png',
        upsert: true,
      })

    if (uploadError) {
      targetBucket = 'product-images'
      const fallbackUpload = await supabase.storage
        .from(targetBucket)
        .upload(targetPath, finalBuffer, {
          contentType: 'image/png',
          upsert: true,
        })
      uploadError = fallbackUpload.error
    }

    if (uploadError) {
      console.error('Error subiendo banner compilado:', uploadError)
      return NextResponse.json(
        { success: false, error: `Error subiendo banner: ${uploadError.message}` },
        { status: 500 }
      )
    }

    const {
      data: { publicUrl: finalBannerUrl },
    } = supabase.storage.from(targetBucket).getPublicUrl(targetPath)

    // 8. Actualizar registro en Prisma (ContentVault) si publicationId existe
    if (publicationId && typeof publicationId === 'string') {
      try {
        await prisma.contentVault.update({
          where: { id: publicationId },
          data: { bannerUrl: finalBannerUrl },
        })
      } catch (dbErr) {
        console.warn('No se pudo actualizar bannerUrl en Prisma:', dbErr)
      }
    }

    return NextResponse.json({
      success: true,
      finalBannerUrl,
    })
  } catch (error: unknown) {
    console.error('Error en /api/banners/bake:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error interno al compilar pancarta',
      },
      { status: 500 }
    )
  }
}

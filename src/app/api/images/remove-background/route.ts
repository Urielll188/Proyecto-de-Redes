import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import sharp from 'sharp'

export const dynamic = 'force-dynamic'

async function removeBackgroundSharp(inputBuffer: Buffer): Promise<Buffer> {
  const image = sharp(inputBuffer)
  const metadata = await image.metadata()
  const width = metadata.width || 800
  const height = metadata.height || 800

  // Asegurar canal alfa y extraer buffer crudo RGBA
  const { data, info } = await image
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const channels = info.channels // 4 (RGBA)

  // 1. Muestrear los bordes exteriores para detectar el color de fondo dominante
  const sampleIndices: number[] = []
  const stepX = Math.max(1, Math.floor(width / 50))
  const stepY = Math.max(1, Math.floor(height / 50))

  // Bordes superior e inferior
  for (let x = 0; x < width; x += stepX) {
    sampleIndices.push(0 * width + x)
    sampleIndices.push((height - 1) * width + x)
  }
  // Bordes izquierdo y derecho
  for (let y = 0; y < height; y += stepY) {
    sampleIndices.push(y * width + 0)
    sampleIndices.push(y * width + (width - 1))
  }

  let totalR = 0
  let totalG = 0
  let totalB = 0
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

  const threshold = 38
  const feather = 24

  // 2. Aplicar cálculo de distancia euclidiana y difuminado alfa
  for (let i = 0; i < data.length; i += channels) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]

    const dist = Math.sqrt(
      Math.pow(r - bgR, 2) + Math.pow(g - bgG, 2) + Math.pow(b - bgB, 2)
    )

    // En fotografía de producto sobre blanco/claro, detectar quemado de luces
    const isBlownWhite = isLightBg && r > 232 && g > 232 && b > 232

    if (dist < threshold || isBlownWhite) {
      data[i + 3] = 0 // 100% transparente
    } else if (dist < threshold + feather) {
      const alphaFactor = (dist - threshold) / feather
      data[i + 3] = Math.round(data[i + 3] * alphaFactor)
    }
  }

  return sharp(data, {
    raw: { width, height, channels },
  })
    .png({ quality: 95 })
    .toBuffer()
}

export async function POST(request: NextRequest) {
  try {
    // 1. Validar sesión activa con Supabase Auth
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

    // 2. Extraer y validar payload: { imageUrl }
    let body: any = {}
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, error: 'Cuerpo de petición inválido. Se espera JSON.' },
        { status: 400 }
      )
    }

    const { imageUrl } = body || {}

    if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.trim()) {
      return NextResponse.json(
        { success: false, error: 'Parámetro "imageUrl" es requerido.' },
        { status: 400 }
      )
    }

    // 3. Validación estricta de formato: Verificar que NO corresponda a un video
    const isVideoExtension = /\.(mp4|mov|m4v|webm)(\?.*)?$/i.test(imageUrl)
    const isVideoPath = imageUrl.includes('/video/') || imageUrl.includes('video%2F')

    if (isVideoExtension || isVideoPath) {
      return NextResponse.json(
        {
          success: false,
          error: 'La URL proporcionada corresponde a un archivo de video. Solo se pueden recortar imágenes estáticas.',
        },
        { status: 400 }
      )
    }

    // 4. Descargar la imagen original
    const imgRes = await fetch(imageUrl)
    if (!imgRes.ok) {
      return NextResponse.json(
        { success: false, error: `No se pudo descargar la imagen original (HTTP ${imgRes.status}).` },
        { status: 400 }
      )
    }

    const contentType = imgRes.headers.get('content-type') || ''
    if (contentType.startsWith('video/')) {
      return NextResponse.json(
        { success: false, error: 'El archivo descargado es un video, no una imagen.' },
        { status: 400 }
      )
    }

    const originalBuffer = Buffer.from(await imgRes.arrayBuffer())

    // 5. Procesamiento de Segmentación (Extracción de Canal Alfa)
    let transparentBuffer: Buffer | null = null

    // 5A. Intento con Replicate (si existe token configurado)
    if (process.env.REPLICATE_API_TOKEN) {
      try {
        const repRes = await fetch('https://api.replicate.com/v1/models/cjwbw/rembg/predictions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`,
            'Content-Type': 'application/json',
            Prefer: 'wait',
          },
          body: JSON.stringify({
            input: { image: imageUrl },
          }),
        })

        if (repRes.ok) {
          const repData = await repRes.json()
          const outputUrl =
            typeof repData.output === 'string'
              ? repData.output
              : Array.isArray(repData.output)
              ? repData.output[0]
              : null

          if (outputUrl) {
            const outRes = await fetch(outputUrl)
            if (outRes.ok) {
              transparentBuffer = Buffer.from(await outRes.arrayBuffer())
            }
          }
        }
      } catch (repErr) {
        console.warn('Aviso: Inferencia en Replicate no disponible, usando motor local:', repErr)
      }
    }

    // 5B. Intento con Photoroom API (si existe clave)
    if (!transparentBuffer && process.env.PHOTOROOM_API_KEY) {
      try {
        const formData = new FormData()
        formData.append('image_url', imageUrl)
        const prRes = await fetch('https://sdk.photoroom.com/v1/segment', {
          method: 'POST',
          headers: {
            'x-api-key': process.env.PHOTOROOM_API_KEY,
          },
          body: formData,
        })
        if (prRes.ok) {
          transparentBuffer = Buffer.from(await prRes.arrayBuffer())
        }
      } catch (prErr) {
        console.warn('Aviso: Photoroom API falló, usando motor local:', prErr)
      }
    }

    // 5C. Motor de alta precisión con Sharp (análisis de luminancia, distancia de fondo y máscara alfa)
    if (!transparentBuffer) {
      transparentBuffer = await removeBackgroundSharp(originalBuffer)
    }

    // 6. Almacenamiento en Supabase Vault
    const fileName = `${dbUser.id}/transparent/${Date.now()}-nobg.png`
    let targetBucket = 'blitzr-vault'

    let { error: uploadError } = await supabase.storage
      .from(targetBucket)
      .upload(fileName, transparentBuffer, {
        contentType: 'image/png',
        upsert: true,
      })

    if (uploadError) {
      // Fallback a 'product-images' si 'blitzr-vault' requiere permisos alternos
      targetBucket = 'product-images'
      const fallbackUpload = await supabase.storage
        .from(targetBucket)
        .upload(fileName, transparentBuffer, {
          contentType: 'image/png',
          upsert: true,
        })
      uploadError = fallbackUpload.error
    }

    if (uploadError) {
      console.error('Error subiendo imagen transparente a Supabase:', uploadError)
      return NextResponse.json(
        { success: false, error: `Error en almacenamiento: ${uploadError.message}` },
        { status: 500 }
      )
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(targetBucket).getPublicUrl(fileName)

    // 7. Retornar URL pública y Data URL base64 con canal alfa transparente para exportación sin bloqueo CORS
    const transparentDataUrl = `data:image/png;base64,${transparentBuffer.toString('base64')}`
    return NextResponse.json({
      success: true,
      transparentUrl: publicUrl,
      transparentDataUrl,
    })
  } catch (error: unknown) {
    console.error('Error en /api/images/remove-background:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error interno al eliminar fondo de la imagen',
      },
      { status: 500 }
    )
  }
}

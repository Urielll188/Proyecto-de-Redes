import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import sharp from 'sharp'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function generateProceduralBackdrop(nicheCategory: 'kitchen' | 'tech' | 'retail' = 'retail'): Promise<Buffer> {
  const isKitchen = nicheCategory === 'kitchen'
  const isTech = nicheCategory === 'tech'

  const wallBgStart = isKitchen ? '#fef3c7' : isTech ? '#050b14' : '#18181b'
  const wallBgMid = isKitchen ? '#f5efe6' : isTech ? '#0a192f' : '#27272a'
  const wallBgEnd = isKitchen ? '#e7dfd5' : isTech ? '#020617' : '#000000'

  const tableColorStart = isKitchen ? '#d4a373' : isTech ? '#0f172a' : '#d6d3d1'
  const tableColorEnd = isKitchen ? '#bc8a5f' : isTech ? '#020617' : '#a8a29e'
  const tableEdge = isKitchen ? '#a9714b' : isTech ? '#0284c7' : '#78716c'

  const svg = `
  <svg width="1080" height="1350" viewBox="0 0 1080 1350" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="wallBg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${wallBgStart}"/>
        <stop offset="60%" stop-color="${wallBgMid}"/>
        <stop offset="100%" stop-color="${wallBgEnd}"/>
      </linearGradient>
      <radialGradient id="spotLight" cx="50%" cy="35%" r="60%">
        <stop offset="0%" stop-color="${isTech ? '#38bdf8' : '#ffffff'}" stop-opacity="${isKitchen ? '0.35' : isTech ? '0.25' : '0.2'}"/>
        <stop offset="45%" stop-color="${isTech ? '#0284c7' : '#ffffff'}" stop-opacity="${isKitchen ? '0.1' : '0.04'}"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0.8"/>
      </radialGradient>
      <linearGradient id="tableTop" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${tableColorStart}"/>
        <stop offset="100%" stop-color="${tableColorEnd}"/>
      </linearGradient>
      <linearGradient id="tableFront" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${tableEdge}"/>
        <stop offset="100%" stop-color="#09090b"/>
      </linearGradient>
    </defs>
    <!-- Background Wall / Studio Atmosphere -->
    <rect width="1080" height="1350" fill="url(#wallBg)"/>
    <rect width="1080" height="1350" fill="url(#spotLight)"/>

    <!-- Wide Flat Tabletop Surface (No Pillars) -->
    <polygon points="0,880 1080,880 1080,1080 0,1080" fill="url(#tableTop)"/>
    <line x1="0" y1="880" x2="1080" y2="880" stroke="${isTech ? '#38bdf8' : '#ffffff'}" stroke-width="2" stroke-opacity="0.5"/>

    <!-- Soft Horizontal Shadow on table plane -->
    <ellipse cx="540" cy="1000" rx="420" ry="60" fill="#000000" fill-opacity="0.65"/>

    <!-- Table Front Edge / Countertop Thickness -->
    <rect x="0" y="1080" width="1080" height="270" fill="url(#tableFront)"/>
    <line x1="0" y1="1080" x2="1080" y2="1080" stroke="${isTech ? '#0ea5e9' : '#52525b'}" stroke-width="2"/>
  </svg>
  `
  return sharp(Buffer.from(svg)).png().toBuffer()
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

    const userId = dbUser.id

    // 2. Extraer payload: { niche, theme, styleTheme, stylePrompt }
    let body: any = {}
    try {
      body = await request.json()
    } catch {
      // Body vacío permitido
    }

    const niche = body?.niche || body?.productNiche || body?.stylePrompt || ''
    const productNiche = niche || 'Producto Físico'

    // 3. FONDOS CONTEXTUALES BASADOS EN EL NICHO (ZIMZEE-STYLE)
    let scenePrompt = ''
    let nicheCategory: 'kitchen' | 'tech' | 'retail' = 'retail'

    if (productNiche.includes('Comida') || productNiche.includes('Hogar')) {
      nicheCategory = 'kitchen'
      scenePrompt =
        'Bright modern luxury kitchen countertop, light wood surface, soft morning sunlight, blurred airy minimalist kitchen in background, magazine commercial photography, completely empty tabletop foreground, NO objects, NO cups, NO text, 8k'
    } else if (productNiche.includes('Tech') || productNiche.includes('Servicio')) {
      nicheCategory = 'tech'
      scenePrompt =
        'Modern dark matte desk surface, subtle cyan ambient rim lighting, clean minimal workspace background, tech studio showcase, completely empty flat foreground, NO devices, NO text, 8k'
    } else {
      // Retail / Ropa / General
      nicheCategory = 'retail'
      scenePrompt =
        'Minimalist luxury retail boutique floor, soft warm architectural shadows, light neutral travertine stone podium, high fashion editorial lighting, completely empty stage, NO shoes, NO objects, NO text, 8k'
    }

    // 4. Inyección de entropía y llamada a Pollinations Flux con seed aleatorio
    const randomSeed = Math.floor(Math.random() * 9000000) + 1000000
    const encodedPrompt = encodeURIComponent(scenePrompt)
    const pollUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1080&height=1350&seed=${randomSeed}&nologo=true&model=flux`

    let buffer: Buffer | null = null

    // Descargar el buffer con timeout controlado (AbortController de 9s para evitar Error 504 de Vercel)
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 9000)

      const response = await fetch(pollUrl, { signal: controller.signal })
      clearTimeout(timeoutId)

      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer()
        if (arrayBuffer.byteLength > 5000) {
          buffer = Buffer.from(arrayBuffer)
        }
      }
    } catch (aiErr) {
      console.warn('Inferencia remota no disponible o lenta, usando generador procedural de estudio:', aiErr)
    }

    // Si la llamada remota falla o se agota el tiempo, generar escena procedural
    if (!buffer) {
      buffer = await generateProceduralBackdrop(nicheCategory)
    }

    // 5. Guardar en Supabase con nombre de archivo ÚNICO (Evita sobreescritura y caché)
    const uniqueFileName = `${userId}/scenes/pedestal-${Date.now()}-${randomSeed}.png`
    let targetBucket = 'blitzr-vault'

    let { error: uploadError } = await supabase.storage
      .from(targetBucket)
      .upload(uniqueFileName, buffer, {
        contentType: 'image/png',
        upsert: true,
      })

    if (uploadError) {
      targetBucket = 'product-images'
      const fallbackUpload = await supabase.storage
        .from(targetBucket)
        .upload(uniqueFileName, buffer, {
          contentType: 'image/png',
          upsert: true,
        })
      uploadError = fallbackUpload.error
    }

    if (uploadError) {
      console.error('Error subiendo escena de estudio:', uploadError)
      return NextResponse.json(
        { success: false, error: `Error en almacenamiento: ${uploadError.message}` },
        { status: 500 }
      )
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(targetBucket).getPublicUrl(uniqueFileName)

    return NextResponse.json({
      success: true,
      sceneUrl: publicUrl,
      publicUrl,
    })
  } catch (error: unknown) {
    console.error('Error en /api/images/studio-scene:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error interno al generar escena',
      },
      { status: 500 }
    )
  }
}

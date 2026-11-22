import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import sharp from 'sharp'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type BackdropMood = 'editorial-dark' | 'clean-light' | 'warm-wood' | 'neon-tech' | 'retail-gold'

function detectMood(text: string, styleTheme?: string): BackdropMood {
  const low = `${text} ${styleTheme || ''}`.toLowerCase()
  if (/(madera|plantas|c[aá]lido|artesanal|wood|natural|comida|cocina|kitchen)/i.test(low)) {
    return 'warm-wood'
  }
  if (/(ne[oó]n|cyber|3d|gamer|led|tech|redes|software|futur)/i.test(low)) {
    return 'neon-tech'
  }
  if (/(minimalista claro|clean-light|clean light|blanco|m[aá]rmol|luminoso|claro|lifestyle)/i.test(low)) {
    return 'clean-light'
  }
  if (/(bold-retail|bold retail|oferta|dorado|gold|amarillo|promo)/i.test(low)) {
    return 'retail-gold'
  }
  return 'editorial-dark'
}

async function generateProceduralBackdrop(mood: BackdropMood = 'editorial-dark'): Promise<Buffer> {
  const palettes: Record<
    BackdropMood,
    {
      wallStart: string
      wallMid: string
      wallEnd: string
      spotColor: string
      spotOpacity: string
      tableStart: string
      tableEnd: string
      tableEdge: string
      accentLine: string
    }
  > = {
    'editorial-dark': {
      wallStart: '#18181b',
      wallMid: '#09090b',
      wallEnd: '#020617',
      spotColor: '#e4e4e7',
      spotOpacity: '0.18',
      tableStart: '#27272a',
      tableEnd: '#09090b',
      tableEdge: '#3f3f46',
      accentLine: '#a1a1aa',
    },
    'clean-light': {
      wallStart: '#f8fafc',
      wallMid: '#e2e8f0',
      wallEnd: '#cbd5e1',
      spotColor: '#ffffff',
      spotOpacity: '0.65',
      tableStart: '#f1f5f9',
      tableEnd: '#cbd5e1',
      tableEdge: '#94a3b8',
      accentLine: '#ffffff',
    },
    'warm-wood': {
      wallStart: '#292524',
      wallMid: '#1c1917',
      wallEnd: '#0c0a09',
      spotColor: '#fde68a',
      spotOpacity: '0.24',
      tableStart: '#b45309',
      tableEnd: '#78350f',
      tableEdge: '#92400e',
      accentLine: '#fcd34d',
    },
    'neon-tech': {
      wallStart: '#020617',
      wallMid: '#0f172a',
      wallEnd: '#030712',
      spotColor: '#22d3ee',
      spotOpacity: '0.28',
      tableStart: '#0f172a',
      tableEnd: '#020617',
      tableEdge: '#06b6d4',
      accentLine: '#22d3ee',
    },
    'retail-gold': {
      wallStart: '#1c1917',
      wallMid: '#18181b',
      wallEnd: '#09090b',
      spotColor: '#fbbf24',
      spotOpacity: '0.26',
      tableStart: '#27272a',
      tableEnd: '#09090b',
      tableEdge: '#f59e0b',
      accentLine: '#fbbf24',
    },
  }

  const p = palettes[mood] || palettes['editorial-dark']

  const svg = `
  <svg width="1080" height="1350" viewBox="0 0 1080 1350" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="wallBg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${p.wallStart}"/>
        <stop offset="62%" stop-color="${p.wallMid}"/>
        <stop offset="100%" stop-color="${p.wallEnd}"/>
      </linearGradient>
      <radialGradient id="spotLight" cx="50%" cy="42%" r="58%">
        <stop offset="0%" stop-color="${p.spotColor}" stop-opacity="${p.spotOpacity}"/>
        <stop offset="55%" stop-color="${p.spotColor}" stop-opacity="0.05"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="${mood === 'clean-light' ? '0.12' : '0.75'}"/>
      </radialGradient>
      <linearGradient id="tableTop" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${p.tableStart}"/>
        <stop offset="100%" stop-color="${p.tableEnd}"/>
      </linearGradient>
      <linearGradient id="tableFront" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${p.tableEdge}"/>
        <stop offset="100%" stop-color="${p.wallEnd}"/>
      </linearGradient>
    </defs>
    <!-- Studio Wall & Ambient Spotlight -->
    <rect width="1080" height="1350" fill="url(#wallBg)"/>
    <rect width="1080" height="1350" fill="url(#spotLight)"/>

    <!-- Subtle Architectural Studio Ring Light Reflection -->
    <circle cx="540" cy="540" r="310" fill="none" stroke="${p.accentLine}" stroke-opacity="0.12" stroke-width="2"/>

    <!-- Commercial Studio Tabletop Podium -->
    <polygon points="0,890 1080,890 1080,1110 0,1110" fill="url(#tableTop)"/>
    <line x1="0" y1="890" x2="1080" y2="890" stroke="${p.accentLine}" stroke-width="2" stroke-opacity="0.45"/>

    <!-- Contact Ambient Shadow on Podium -->
    <ellipse cx="540" cy="995" rx="380" ry="52" fill="#000000" fill-opacity="${mood === 'clean-light' ? '0.18' : '0.58'}"/>

    <!-- Podium Front Edge -->
    <rect x="0" y="1110" width="1080" height="240" fill="url(#tableFront)"/>
  </svg>
  `
  return sharp(Buffer.from(svg)).png().toBuffer()
}

export async function POST(request: NextRequest) {
  try {
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

    const userId = dbUser?.id || user.id

    let body: any = {}
    try {
      body = await request.json()
    } catch {
      // Body vacío permitido
    }

    const customPrompt = (body?.customPrompt || body?.prompt_fondo || '').trim()
    const productDesc = (body?.productDesc || body?.descripcion_producto || '').trim()
    const niche = (body?.niche || body?.productNiche || body?.stylePrompt || 'Producto Físico').trim()
    const styleTheme = (body?.styleTheme || body?.theme || 'minimal-dark').trim()

    const combinedContext = `${customPrompt} ${productDesc} ${niche} ${styleTheme}`
    const mood = detectMood(combinedContext, styleTheme)

    let scenePrompt = ''
    if (customPrompt) {
      scenePrompt = `${customPrompt}, commercial studio photography stage, clean empty foreground podium surface, professional lighting, NO text, NO letters, NO watermark, 8k`
    } else if (/3d|impresi[oó]n|figura|coleccion|prototipo/i.test(combinedContext)) {
      scenePrompt =
        'Modern creative studio desk podium, soft cyan and warm rim lighting, matte dark architectural surface, commercial product photography background, completely empty center stage, NO text, NO objects, 8k'
    } else if (mood === 'warm-wood') {
      scenePrompt =
        'Warm natural oak wood tabletop surface, soft golden sunlight shadows, blurred modern studio background, commercial photography stage, completely empty foreground tabletop, NO text, 8k'
    } else if (mood === 'clean-light') {
      scenePrompt =
        'Bright minimalist architectural studio podium, white travertine stone surface, soft daylight shadows, luxury editorial product photography backdrop, empty center stage, NO text, 8k'
    } else if (mood === 'neon-tech') {
      scenePrompt =
        'Modern dark matte studio desk surface, subtle cyan ambient rim lighting, clean minimal tech studio background, completely empty flat foreground, NO devices, NO text, 8k'
    } else {
      scenePrompt =
        'Luxury commercial photography studio podium, dark matte stone surface, dramatic soft studio spotlight, clean architectural background, empty foreground stage, NO objects, NO text, 8k'
    }

    const randomSeed = Math.floor(Math.random() * 9000000) + 1000000
    const encodedPrompt = encodeURIComponent(scenePrompt)
    const pollUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1080&height=1350&seed=${randomSeed}&nologo=true&model=flux`

    let buffer: Buffer | null = null

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 7500)

      const response = await fetch(pollUrl, { signal: controller.signal })
      clearTimeout(timeoutId)

      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer()
        if (arrayBuffer.byteLength > 5000) {
          buffer = Buffer.from(arrayBuffer)
        }
      }
    } catch (aiErr) {
      console.warn('Inferencia remota lenta, usando estudio procedural HD:', aiErr)
    }

    if (!buffer) {
      buffer = await generateProceduralBackdrop(mood)
    }

    // Convertir a data URL base64 para garantizar exportación 1080x1350 100% libre de bloqueo CORS
    const sceneDataUrl = `data:image/png;base64,${buffer.toString('base64')}`

    // Guardar también en Supabase Storage para persistencia en Bóveda
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

    let publicUrl = sceneDataUrl
    if (!uploadError) {
      const { data } = supabase.storage.from(targetBucket).getPublicUrl(uniqueFileName)
      if (data?.publicUrl) {
        publicUrl = data.publicUrl
      }
    }

    return NextResponse.json({
      success: true,
      sceneUrl: publicUrl,
      publicUrl,
      sceneDataUrl,
      promptUsed: scenePrompt,
    })
  } catch (error: unknown) {
    console.error('Error en /api/generate/visual:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error interno al generar visual',
      },
      { status: 500 }
    )
  }
}

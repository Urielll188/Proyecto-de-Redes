import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI, SchemaType, type ResponseSchema } from '@google/generative-ai'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const responseSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    titulo_campana: { type: SchemaType.STRING, description: 'Título comercial corto de la campaña' },
    veredicto_cmo: {
      type: SchemaType.STRING,
      description:
        'Análisis rudo en 2 frases: objeción mortal del cliente y por qué este ángulo la destruye.',
    },
    estrategia: {
      type: SchemaType.OBJECT,
      properties: {
        avatar_cliente: { type: SchemaType.STRING },
        angulo_gancho: { type: SchemaType.STRING },
        oferta_irresistible: { type: SchemaType.STRING },
      },
      required: ['avatar_cliente', 'angulo_gancho', 'oferta_irresistible'],
    },
    fase_1_atraccion_reels_tiktok: {
      type: SchemaType.OBJECT,
      properties: {
        hook_visual_0_a_3s: { type: SchemaType.STRING },
        guion_desarrollo: { type: SchemaType.STRING },
        copy_pie_video: { type: SchemaType.STRING },
      },
      required: ['hook_visual_0_a_3s', 'guion_desarrollo', 'copy_pie_video'],
    },
    fase_2_consideracion_feed: {
      type: SchemaType.OBJECT,
      properties: {
        copy_principal: { type: SchemaType.STRING },
        llamado_a_la_accion: { type: SchemaType.STRING },
      },
      required: ['copy_principal', 'llamado_a_la_accion'],
    },
    fase_3_cierre_whatsapp: {
      type: SchemaType.OBJECT,
      properties: {
        texto_estado: { type: SchemaType.STRING },
      },
      required: ['texto_estado'],
    },
  },
  required: [
    'titulo_campana',
    'veredicto_cmo',
    'estrategia',
    'fase_1_atraccion_reels_tiktok',
    'fase_2_consideracion_feed',
    'fase_3_cierre_whatsapp',
  ],
}

export async function POST(request: NextRequest) {
  try {
    // 1. Validar autenticación del usuario con Supabase Auth
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

    // 2. Extraer datos del body: { prompt, imageUrl, isVideo, niche, goal }
    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, error: 'Cuerpo de la petición inválido. Se espera JSON.' },
        { status: 400 }
      )
    }

    const { prompt, imageUrl, isVideo, niche, goal } = body || {}

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return NextResponse.json(
        { success: false, error: 'Parámetro "prompt" es requerido.' },
        { status: 400 }
      )
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'Configuración faltante: GEMINI_API_KEY no configurada.' },
        { status: 500 }
      )
    }

    // 3. Inicializar Gemini con System Prompt de CMO y Schema Estricto
    const genAI = new GoogleGenerativeAI(apiKey)
    const systemInstruction = `Eres un Director de Marketing (CMO) de Respuesta Directa especializado en comercio digital y servicios locales. 
Tu trabajo es maximizar el retorno de inversión y las conversiones en TikTok, Instagram y WhatsApp. 
Reglas:
1. No uses adjetivos vacíos o inflados ("increíble", "revolucionario", "el mejor").
2. En la fase de atracción, los primeros 3 segundos deben frenar el scroll con un dolor específico o una acción visual disruptiva.
3. En la fase de consideración, enfócate en beneficios tangibles, materiales, garantías o eliminación de objeciones.
4. En WhatsApp, redacta textos de escasez real o llamado a la acción directo para cerrar por mensaje privado.
5. Devuelve única y estrictamente el JSON Schema indicado sin texto adicional.`

    const generationConfig = {
      temperature: 0.7,
      responseMimeType: 'application/json',
      responseSchema: responseSchema,
    }

    // 4. Manejo de imagen y texto en el payload
    const contextPrompt = [
      `Contexto del producto: ${prompt}`,
      niche ? `Nicho de mercado: ${niche}` : null,
      goal ? `Objetivo principal: ${goal}` : null,
    ]
      .filter(Boolean)
      .join('\n')

    let contents: any[]

    if (isVideo === true) {
      // Si es video: OMITIR cualquier procesamiento visual para proteger latencia y costos
      contents = [contextPrompt]
    } else if (imageUrl && typeof imageUrl === 'string') {
      try {
        const imgRes = await fetch(imageUrl)
        if (imgRes.ok) {
          const arrayBuf = await imgRes.arrayBuffer()
          const base64Data = Buffer.from(arrayBuf).toString('base64')
          const mimeType = imgRes.headers.get('content-type') || 'image/jpeg'
          contents = [
            {
              inlineData: {
                data: base64Data,
                mimeType,
              },
            },
            contextPrompt,
          ]
        } else {
          contents = [contextPrompt]
        }
      } catch (imgErr) {
        console.warn('Error al descargar imagen, usando solo prompt textual:', imgErr)
        contents = [contextPrompt]
      }
    } else {
      contents = [contextPrompt]
    }

    // 5. Ejecución del modelo Gemini con fallback a modelos activos
    const candidateModels = [
      'gemini-2.5-flash',
      'gemini-2.0-flash',
    ]

    let result: any = null
    let lastError: any = null

    for (const modelName of candidateModels) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction,
          generationConfig,
        })
        result = await model.generateContent(contents)
        if (result) break
      } catch (err: any) {
        lastError = err
        console.warn(`[GEMINI RETRY] Modelo "${modelName}" no disponible (${err?.message?.slice(0, 70)}), probando variante...`)
      }
    }

    if (!result) {
      throw lastError || new Error('No se pudo generar contenido con los modelos de Gemini disponibles.')
    }

    const responseText = result.response.text()
    const campaign = JSON.parse(responseText)

    // 6. Parseo y persistencia en Prisma (ContentVault)
    const igCopy = `${campaign.fase_2_consideracion_feed.copy_principal}\n\n${campaign.fase_2_consideracion_feed.llamado_a_la_accion}`
    const ttScript = `[0-3s Gancho]: ${campaign.fase_1_atraccion_reels_tiktok.hook_visual_0_a_3s}\n\n[Demostración]: ${campaign.fase_1_atraccion_reels_tiktok.guion_desarrollo}\n\n[Copy/Hashtags]: ${campaign.fase_1_atraccion_reels_tiktok.copy_pie_video}`

    const newPublication = await prisma.contentVault.create({
      data: {
        userId: dbUser.id,
        topic: campaign.titulo_campana || prompt,
        tone: typeof goal === 'string' && goal.trim() ? goal : 'Estratégico',
        instagramCopy: igCopy,
        tiktokScript: ttScript,
        imageUrl: imageUrl || null,
        bannerUrl: null, // Se genera posteriormente o se actualiza
        targetAudience: campaign.estrategia?.avatar_cliente || null,
        salesAngle: campaign.estrategia?.angulo_gancho || null,
        postingTips: campaign.estrategia?.oferta_irresistible || null,
        salesAngleReasoning: campaign.veredicto_cmo || null,
        whatsappFicha: campaign.fase_3_cierre_whatsapp?.texto_estado || null,
      },
    })

    // 7. Retornar al frontend
    return NextResponse.json({
      success: true,
      data: campaign,
      publicationId: newPublication.id,
    })
  } catch (error: unknown) {
    console.error('Error en /api/generate:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error interno al generar contenido',
      },
      { status: 500 }
    )
  }
}

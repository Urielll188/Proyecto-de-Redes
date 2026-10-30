'use server'

import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { GoogleGenAI, Type } from '@google/genai'

export async function generateStrategyAction(productDesc: string, imageUrl: string | null) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autorizado')

  const dbUser = await prisma.user.findUnique({
    where: { supabaseAuthId: user.id },
    select: { id: true },
  })
  if (!dbUser) throw new Error('Usuario no registrado en la base de datos')

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
    
    let imagePart: any = null
    if (imageUrl) {
      try {
        const imgResponse = await fetch(imageUrl)
        if (imgResponse.ok) {
          const arrayBuffer = await imgResponse.arrayBuffer()
          imagePart = {
            inlineData: {
              data: Buffer.from(arrayBuffer).toString('base64'),
              mimeType: imgResponse.headers.get('content-type') || 'image/jpeg'
            }
          }
        }
      } catch (e) {
        console.warn('Error descargando imagen para estrategia:', e)
      }
    }

    const promptText = `ERES UN DIRECTOR DE MARKETING Y ESTRATEGA DE VENTAS PRAGMÁTICO (TOP 1% MUNDIAL).
Tu objetivo no es dar teoría, sino decirle a un emprendedor exactamente qué hacer para vender su producto: "${productDesc}".
${imageUrl ? "Analiza a fondo la imagen adjunta: materiales, acabados, contexto de uso y nivel de calidad visual." : ""}

REGLAS ESTRICTAS DE RESPUESTA:
1. TOLERANCIA CERO A CLICHÉS DE IA: 
   Prohibido usar frases como "En el mundo digital de hoy", "¡Hola a todos!", "Descubre la magia", "Lleva tu experiencia al siguiente nivel" o rodeos poéticos. Habla como un socio de negocios con experiencia en ventas.

2. BUYER PERSONA (CLIENTE IDEAL):
   Sé hiper-específico. Define quién saca la billetera: su ocupación, qué problema diario le quita el sueño y qué estatus o alivio siente al comprar este producto. Cero respuestas vagas como "hombres y mujeres interesados en el diseño".

3. DÓNDE PUBLICAR (POSTING TIPS):
   Recomienda el canal exacto (Reels, TikTok, Facebook Marketplace, grupos locales) y la hora puntual. Explica el momento del día en que el comprador tiene tiempo de ver el celular y dinero para gastar.

4. ÁNGULO DE VENTA (SALES ANGLE):
   Aplica el marco PAS (Problema real que duele -> Agitación de la molestia -> Tu producto como solución obvia). Apóyate en gatillos de compra reales: urgencia, ahorro de tiempo, estatus o resolver una frustración.

5. RAZONAMIENTOS EN LOS MODALES ('reasoning'):
   Explica el "por qué" de cada decisión con lógica comercial clara y sin tecnicismos confusos (evita jerga como CPC o ROAS). Explica qué piensa el cliente en su cabeza y por qué este enfoque hace que elijan comprar en lugar de seguir deslizando.

Devuelve ÚNICAMENTE el JSON requerido.`

    const contentsParams: any = imagePart ? [imagePart, { text: promptText }] : promptText

    const fallbackModels = ['gemini-3.8-flash', 'gemini-3.5-flash-lite']
    let responseText: string | null = null
    let lastError: any = null

    for (const modelName of fallbackModels) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: contentsParams,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                buyerPersona: { 
                  type: Type.OBJECT, 
                  properties: { 
                    content: { type: Type.STRING, description: "Perfil demográfico y dolores del cliente ideal" },
                    reasoning: { type: Type.STRING, description: "Por qué este nicho es el más rentable y receptivo para el producto" }
                  },
                  required: ["content", "reasoning"]
                },
                postingTips: { 
                  type: Type.OBJECT, 
                  properties: { 
                    content: { type: Type.STRING, description: "Redes y horarios sugeridos" },
                    reasoning: { type: Type.STRING, description: "Por qué esta plataforma y horario maximizan el alcance orgánico" }
                  },
                  required: ["content", "reasoning"]
                },
                photoAdvice: { 
                  type: Type.OBJECT, 
                  properties: { 
                    content: { type: Type.STRING, description: "Consejos prácticos de foto o video con smartphone" },
                    reasoning: { type: Type.STRING, description: "Justificación psicológica visual para sugerir este encuadre/estilo" }
                  },
                  required: ["content", "reasoning"]
                },
                salesAngle: { 
                  type: Type.OBJECT, 
                  properties: { 
                    content: { type: Type.STRING, description: "Gancho persuasivo de venta" },
                    reasoning: { type: Type.STRING, description: "Por qué este gatillo mental detonará el deseo de compra" }
                  },
                  required: ["content", "reasoning"]
                }
              },
              required: ["buyerPersona", "postingTips", "photoAdvice", "salesAngle"]
            }
          }
        })

        if (response.text) {
          responseText = response.text
          break
        }
      } catch (err: any) {
        console.warn(`Fallo en modelo ${modelName}:`, err?.message)
        lastError = err
      }
    }

    if (!responseText) throw new Error(lastError?.message || 'Error al conectar con el consultor de IA')
    const strategyData = JSON.parse(responseText)

    const newRecord = await prisma.contentVault.create({
      data: {
        userId: dbUser.id,
        topic: productDesc,
        tone: 'Estratégico',
        instagramCopy: '',
        tiktokScript: '',
        imageUrl: imageUrl || null,
        targetAudience: strategyData.buyerPersona?.content || '',
        targetAudienceReasoning: strategyData.buyerPersona?.reasoning || null,
        postingTips: strategyData.postingTips?.content || '',
        postingTipsReasoning: strategyData.postingTips?.reasoning || null,
        photoAdvice: strategyData.photoAdvice?.content || '',
        photoAdviceReasoning: strategyData.photoAdvice?.reasoning || null,
        salesAngle: strategyData.salesAngle?.content || '',
        salesAngleReasoning: strategyData.salesAngle?.reasoning || null,
      }
    })

    return { success: true, strategyId: newRecord.id, data: strategyData }
  } catch (error: any) {
    console.error('Error generando estrategia:', error)
    throw new Error(error.message || 'Error al generar la estrategia con IA')
  }
}

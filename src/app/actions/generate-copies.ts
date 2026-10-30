'use server'

import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { GoogleGenAI, Type } from '@google/genai'
import { revalidatePath } from 'next/cache'

export async function generateCopiesAction(strategyId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autorizado')

  const dbUser = await prisma.user.findUnique({
    where: { supabaseAuthId: user.id },
    select: { id: true, creditsBalance: true },
  })
  if (!dbUser || dbUser.creditsBalance < 1) {
    throw new Error('Créditos insuficientes. Se requiere 1 crédito.')
  }

  const vaultRecord = await prisma.contentVault.findUnique({
    where: { id: strategyId, userId: dbUser.id }
  })
  if (!vaultRecord) throw new Error('Estrategia no encontrada')

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
    const promptText = `Eres un Copywriter de élite y Director de Crecimiento Comercial.
Redacta el contenido final y el kit de cierre de ventas para este producto: "${vaultRecord.topic}".

CONTEXTO ESTRATÉGICO:
- Cliente Ideal: ${vaultRecord.targetAudience}
- Ángulo de Venta: ${vaultRecord.salesAngle}

ENTREGABLES REQUERIDOS:
1. Instagram: Copy persuasivo con ganchos, espacios, emojis y llamado a la acción.
2. TikTok: Guion estructurado por segundos [Gancho] -> [Demostración] -> [CTA].
3. WhatsApp Business:
   - Ficha: Ficha técnica lista para enviar al cliente con precio, qué incluye y métodos de pago.
   - Objeción Precio: Respuesta persuasiva y empática cuando el cliente dice "está caro" o pide descuento.
   - Objeción Confianza: Respuesta que disipa dudas sobre envíos, garantías y calidad del producto.
Devuelve ÚNICAMENTE el JSON requerido.`

    const fallbackModels = ['gemini-3.8-flash', 'gemini-3.5-flash-lite']
    let responseText: string | null = null
    let lastError: any = null

    for (const modelName of fallbackModels) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: promptText,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                instagramCopy: { type: Type.STRING, description: "Copy completo para Instagram" },
                tiktokScript: { type: Type.STRING, description: "Guion estructurado para TikTok/Reels" },
                whatsapp: {
                  type: Type.OBJECT,
                  properties: {
                    ficha: { type: Type.STRING, description: "Ficha vendedora para chat de WhatsApp" },
                    objecionPrecio: { type: Type.STRING, description: "Respuesta a objeción de precio" },
                    objecionConfianza: { type: Type.STRING, description: "Respuesta a objeción de desconfianza o envío" }
                  },
                  required: ["ficha", "objecionPrecio", "objecionConfianza"]
                }
              },
              required: ["instagramCopy", "tiktokScript", "whatsapp"]
            }
          }
        })

        if (response.text) {
          responseText = response.text
          break
        }
      } catch (err: any) {
        console.warn(`Fallo en ${modelName}:`, err?.message)
        lastError = err
      }
    }

    if (!responseText) throw new Error(lastError?.message || 'Error al generar copys')
    const generated = JSON.parse(responseText)

    // Transacción atómica: Cobro, Ledger y Guardado en Bóveda
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: dbUser.id },
        data: { creditsBalance: { decrement: 1 } }
      })
      await tx.creditTransaction.create({
        data: { 
          userId: dbUser.id, 
          amount: -1, 
          balanceAfter: dbUser.creditsBalance - 1,
          type: 'USAGE', 
          description: 'Generación de Copys Omnicanal y WhatsApp' 
        }
      })
      await tx.contentVault.update({
        where: { id: strategyId },
        data: { 
          instagramCopy: generated.instagramCopy,
          tiktokScript: generated.tiktokScript,
          whatsappFicha: generated.whatsapp?.ficha || null,
          whatsappPrecio: generated.whatsapp?.objecionPrecio || null,
          whatsappConfianza: generated.whatsapp?.objecionConfianza || null
        }
      })
    })

    revalidatePath('/dashboard')
    revalidatePath('/dashboard/history')
    return { success: true, copies: generated }
  } catch (error: any) {
    console.error('Error generando copys omnicanal:', error)
    throw new Error(error.message || 'Error al generar copys')
  }
}

'use server'

import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { GoogleGenAI, Type } from '@google/genai'
import { revalidatePath } from 'next/cache'

export async function refineCopyAction(contentId: string, instruction: string) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, message: 'Sesión no válida o expirada.' }
    }

    // 1. Validar usuario y saldo de créditos
    const dbUser = await prisma.user.findUnique({
      where: { supabaseAuthId: user.id },
      select: { id: true, creditsBalance: true }
    })

    if (!dbUser || dbUser.creditsBalance < 1) {
      return { success: false, message: 'Créditos insuficientes. Se requiere 1 crédito para iterar.' }
    }

    // 2. Obtener los copys actuales de la Bóveda
    const vaultItem = await prisma.contentVault.findUnique({
      where: { id: contentId, userId: dbUser.id }
    })

    if (!vaultItem) {
      return { success: false, message: 'Campaña no encontrada en la bóveda.' }
    }

    // 3. Preparar prompt de refinamiento con contexto
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

    const promptText = `ERES UN COPYWRITER SENIOR Y DIRECTOR CREATIVO DE REDES SOCIALES.
Tu tarea es modificar y mejorar los siguientes textos publicitarios de acuerdo a la instrucción específica del usuario.

TEXTOS ACTUALES:
- Instagram / Facebook:
"""${vaultItem.instagramCopy || vaultItem.topic}"""

- Guion TikTok / Reels:
"""${vaultItem.tiktokScript || vaultItem.topic}"""

INSTRUCCIÓN DE RETOQUE DEL USUARIO:
"${instruction}"

REGLAS ESTRICTAS:
1. Aplica la instrucción con precisión manteniendo la alta tasa de conversión.
2. Si la instrucción se refiere solo a una red, ajusta principalmente esa red y mantén la otra coherente.
3. Devuelve ÚNICAMENTE la estructura JSON requerida sin introducciones ni despedidas.`

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
                instagramCopy: { type: Type.STRING, description: "Copy de Instagram actualizado con el ajuste solicitado" },
                tiktokScript: { type: Type.STRING, description: "Guion de TikTok actualizado con el ajuste solicitado" }
              },
              required: ["instagramCopy", "tiktokScript"]
            }
          }
        })

        if (response.text) {
          responseText = response.text
          break
        }
      } catch (err: any) {
        console.warn(`Fallo en refinamiento con ${modelName}:`, err?.message)
        lastError = err
      }
    }

    if (!responseText) {
      throw new Error(lastError?.message || 'Error al conectar con la IA de refinamiento')
    }

    const updatedCopies = JSON.parse(responseText)

    // 4. Transacción Atómica: Cobro, Ledger y Guardado en Bóveda
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
          description: `Ajuste con Copiloto: "${instruction.slice(0, 30)}..."`
        }
      })

      await tx.contentVault.update({
        where: { id: contentId },
        data: {
          instagramCopy: updatedCopies.instagramCopy,
          tiktokScript: updatedCopies.tiktokScript
        }
      })
    })

    revalidatePath('/dashboard')
    revalidatePath('/dashboard/history')

    return { 
      success: true, 
      copies: updatedCopies, 
      message: '¡Contenido actualizado con éxito!' 
    }

  } catch (error: any) {
    console.error('Error en refineCopyAction:', error)
    return { success: false, message: error.message || 'Error interno al procesar con IA.' }
  }
}

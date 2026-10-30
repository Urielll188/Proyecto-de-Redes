'use server'

import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { GoogleGenAI, Type } from '@google/genai'

// Esquema de entrada del usuario
const generateSchema = z.object({
  topic: z.string().min(5, 'El tema debe tener al menos 5 caracteres').max(500, 'El tema excede el límite'),
  tone: z.enum(['profesional', 'casual', 'viral', 'educativo']).default('viral'),
  imageUrl: z.string().url().optional().or(z.literal('')),
})

// Caché en memoria para Rate Limiting (MVP)
const rateLimitCache = new Map<string, number>();
const COOLDOWN_MS = 10000; // 10 segundos de enfriamiento

export async function generateSocialContent(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'No autorizado. Inicia sesión.' }
  }

  // Rate Limiting Check
  const now = Date.now();
  const lastRequest = rateLimitCache.get(user.id);

  if (lastRequest && (now - lastRequest) < COOLDOWN_MS) {
    const timeLeft = Math.ceil((COOLDOWN_MS - (now - lastRequest)) / 1000);
    return { error: `Por favor espera ${timeLeft} segundos antes de generar más contenido.` };
  }

  // Actualizar el timestamp de la petición
  rateLimitCache.set(user.id, now);

  const rawData = {
    topic: formData.get('topic'),
    tone: formData.get('tone') ?? 'viral',
    imageUrl: formData.get('imageUrl') || undefined,
  }

  const parsed = generateSchema.safeParse(rawData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos de entrada inválidos.' }
  }

  // 1. Obtener ID interno
  const dbUser = await prisma.user.findUnique({
    where: { supabaseAuthId: user.id },
    select: { id: true, creditsBalance: true },
  })

  if (!dbUser) {
    return { error: 'Usuario no encontrado en la base de datos.' }
  }

  // 2. Deducción Atómica de Créditos
  const updateResult = await prisma.user.updateMany({
    where: { id: dbUser.id, creditsBalance: { gt: 0 } },
    data: { creditsBalance: { decrement: 1 } },
  })

  if (updateResult.count === 0) {
    return { error: 'Créditos insuficientes para generar contenido.' }
  }

  // 3. Registrar consumo
  await prisma.creditTransaction.create({
    data: {
      userId: dbUser.id,
      amount: -1,
      balanceAfter: dbUser.creditsBalance - 1,
      type: 'AI_GENERATION',
      description: `Generación IA: ${parsed.data.topic.slice(0, 30)}...`,
    },
  })

  // 4. Llamada a Gemini con Cascada de Modelos (Fallback)
  let responseText: string | null = null;
  const fallbackModels = ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-pro'];
  let lastError: any = null;

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    let imagePart: any = null;
    if (parsed.data.imageUrl) {
      try {
        const imgResponse = await fetch(parsed.data.imageUrl);
        if (imgResponse.ok) {
          const arrayBuffer = await imgResponse.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          imagePart = {
            inlineData: {
              data: buffer.toString('base64'),
              mimeType: imgResponse.headers.get('content-type') || 'image/jpeg'
            }
          };
        }
      } catch (err) {
        console.warn('No se pudo procesar la imagen de Supabase, continuando solo con texto:', err);
      }
    }

    const promptText = `Actúa como Director de Marketing y estratega de redes sociales. 
Analiza detalladamente la imagen adjunta (si está presente) y genera una estrategia de contenido sobre: "${parsed.data.topic}". Tono: ${parsed.data.tone}.
Reglas:
- Instagram: Copy persuasivo con emojis. Si hay foto, resalta características visuales específicas (color, textura, diseño).
- TikTok: Guion corto y dinámico. Si hay foto, sugiere ganchos visuales mostrando el producto en cámara.
Devuelve ÚNICAMENTE el JSON requerido.`;

    const contentsParams: any = imagePart 
      ? [imagePart, { text: promptText }] 
      : promptText;

    for (const modelName of fallbackModels) {
      try {
        console.log(`Intentando generación con el modelo: ${modelName}...`);
        const response = await ai.models.generateContent({
          model: modelName,
          contents: contentsParams,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                instagram: { type: Type.STRING, description: "Copy para Instagram" },
                tiktok: { type: Type.STRING, description: "Guion para TikTok" },
                visualPrompt: { 
                  type: Type.STRING, 
                  description: "Detailed English prompt optimized for AI image generation (Imagen 3). Specify lighting, composition, colors, and realistic advertisement style." 
                },
              },
              required: ["instagram", "tiktok", "visualPrompt"],
            },
            temperature: 0.7,
          }
        });

        if (response.text) {
          responseText = response.text;
          console.log(`Generación exitosa con el modelo: ${modelName}`);
          break;
        }
      } catch (error: any) {
        console.warn(`Fallo en el modelo ${modelName} (${error?.status || error?.code || 'Error'}). Probando siguiente modelo...`);
        lastError = error;
      }
    }

    if (!responseText) {
      throw new Error(lastError?.message || "Todos los modelos de IA fallaron.");
    }

    const aiData = JSON.parse(responseText);

    // Guardar en la bóveda del usuario
    await prisma.contentVault.create({
      data: {
        userId: dbUser.id,
        topic: parsed.data.topic,
        tone: parsed.data.tone,
        instagramCopy: aiData.instagram,
        tiktokScript: aiData.tiktok,
        imageUrl: parsed.data.imageUrl || null,
        visualPrompt: aiData.visualPrompt || null,
      }
    });

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/history');
    return { success: true, data: aiData };

  } catch (iaError) {
    console.error('Fallo crítico en IA tras reintentos, ejecutando reembolso:', iaError)

    // 5. Compensación: Reembolsar crédito
    await prisma.user.update({
      where: { id: dbUser.id },
      data: { creditsBalance: { increment: 1 } },
    })

    await prisma.creditTransaction.create({
      data: {
        userId: dbUser.id,
        amount: 1,
        balanceAfter: dbUser.creditsBalance,
        type: 'REFUND',
        description: 'Reembolso por saturación en la API de Google',
      },
    })

    revalidatePath('/dashboard')
    return { error: 'Nuestros servidores de IA están experimentando tráfico inusual. Se te ha reembolsado el crédito, intenta de nuevo en unos minutos.' }
  }
}

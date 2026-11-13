import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`TIMEOUT_${ms}MS`)), ms)
    ),
  ])
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY || ''
    if (!apiKey) throw new Error('Falta GEMINI_API_KEY en las variables de entorno.')

    // Extraer imageBase64 explícitamente para no meterlo en el string de texto
    const body = await req.json()
    const { generationMode = 'strategic', imageBase64, ...inputData } = body

    // 1. Cascada ordenada: primero versiones fijas estables, alias -latest al final
    const verifiedModels =
      generationMode === 'fast'
        ? [
            'gemini-3.5-flash-lite',
            'gemini-3.1-flash-lite',
            'gemini-3.5-flash',
            'gemini-flash-lite-latest',
            'gemini-flash-latest',
          ]
        : [
            'gemini-3.5-flash',
            'gemini-3.5-flash-lite',
            'gemini-3.1-flash-lite',
            'gemini-3.7-flash',
            'gemini-flash-latest',
          ]

    // Si imageUrl contiene un Data URL base64, extraerlo también de inputData
    let rawBase64 = imageBase64
    if (!rawBase64 && typeof inputData.imageUrl === 'string' && inputData.imageUrl.startsWith('data:image')) {
      rawBase64 = inputData.imageUrl
      delete inputData.imageUrl
    }

    // 2. Limpiar texto de entrada: Borrar basura residual gigante que ahogue los tokens
    const sanitizedInput = Object.fromEntries(
      Object.entries(inputData).filter(([_, value]) => {
        if (typeof value === 'string' && value.length > 1500) return false
        return true
      })
    )

    const modeDirective =
      generationMode === 'fast'
        ? 'MODO DESPLIEGUE RÁPIDO: Ve directo al grano. Genera únicamente los copys finales y titular listos para vender, sin análisis estratégico (deja los campos de análisis estratégico en null o vacíos).'
        : 'MODO CAMPAÑA ESTRATÉGICA CMO: Realiza el análisis completo (veredicto, avatar, ángulo de gancho, oferta irresistible) y redacta los copys de conversión para cada canal.'

    const jsonSchemaInstruction = `
Responde ÚNICAMENTE con un JSON válido (sin markdown, sin bloques \`\`\`) con estas llaves exactas:
{
  "headline": "Titular corto de máximo 5 palabras en mayúsculas",
  "igCopy": "Copy persuasivo listo para publicar en Instagram",
  "tiktokScript": "Guion estructurado [0-3s Gancho], [Demostración], [CTA] para Reels/TikTok",
  "whatsappCopy": "Mensaje directo de cierre para WhatsApp",
  "veredicto_cmo": ${generationMode === 'fast' ? 'null' : '"Veredicto estratégico breve de optimización para conversión"'},
  "cmoAnalysis": ${
    generationMode === 'fast'
      ? 'null'
      : `{
    "avatar": "Cliente ideal y su dolor principal",
    "angle": "Ángulo de venta",
    "irresistibleOffer": "Oferta irresistible"
  }`
  }
}`

    const userPrompt = `${modeDirective}\n\n${jsonSchemaInstruction}\n\nDatos del producto/campaña:\n${JSON.stringify(sanitizedInput)}`

    // 3. Ensamblaje Multimodal Seguro
    const parts: any[] = [{ text: userPrompt }]
    if (rawBase64) {
      const mimeType = rawBase64.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/)?.[1] || 'image/jpeg'
      const base64Data = rawBase64.replace(/^data:image\/\w+;base64,/, '')
      parts.push({ inlineData: { data: base64Data, mimeType } })
    }

    // 4. Timeout ajustado si viaja imagen en Base64 (evita cortar la lectura visual)
    const hasImage = parts.length > 1
    const timeoutPerModel = generationMode === 'fast' ? (hasImage ? 9000 : 6000) : 15000

    const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms))

    let rawText = ''
    let lastError: any = null

    for (let i = 0; i < verifiedModels.length; i++) {
      const modelName = verifiedModels[i]
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: generationMode === 'fast' ? 0.7 : 0.85,
          },
        })

        const result = await withTimeout(
          model.generateContent({ contents: [{ role: 'user', parts }] }),
          timeoutPerModel
        )
        rawText = result.response.text()
        if (rawText) break
      } catch (err: any) {
        lastError = err
        console.warn(`[Blitzr AI] Intento ${i + 1} (${modelName}) falló: ${err?.message}`)
        if (i < verifiedModels.length - 1) {
          await sleep(600)
        }
      }
    }

    if (!rawText) {
      throw lastError || new Error('No se obtuvo respuesta de los modelos activos.')
    }

    const cleanJson = rawText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim()
    const parsedData = JSON.parse(cleanJson)

    return NextResponse.json({
      success: true,
      data: parsedData,
      ...parsedData,
    })
  } catch (error: any) {
    console.error('[API CMO Error]:', error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Error interno al generar campaña.' },
      { status: 500 }
    )
  }
}

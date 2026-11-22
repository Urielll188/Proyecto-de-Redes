import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'

export const dynamic = 'force-dynamic'

export type StudioStyleId = 'minimal-dark' | 'clean-light' | 'bold-retail'

interface CanvasStateInput {
  titular?: string
  subtitulo?: string
  badge?: string
  precio?: string
  precio_anterior?: string
  estilo?: StudioStyleId
  escala_producto?: number
  offset_y_producto?: number
  prompt_fondo?: string
  descripcion_producto?: string
}

function normalizeStyle(raw?: string, fallback: StudioStyleId = 'minimal-dark'): StudioStyleId {
  const s = (raw || '').toLowerCase().trim()
  if (s.includes('bold') || s.includes('oferta') || s.includes('retail') || s.includes('marketplace')) {
    return 'bold-retail'
  }
  if (s.includes('clean') || s.includes('light') || s.includes('lifestyle') || s.includes('claro')) {
    return 'clean-light'
  }
  if (s.includes('minimal') || s.includes('dark') || s.includes('editorial') || s.includes('oscuro')) {
    return 'minimal-dark'
  }
  return fallback
}

function applyHeuristicDesignEdit(mensaje: string, current: Required<CanvasStateInput>) {
  const msg = mensaje.trim()
  const low = msg.toLowerCase()

  let titular = current.titular
  let subtitulo = current.subtitulo
  let badge = current.badge
  let precio = current.precio
  let precio_anterior = current.precio_anterior
  let estilo: StudioStyleId = current.estilo
  let escala_producto = current.escala_producto
  let offset_y_producto = current.offset_y_producto
  let regenerar_fondo = false
  let nuevo_prompt_fondo = current.prompt_fondo
  const acciones: string[] = []

  // 1. Detectar cambios de escala o posición del producto
  if (/(agrandar|m[aá]s grande|aumentar tama[nñ]o|acercar|zoom in)/i.test(low)) {
    escala_producto = Math.min(1.5, Number((escala_producto + 0.18).toFixed(2)))
    acciones.push(`escalé el producto a ${Math.round(escala_producto * 100)}%`)
  } else if (/(achicar|m[aá]s peque[nñ]o|reducir tama[nñ]o|alejar|zoom out)/i.test(low)) {
    escala_producto = Math.max(0.6, Number((escala_producto - 0.18).toFixed(2)))
    acciones.push(`ajusté la escala del producto a ${Math.round(escala_producto * 100)}%`)
  }

  if (/(subir producto|m[aá]s arriba|elevar)/i.test(low)) {
    offset_y_producto = Math.max(-60, offset_y_producto - 16)
    acciones.push('subí la posición del producto')
  } else if (/(bajar producto|m[aá]s abajo)/i.test(low)) {
    offset_y_producto = Math.min(80, offset_y_producto + 16)
    acciones.push('bajé la posición del producto')
  } else if (/(centrar producto|restablecer posici[oó]n)/i.test(low)) {
    offset_y_producto = 0
    escala_producto = 1.0
    acciones.push('centré el producto en el escenario')
  }

  // 2. Detectar cambios de estilo visual / plantilla
  if (/(modo oferta|plantilla oferta|oferta marketplace|alto contraste|amarillo|descuento agresivo)/i.test(low)) {
    estilo = 'bold-retail'
    if (!badge || badge === 'EDICIÓN ESPECIAL') badge = 'OFERTA ESPECIAL'
    acciones.push('activé la plantilla Oferta Marketplace / Estados')
  } else if (/(lifestyle|escena ia|claro|luminoso|fondo minimalista claro|clean light)/i.test(low)) {
    estilo = 'clean-light'
    acciones.push('apliqué el estilo Escena Lifestyle IA')
  } else if (/(editorial|minimalista oscuro|minimal dark|sobrio|elegante)/i.test(low)) {
    estilo = 'minimal-dark'
    acciones.push('cambié al estilo Estudio Editorial')
  }

  // 3. Detectar cambios de titular
  const mTitulo =
    msg.match(/(?:t[ií]tulo|titular)\s*(?:a|por|:)?\s*["“']([^"”']+)["”']/i) ||
    msg.match(/(?:cambia(?:r)?\s+el\s+t[ií]tulo\s+a|pon(?:le)?\s+de\s+t[ií]tulo)\s+(.+?)(?:$|\s+y\s+|\.|,)/i)
  if (mTitulo && mTitulo[1]) {
    titular = mTitulo[1].trim().toUpperCase().slice(0, 60)
    acciones.push(`actualicé el titular a "${titular}"`)
  } else if (/edici[oó]n limitada/i.test(low)) {
    titular = 'EDICIÓN LIMITADA'
    acciones.push('actualicé el titular a "EDICIÓN LIMITADA"')
  }

  // 4. Detectar cambios de subtítulo
  const mSub =
    msg.match(/(?:subt[ií]tulo|descripci[oó]n)\s*(?:a|por|:)?\s*["“']([^"”']+)["”']/i) ||
    msg.match(/(?:cambia(?:r)?\s+el\s+subt[ií]tulo\s+a)\s+(.+?)(?:$|\.)/i)
  if (mSub && mSub[1]) {
    subtitulo = mSub[1].trim().slice(0, 120)
    acciones.push('actualicé el subtítulo')
  }

  // 5. Detectar descuentos, promociones o precios
  const mDescPct = low.match(/(\d{1,2})\s*%\s*(?:de\s+descuento|off|menos)/i)
  if (mDescPct) {
    const pct = parseInt(mDescPct[1], 10)
    badge = `${pct}% DESCUENTO`
    estilo = 'bold-retail'
    const numActual = parseFloat((precio || '350').replace(/[^0-9.]/g, '')) || 350
    const calcAnterior = Math.round(numActual / (1 - pct / 100))
    precio_anterior = String(calcAnterior)
    acciones.push(`apliqué el badge de ${pct}% de descuento`)
  } else if (/2x1/i.test(low)) {
    badge = 'PROMO 2x1 HOY'
    estilo = 'bold-retail'
    acciones.push('coloqué la etiqueta PROMO 2x1 HOY')
  } else if (/env[ií]o gratis/i.test(low)) {
    badge = 'ENVÍO GRATIS'
    acciones.push('destaqué ENVÍO GRATIS en la insignia superior')
  }

  const mPrecio = low.match(/(?:precio|cuesta|en|a)\s*\$?\s*(\d{2,6})(?:\s*mxn|\s*pesos)?/i)
  if (mPrecio && mPrecio[1]) {
    precio = mPrecio[1]
    acciones.push(`ajusté el precio a $${precio} MXN`)
  }

  if (/(quita(?:r)?\s+(?:el\s+)?precio|sin\s+precio|ocultar\s+precio)/i.test(low)) {
    precio = ''
    precio_anterior = ''
    acciones.push('oculté la etiqueta de precio del lienzo')
  }

  // 6. Detectar solicitud de cambio de fondo / escenario fotográfico IA
  const pideCambioFondo =
    /(fondo|escena|escenario|mesa|madera|m[aá]rmol|ne[oó]n|oscuro|claro|iluminaci[oó]n|luz|plantas|estudio|ambiente|podium|pedestal|textura|taller|oficina)/i.test(
      low
    )

  if (pideCambioFondo) {
    regenerar_fondo = true
    const prodContext = current.descripcion_producto || titular || 'commercial product'
    if (/(ne[oó]n|cyber|oscuro|dark|noche|gamer|led)/i.test(low)) {
      nuevo_prompt_fondo = `Dark luxury commercial studio tabletop for ${prodContext}, dramatic cyan and magenta neon rim lighting, matte black slate surface, soft bokeh background, professional product photography, empty center stage, NO text, 8k`
    } else if (/(madera|plantas|natural|c[aá]lido|artesanal|mesa)/i.test(low)) {
      nuevo_prompt_fondo = `Warm natural oak wood tabletop surface for ${prodContext}, soft golden sunlight shadows, blurred indoor tropical plants in background, editorial commercial photography, empty center foreground, NO text, 8k`
    } else if (/(minimalista claro|blanco|m[aá]rmol|luminoso|clean|editorial)/i.test(low)) {
      nuevo_prompt_fondo = `Bright minimalist architectural studio podium for ${prodContext}, white travertine stone surface, soft diffused daylight shadows, high-end magazine product photography, empty stage, NO text, 8k`
    } else {
      nuevo_prompt_fondo = `Professional commercial photography studio backdrop for ${prodContext}, inspired by: ${msg}. Clean foreground surface, soft studio lighting, shallow depth of field, NO text, NO watermark, 8k`
    }
    acciones.push('solicité la generación de un nuevo fondo fotográfico con IA')
  }

  const respuesta_chat =
    acciones.length > 0
      ? `¡Listo! En tu lienzo ${acciones.join(', ')}.`
      : 'He ajustado la composición del lienzo según tu indicación.'

  return {
    ok: true,
    respuesta_chat,
    titular,
    subtitulo,
    badge,
    precio,
    precio_anterior,
    estilo,
    escala_producto,
    offset_y_producto,
    regenerar_fondo,
    nuevo_prompt_fondo,
  }
}

export async function POST(req: NextRequest) {
  let body: { mensaje?: string; estado_actual?: CanvasStateInput } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Payload JSON inválido' }, { status: 400 })
  }

  const mensaje = (body.mensaje || '').trim()
  const rawState = body.estado_actual || {}

  const current: Required<CanvasStateInput> = {
    titular: (rawState.titular || 'EDICIÓN ESPECIAL').trim(),
    subtitulo: (rawState.subtitulo || 'Calidad superior y atención personalizada').trim(),
    badge: (rawState.badge || 'DESTACADO').trim(),
    precio:rawState.precio !== undefined ? String(rawState.precio).trim() : '',
    precio_anterior: rawState.precio_anterior !== undefined ? String(rawState.precio_anterior).trim() : '',
    estilo: normalizeStyle(rawState.estilo, 'minimal-dark'),
    escala_producto: typeof rawState.escala_producto === 'number' ? rawState.escala_producto : 1.0,
    offset_y_producto: typeof rawState.offset_y_producto === 'number' ? rawState.offset_y_producto : 0,
    prompt_fondo: (rawState.prompt_fondo || '').trim(),
    descripcion_producto: (rawState.descripcion_producto || '').trim(),
  }

  if (!mensaje) {
    return NextResponse.json({
      ...applyHeuristicDesignEdit('', current),
      respuesta_chat: 'Escribe qué cambio deseas aplicar al fondo, textos, precios o tamaño del producto.',
    })
  }

  const heuristicResult = applyHeuristicDesignEdit(mensaje, current)
  const apiKey = process.env.GEMINI_API_KEY || ''

  if (!apiKey) {
    return NextResponse.json(heuristicResult)
  }

  try {
    const ai = new GoogleGenAI({ apiKey })

    const systemPrompt = `Eres el Director de Arte IA en vivo de BLITZR Studio (lienzo publicitario 1080x1350 px formato 4:5).
El usuario te pide ajustes conversacionales sobre su anuncio.
Recibes el ESTADO ACTUAL del lienzo y la INSTRUCCIÓN DEL USUARIO.

REGLAS:
1. Estilos disponibles ("estilo"):
   - "minimal-dark": Estudio Editorial (elegante, fondo neutro/oscuro, tipografía moderna limpia).
   - "clean-light": Escena Lifestyle IA (luminoso, integrado sobre escena con degradado sutil).
   - "bold-retail": Oferta Marketplace / Estados (alto contraste con badge de promoción y precio destacado).
2. Si el usuario pide cambiar el fondo, escenario, mesa, iluminación, colores de ambiente o superficie:
   - Pon "regenerar_fondo": true
   - En "nuevo_prompt_fondo" escribe un prompt fotográfico comercial en inglés para generar el escenario vacío donde se posará el producto (${current.descripcion_producto || current.titular}), especificando iluminación, superficie y atmósfera ("commercial product photography studio stage, empty surface foreground, NO text, NO people, 8k").
3. Si el usuario solo cambia textos, precios, descuento, estilo o tamaño del producto:
   - Pon "regenerar_fondo": false
4. "escala_producto" debe estar entre 0.6 y 1.5. "offset_y_producto" entre -60 y 80.
5. Si el usuario pide quitar el precio, devuelve "precio": "" y "precio_anterior": "".

ESTADO ACTUAL:
${JSON.stringify(current)}

INSTRUCCIÓN DEL USUARIO:
"${mensaje}"

Devuelve ÚNICAMENTE un objeto JSON con estas llaves exactas:
{
  "respuesta_chat": "Confirmación breve y amigable en español de los cambios aplicados (1 oración)",
  "titular": "string en mayúsculas (máx 48 caracteres)",
  "subtitulo": "string persuasivo limpio (máx 110 caracteres)",
  "badge": "etiqueta corta superior (ej. EDICIÓN LIMITADA, 20% OFF, ENVÍO GRATIS)",
  "precio": "solo número o vacío si no aplica",
  "precio_anterior": "solo número o vacío",
  "estilo": "minimal-dark" | "clean-light" | "bold-retail",
  "escala_producto": number,
  "offset_y_producto": number,
  "regenerar_fondo": boolean,
  "nuevo_prompt_fondo": "string"
}`

    const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest']
    for (const modelName of models) {
      try {
        const response = await Promise.race([
          ai.models.generateContent({
            model: modelName,
            contents: systemPrompt,
            config: {
              responseMimeType: 'application/json',
              temperature: 0.25,
            },
          }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT_AI')), 7500)),
        ])

        const rawText = (response.text || '').trim()
        if (!rawText) continue
        const jsonMatch = rawText.match(/\{[\s\S]*\}/)
        const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawText)

        const escala = Number(parsed.escala_producto)
        const offsetY = Number(parsed.offset_y_producto)

        return NextResponse.json({
          ok: true,
          respuesta_chat: String(parsed.respuesta_chat || heuristicResult.respuesta_chat).trim(),
          titular: String(parsed.titular ?? heuristicResult.titular).trim().slice(0, 60),
          subtitulo: String(parsed.subtitulo ?? heuristicResult.subtitulo).trim().slice(0, 125),
          badge: String(parsed.badge ?? heuristicResult.badge).trim().slice(0, 28),
          precio: parsed.precio !== undefined ? String(parsed.precio).replace(/[^0-9.]/g, '') : heuristicResult.precio,
          precio_anterior:
            parsed.precio_anterior !== undefined
              ? String(parsed.precio_anterior).replace(/[^0-9.]/g, '')
              : heuristicResult.precio_anterior,
          estilo: normalizeStyle(parsed.estilo, heuristicResult.estilo),
          escala_producto: !isNaN(escala) ? Math.max(0.6, Math.min(1.5, escala)) : heuristicResult.escala_producto,
          offset_y_producto: !isNaN(offsetY) ? Math.max(-60, Math.min(80, offsetY)) : heuristicResult.offset_y_producto,
          regenerar_fondo: Boolean(parsed.regenerar_fondo || heuristicResult.regenerar_fondo),
          nuevo_prompt_fondo: String(
            parsed.nuevo_prompt_fondo || heuristicResult.nuevo_prompt_fondo || current.prompt_fondo
          ).trim(),
        })
      } catch {
        continue
      }
    }
  } catch (err) {
    console.warn('[editar-arte] Usando motor heurístico de respaldo:', err)
  }

  return NextResponse.json(heuristicResult)
}

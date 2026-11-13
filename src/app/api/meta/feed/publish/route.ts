import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // 1. Validar sesión del usuario a través de Supabase Auth
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

    // 2. Identificar el usuario en base de datos y consultar en Prisma la cuenta vinculada
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

    const igAccount = await prisma.socialAccount.findFirst({
      where: {
        userId: dbUser.id,
        provider: 'INSTAGRAM',
      },
    })

    if (!igAccount || !igAccount.accessToken) {
      return NextResponse.json(
        { success: false, error: 'No tienes una cuenta de Instagram Business vinculada.' },
        { status: 400 }
      )
    }

    // 3. Recibir payload JSON: { imageUrl, caption, publicationId }
    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, error: 'Cuerpo de la petición inválido. Se espera JSON.' },
        { status: 400 }
      )
    }

    const { imageUrl, caption, publicationId } = body || {}

    if (!imageUrl || typeof imageUrl !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Parámetro "imageUrl" requerido' },
        { status: 400 }
      )
    }

    const igAccountId = igAccount.platformId

    // 4. Paso 1: Crear Contenedor de Imagen en Meta
    const containerParams = new URLSearchParams({
      image_url: imageUrl,
      caption: typeof caption === 'string' ? caption : '',
      access_token: igAccount.accessToken,
    })

    const containerRes = await fetch(
      `https://graph.facebook.com/v19.0/${igAccountId}/media?${containerParams.toString()}`,
      { method: 'POST' }
    )

    const containerData = await containerRes.json()

    if (!containerData.id) {
      console.error('Meta Feed Container Error:', containerData)
      return NextResponse.json(
        {
          success: false,
          error: containerData.error?.message || 'Error al crear contenedor en Meta',
          details: containerData.error,
        },
        { status: 400 }
      )
    }

    // 5. Paso 2: Publicar Contenedor (Inmediato)
    const publishParams = new URLSearchParams({
      creation_id: containerData.id,
      access_token: igAccount.accessToken,
    })

    const publishRes = await fetch(
      `https://graph.facebook.com/v19.0/${igAccountId}/media_publish?${publishParams.toString()}`,
      { method: 'POST' }
    )

    const publishData = await publishRes.json()

    if (!publishData.id) {
      console.error('Meta Feed Media Publish Error:', publishData)
      return NextResponse.json(
        {
          success: false,
          error: publishData.error?.message || 'Error al publicar en Instagram',
          details: publishData.error,
        },
        { status: 400 }
      )
    }

    // 6. Actualizar registro en base de datos si publicationId existe
    if (publicationId && typeof publicationId === 'string') {
      try {
        await prisma.publication.update({
          where: { id: publicationId },
          data: { status: 'PUBLISHED' },
        })
      } catch (dbErr) {
        // Si publicationId no pertenece a la tabla Publication, se ignora de forma segura
        console.warn('Nota: publicationId no es de la tabla Publication o no se pudo actualizar:', dbErr)
      }
    }

    // 7. Retornar éxito
    return NextResponse.json({ success: true, publishId: publishData.id })
  } catch (error: unknown) {
    console.error('Error interno en /api/meta/feed/publish:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error interno del servidor',
      },
      { status: 500 }
    )
  }
}

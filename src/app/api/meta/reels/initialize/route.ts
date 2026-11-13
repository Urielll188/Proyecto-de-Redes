import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // 1. Autenticación: Validar sesión de Supabase
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

    // 2. Buscar credenciales de Instagram en Prisma
    const igAccount = await prisma.socialAccount.findFirst({
      where: { userId: dbUser.id, provider: 'INSTAGRAM' },
    })

    if (!igAccount || !igAccount.accessToken) {
      return NextResponse.json(
        { success: false, error: 'Cuenta de Instagram no vinculada' },
        { status: 400 }
      )
    }

    // 3. Payload: { videoUrl, caption, publicationId }
    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, error: 'Cuerpo de la petición inválido. Se espera JSON.' },
        { status: 400 }
      )
    }

    const { videoUrl, caption, publicationId } = body || {}

    if (!videoUrl || typeof videoUrl !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Parámetro "videoUrl" requerido' },
        { status: 400 }
      )
    }

    // 4. Crear Contenedor en Meta Graph API
    const igAccountId = igAccount.platformId
    const params = new URLSearchParams({
      media_type: 'REELS',
      video_url: videoUrl,
      caption: typeof caption === 'string' ? caption : '',
      access_token: igAccount.accessToken,
    })

    const metaRes = await fetch(
      `https://graph.facebook.com/v19.0/${igAccountId}/media?${params.toString()}`,
      { method: 'POST' }
    )

    const metaData = await metaRes.json()

    if (!metaRes.ok || metaData.error || !metaData.id) {
      console.error('Meta Reels Init Error:', metaData)
      return NextResponse.json(
        {
          success: false,
          error: metaData.error?.message || 'Error al crear contenedor en Meta Graph API',
          details: metaData.error,
        },
        { status: 502 }
      )
    }

    const containerId = metaData.id

    // 6. Actualizar Prisma si publicationId existe
    if (publicationId && typeof publicationId === 'string') {
      try {
        await prisma.publication.update({
          where: { id: publicationId },
          data: { metaContainerId: containerId, status: 'PROCESSING' },
        })
      } catch (dbErr) {
        console.warn('No se pudo actualizar publicación con metaContainerId:', dbErr)
      }
    }

    // 7. Retornar éxito con containerId
    return NextResponse.json({ success: true, containerId })
  } catch (error: unknown) {
    console.error('Error interno en /api/meta/reels/initialize:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error interno del servidor',
      },
      { status: 500 }
    )
  }
}

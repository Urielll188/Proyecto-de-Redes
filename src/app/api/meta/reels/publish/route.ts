import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // 1. Validar sesión del usuario
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

    const igAccount = await prisma.socialAccount.findFirst({
      where: { userId: dbUser.id, provider: 'INSTAGRAM' },
    })

    if (!igAccount || !igAccount.accessToken) {
      return NextResponse.json(
        { success: false, error: 'Cuenta de Instagram no vinculada' },
        { status: 400 }
      )
    }

    // 2. Recibir payload: { containerId, publicationId }
    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, error: 'Cuerpo de la petición inválido. Se espera JSON.' },
        { status: 400 }
      )
    }

    const { containerId, publicationId } = body || {}

    if (!containerId || typeof containerId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Parámetro "containerId" requerido' },
        { status: 400 }
      )
    }

    // 3. Disparar publicación oficial en Meta Graph API
    const igAccountId = igAccount.platformId
    const metaRes = await fetch(
      `https://graph.facebook.com/v19.0/${igAccountId}/media_publish?creation_id=${containerId}&access_token=${igAccount.accessToken}`,
      { method: 'POST' }
    )

    const metaData = await metaRes.json()

    if (!metaRes.ok || metaData.error || !metaData.id) {
      console.error('Meta Media Publish Error:', metaData)
      const errorMsg = metaData.error?.message || 'Error al publicar Reel en Meta'

      if (publicationId && typeof publicationId === 'string') {
        try {
          await prisma.publication.update({
            where: { id: publicationId },
            data: { status: 'FAILED', errorMessage: errorMsg },
          })
        } catch (dbErr) {
          console.warn('No se pudo actualizar estado a FAILED:', dbErr)
        }
      }

      return NextResponse.json(
        {
          success: false,
          error: errorMsg,
          details: metaData.error,
        },
        { status: 502 }
      )
    }

    const publishId = metaData.id

    // 5. Actualizar Prisma con estado PUBLISHED
    if (publicationId && typeof publicationId === 'string') {
      try {
        await prisma.publication.update({
          where: { id: publicationId },
          data: { status: 'PUBLISHED' },
        })
      } catch (dbErr) {
        console.warn('No se pudo actualizar estado a PUBLISHED:', dbErr)
      }
    }

    // 6. Retornar éxito
    return NextResponse.json({ success: true, publishId })
  } catch (error: unknown) {
    console.error('Error interno en /api/meta/reels/publish:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error interno del servidor',
      },
      { status: 500 }
    )
  }
}

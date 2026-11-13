import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // 1. Validar sesión del usuario con Supabase Auth
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

    // 2. Consultar credenciales de Facebook en Prisma
    const fbAccount = await prisma.socialAccount.findFirst({
      where: { userId: dbUser.id, provider: 'FACEBOOK' },
    })

    if (!fbAccount || !fbAccount.accessToken) {
      return NextResponse.json(
        { success: false, error: 'Página de Facebook no vinculada' },
        { status: 400 }
      )
    }

    // 3. Recibir payload JSON: { videoUrl, caption, publicationId }
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

    // 4. Petición a Meta Graph API (Delegación directa de video a Meta vía file_url)
    const fbPageId = fbAccount.platformId || (fbAccount as any).accountId

    const params = new URLSearchParams({
      file_url: videoUrl,
      description: typeof caption === 'string' ? caption : '',
      access_token: fbAccount.accessToken,
    })

    const fbRes = await fetch(
      `https://graph.facebook.com/v19.0/${fbPageId}/videos?${params.toString()}`,
      { method: 'POST' }
    )

    const fbData = await fbRes.json()

    if (!fbRes.ok || !fbData.id) {
      console.error('Meta Facebook Reels Error:', fbData)
      return NextResponse.json(
        {
          success: false,
          error: fbData.error?.message || 'Error al despachar video a Facebook',
          details: fbData.error,
        },
        { status: 400 }
      )
    }

    // 5. Sincronización en Prisma si publicationId existe
    if (publicationId && typeof publicationId === 'string') {
      try {
        await prisma.publication.update({
          where: { id: publicationId },
          data: { status: 'PUBLISHED' },
        })
      } catch (dbErr) {
        console.warn('No se pudo actualizar publicación en Prisma:', dbErr)
      }
    }

    // 6. Retornar éxito con fbVideoId
    return NextResponse.json({ success: true, fbVideoId: fbData.id })
  } catch (error: unknown) {
    console.error('Error interno en /api/meta/reels/facebook:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error interno del servidor',
      },
      { status: 500 }
    )
  }
}

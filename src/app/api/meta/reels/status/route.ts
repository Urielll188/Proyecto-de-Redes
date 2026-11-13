import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // 1. Recibir por query param: ?containerId=...
    const { searchParams } = new URL(request.url)
    const containerId = searchParams.get('containerId')

    if (!containerId) {
      return NextResponse.json(
        { success: false, error: 'Parámetro "containerId" es requerido' },
        { status: 400 }
      )
    }

    // 2. Validar sesión del usuario y obtener credenciales de Instagram
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

    // 3. Consultar a Meta Graph API
    const metaRes = await fetch(
      `https://graph.facebook.com/v19.0/${containerId}?fields=status_code,status&access_token=${igAccount.accessToken}`
    )

    const metaData = await metaRes.json()

    if (!metaRes.ok || metaData.error) {
      console.error('Meta Reels Status Error:', metaData)
      return NextResponse.json(
        {
          success: false,
          status: 'ERROR',
          error: metaData.error?.message || 'Error al consultar estado en Meta',
        },
        { status: 502 }
      )
    }

    // 4. Mapear status_code de Meta
    const rawStatusCode = (metaData.status_code || metaData.status || '').toUpperCase()

    if (rawStatusCode === 'FINISHED') {
      return NextResponse.json({ success: true, status: 'FINISHED' })
    }

    if (rawStatusCode === 'IN_PROGRESS' || rawStatusCode === 'PUBLISHED') {
      return NextResponse.json({ success: true, status: rawStatusCode })
    }

    if (rawStatusCode === 'ERROR' || rawStatusCode === 'EXPIRED') {
      return NextResponse.json({
        success: false,
        status: 'ERROR',
        error: 'Meta rechazó el video.',
      })
    }

    // Estado por defecto en progreso mientras Meta procesa
    return NextResponse.json({ success: true, status: rawStatusCode || 'IN_PROGRESS' })
  } catch (error: unknown) {
    console.error('Error interno en /api/meta/reels/status:', error)
    return NextResponse.json(
      {
        success: false,
        status: 'ERROR',
        error: error instanceof Error ? error.message : 'Error interno del servidor',
      },
      { status: 500 }
    )
  }
}

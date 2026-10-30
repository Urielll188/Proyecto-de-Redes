import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

interface TikTokTokenSuccessResponse {
  access_token: string
  expires_in: number
  open_id: string
  refresh_expires_in: number
  refresh_token: string
  scope: string
  token_type: string
}

interface TikTokTokenErrorResponse {
  error: string
  error_description: string
  log_id?: string
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  if (error) {
    console.error('TikTok OAuth cancelado o error recibido:', error, errorDescription)
    return NextResponse.redirect(new URL('/dashboard?error=tiktok_failed', request.url))
  }

  const storedState = request.cookies.get('tiktok_oauth_state')?.value
  if (!state || !storedState || state !== storedState) {
    console.error('Fallo de validación de estado CSRF en TikTok OAuth')
    return NextResponse.redirect(new URL('/dashboard?error=tiktok_failed', request.url))
  }

  if (!code) {
    console.error('Código de autorización ausente en callback de TikTok')
    return NextResponse.redirect(new URL('/dashboard?error=tiktok_failed', request.url))
  }

  // 1. Identificar al usuario autenticado actual mediante Supabase Auth
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    console.error('Usuario no autenticado al intentar vincular TikTok')
    return NextResponse.redirect(new URL('/login?error=unauthorized', request.url))
  }

  const dbUser = await prisma.user.findUnique({
    where: { supabaseAuthId: user.id },
    select: { id: true },
  })

  if (!dbUser) {
    console.error('Registro de usuario en Prisma no encontrado para el usuario autenticado')
    return NextResponse.redirect(new URL('/login?error=unauthorized', request.url))
  }

  const clientKey = process.env.TIKTOK_CLIENT_KEY!
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET!
  const redirectUri = process.env.TIKTOK_REDIRECT_URI!

  const tokenUrl = 'https://open.tiktokapis.com/v2/oauth/token/'
  const bodyParams = new URLSearchParams({
    client_key: clientKey,
    client_secret: clientSecret,
    code: code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  })

  try {
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cache-Control': 'no-cache',
      },
      body: bodyParams.toString(),
    })

    const data: TikTokTokenSuccessResponse | TikTokTokenErrorResponse = await tokenResponse.json()

    if ('error' in data && data.error) {
      console.error('Error al intercambiar token con TikTok:', data)
      return NextResponse.redirect(new URL('/dashboard?error=tiktok_failed', request.url))
    }

    const authData = data as TikTokTokenSuccessResponse

    // 2. Cálculo estricto de fechas de expiración
    const expiresAt = new Date(Date.now() + authData.expires_in * 1000)
    const refreshExpiresAt = new Date(Date.now() + authData.refresh_expires_in * 1000)

    // 3. Persistencia atómica en Prisma (SocialAccount)
    await prisma.socialAccount.upsert({
      where: {
        userId_provider_platformId: {
          userId: dbUser.id,
          provider: 'TIKTOK',
          platformId: authData.open_id,
        },
      },
      update: {
        accessToken: authData.access_token,
        refreshToken: authData.refresh_token,
        tokenExpires: expiresAt,
        refreshExpires: refreshExpiresAt,
        scope: authData.scope,
        isActive: true,
      },
      create: {
        userId: dbUser.id,
        provider: 'TIKTOK',
        platformId: authData.open_id,
        accountName: 'TikTok Account',
        accessToken: authData.access_token,
        refreshToken: authData.refresh_token,
        tokenExpires: expiresAt,
        refreshExpires: refreshExpiresAt,
        scope: authData.scope,
        isActive: true,
      },
    })

    // 4. Limpieza de cookie de state y redirección a dashboard
    const redirectResponse = NextResponse.redirect(new URL('/dashboard?status=tiktok_connected', request.url))
    redirectResponse.cookies.delete('tiktok_oauth_state')
    return redirectResponse
  } catch (err: any) {
    console.error('Error interno en callback de TikTok:', err)
    return NextResponse.redirect(new URL('/dashboard?error=tiktok_failed', request.url))
  }
}

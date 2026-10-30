import { NextResponse } from 'next/server'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

export async function GET() {
  const clientKey = process.env.TIKTOK_CLIENT_KEY
  const redirectUri = process.env.TIKTOK_REDIRECT_URI

  if (!clientKey || !redirectUri) {
    return NextResponse.json(
      { error: 'Faltan variables de entorno TIKTOK_CLIENT_KEY o TIKTOK_REDIRECT_URI' },
      { status: 500 }
    )
  }

  const csrfState = crypto.randomBytes(16).toString('hex')
  const scope = 'user.info.basic,video.upload'

  const authUrl = new URL('https://www.tiktok.com/v2/auth/authorize/')
  authUrl.searchParams.set('client_key', clientKey)
  authUrl.searchParams.set('scope', scope)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('state', csrfState)

  const response = NextResponse.redirect(authUrl.toString())
  response.cookies.set('tiktok_oauth_state', csrfState, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10, // 10 minutos
    path: '/',
  })

  return response
}

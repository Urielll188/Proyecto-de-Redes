import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

// Forzar ruta dinámica para que nunca se cachee la URL de redirección
export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  if (!user) {
    return NextResponse.redirect(new URL('/login', baseUrl))
  }

  const clientId = process.env.META_APP_ID
  if (!clientId) {
    return NextResponse.json({ error: 'META_APP_ID no configurado en .env.local' }, { status: 500 })
  }

  const redirectUri = baseUrl + '/api/auth/callback/meta'
  
  // Scopes válidos y autorizados por Meta (incluye pages_manage_posts)
  const scopes = [
    'public_profile',
    'pages_show_list',
    'pages_read_engagement',
    'pages_manage_posts',
    'business_management',
    'instagram_basic',
    'instagram_content_publish'
  ].join(',')

  const authUrl = "https://www.facebook.com/v21.0/dialog/oauth?client_id=" + clientId + "&redirect_uri=" + encodeURIComponent(redirectUri) + "&scope=" + encodeURIComponent(scopes) + "&response_type=code&state=" + user.id

  return NextResponse.redirect(authUrl)
}

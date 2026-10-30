import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  
  let next = requestUrl.searchParams.get('next') ?? '/dashboard'
  
  // Sanitización estricta contra Open Redirect (evita bypass con '//')
  if (!next.startsWith('/') || next.startsWith('//')) {
    next = '/dashboard'
  }

  const forwardedHost = request.headers.get('x-forwarded-host')
  const isLocalEnv = process.env.NODE_ENV === 'development'
  
  let origin = requestUrl.origin
  if (!isLocalEnv && forwardedHost) {
    origin = `https://${forwardedHost}`
  }

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
    
    console.error('Error intercambiando el código PKCE:', error.message)
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}

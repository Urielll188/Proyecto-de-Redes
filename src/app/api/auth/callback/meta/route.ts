import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const supabaseAuthId = searchParams.get('state')
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  if (error || !code || !supabaseAuthId) {
    console.error('Error de autorización en Meta:', error)
    return NextResponse.redirect(`${baseUrl}/dashboard/integrations?error=auth_cancelled`)
  }

  const dbUser = await prisma.user.findUnique({
    where: { supabaseAuthId },
    select: { id: true }
  })

  if (!dbUser) {
    return NextResponse.redirect(`${baseUrl}/dashboard/integrations?error=user_not_found`)
  }

  try {
    const clientId = process.env.META_APP_ID!
    const clientSecret = process.env.META_APP_SECRET!
    const redirectUri = `${baseUrl}/api/auth/callback/meta`

    // 1. Obtener User Token inicial
    const tokenUrl = `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${clientId}&client_secret=${clientSecret}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${code}`
    const tokenRes = await fetch(tokenUrl)
    const tokenData = await tokenRes.json()

    if (!tokenRes.ok || !tokenData.access_token) {
      throw new Error(tokenData.error?.message || 'Error al obtener token de Meta')
    }

    // 2. Extender a Long-Lived User Token (60 días)
    const longLivedUrl = `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${clientId}&client_secret=${clientSecret}&fb_exchange_token=${tokenData.access_token}`
    const longRes = await fetch(longLivedUrl)
    const longData = await longRes.json()
    const finalUserToken = longData.access_token || tokenData.access_token

    // 3. Intentar consultar /me/accounts tradicional
    const accountsUrl = `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${finalUserToken}`
    const accountsRes = await fetch(accountsUrl)
    const accountsData = await accountsRes.json()

    let pagesToSave: any[] = accountsData.data || []

    // 4. ESTRATEGIA DE RESCATE: Si /me/accounts devolvió [], extraer target_ids de debug_token
    if (pagesToSave.length === 0) {
      console.log('⚡ /me/accounts vino vacío. Activando rescate vía debug_token...')
      
      const appAccessToken = `${clientId}|${clientSecret}`
      const debugUrl = `https://graph.facebook.com/debug_token?input_token=${finalUserToken}&access_token=${appAccessToken}`
      const debugRes = await fetch(debugUrl)
      const debugData = await debugRes.json()

      const granularScopes = debugData.data?.granular_scopes || []
      console.log('Granular Scopes detectados:', JSON.stringify(granularScopes, null, 2))

      // Buscar todos los target_ids asignados a páginas
      const targetIdsSet = new Set<string>()
      for (const scopeObj of granularScopes) {
        if (scopeObj.target_ids && Array.isArray(scopeObj.target_ids)) {
          scopeObj.target_ids.forEach((id: string) => targetIdsSet.add(id))
        }
      }

      const targetIds = Array.from(targetIdsSet)
      console.log('IDs autorizados a rescatar:', targetIds)

      for (const targetId of targetIds) {
        try {
          const directPageRes = await fetch(
            `https://graph.facebook.com/v21.0/${targetId}?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${finalUserToken}`
          )
          const pageObj = await directPageRes.json()
          if (pageObj.id && !pageObj.error) {
            console.log(`✅ Página rescatada con éxito: ${pageObj.name} (${pageObj.id})`)
            pagesToSave.push(pageObj)
          } else {
            console.warn(`No se pudo resolver target ${targetId}:`, pageObj.error?.message)
          }
        } catch (fetchErr) {
          console.warn(`Error en fetch directo de ${targetId}:`, fetchErr)
        }
      }
    }

    console.log(`💾 Total de páginas a guardar en Prisma: ${pagesToSave.length}`)

    // 5. Guardar en la base de datos
    for (const page of pagesToSave) {
      // Guardar Página de Facebook
      await prisma.socialAccount.upsert({
        where: {
          userId_provider_platformId: {
            userId: dbUser.id,
            provider: 'FACEBOOK',
            platformId: page.id
          }
        },
        update: {
          accountName: page.name,
          accessToken: page.access_token || finalUserToken,
          isActive: true
        },
        create: {
          userId: dbUser.id,
          provider: 'FACEBOOK',
          platformId: page.id,
          accountName: page.name,
          accessToken: page.access_token || finalUserToken,
          isActive: true
        }
      })

      // Guardar Instagram si está vinculado
      if (page.instagram_business_account) {
        const ig = page.instagram_business_account
        await prisma.socialAccount.upsert({
          where: {
            userId_provider_platformId: {
              userId: dbUser.id,
              provider: 'INSTAGRAM',
              platformId: ig.id
            }
          },
          update: {
            accountName: ig.username ? `@${ig.username}` : page.name,
            accessToken: page.access_token || finalUserToken,
            isActive: true
          },
          create: {
            userId: dbUser.id,
            provider: 'INSTAGRAM',
            platformId: ig.id,
            accountName: ig.username ? `@${ig.username}` : page.name,
            accessToken: page.access_token || finalUserToken,
            isActive: true
          }
        })
        console.log(`📸 Instagram rescatado y guardado: @${ig.username || ig.id}`)
      }
    }

    return NextResponse.redirect(`${baseUrl}/dashboard/integrations?success=connected`)
  } catch (err: any) {
    console.error('Error crítico en callback de Meta:', err)
    return NextResponse.redirect(`${baseUrl}/dashboard/integrations?error=${encodeURIComponent(err.message || 'processing_failed')}`)
  }
}

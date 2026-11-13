import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import sharp from 'sharp'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function getInstagramCompliantImageUrl(
  originalUrl: string,
  userId: string,
  supabase: any
): Promise<string> {
  try {
    const res = await fetch(originalUrl)
    if (!res.ok) return originalUrl

    const arrayBuffer = await res.arrayBuffer()
    const inputBuffer = Buffer.from(arrayBuffer)

    const metadata = await sharp(inputBuffer).metadata()
    if (!metadata.width || !metadata.height) return originalUrl

    const ratio = metadata.width / metadata.height

    // Meta permite ratios entre 4:5 (0.8) y 1.91:1
    if (ratio >= 0.8 && ratio <= 1.91) {
      return originalUrl
    }

    const normalizedBuffer = await sharp(inputBuffer)
      .resize(1080, 1080, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .jpeg({ quality: 90 })
      .toBuffer()

    const fileName = `${userId}/instagram_norm_${Date.now()}.jpg`
    let bucket = 'product-images'
    let { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(fileName, normalizedBuffer, {
        contentType: 'image/jpeg',
        upsert: true,
      })

    if (uploadError) {
      bucket = 'blitzr-vault'
      const fallback = await supabase.storage
        .from(bucket)
        .upload(fileName, normalizedBuffer, {
          contentType: 'image/jpeg',
          upsert: true,
        })
      uploadError = fallback.error
    }

    if (uploadError) {
      return originalUrl
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(fileName)

    return publicUrl || originalUrl
  } catch {
    return originalUrl
  }
}

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

    // 2. Identificar el usuario en base de datos y consultar en Prisma las cuentas vinculadas
    const dbUser = await prisma.user.findUnique({
      where: { supabaseAuthId: user.id },
      include: {
        socialAccounts: {
          where: { isActive: true },
        },
      },
    })

    if (!dbUser) {
      return NextResponse.json(
        { success: false, error: 'Usuario no registrado en la base de datos' },
        { status: 401 }
      )
    }

    const igAccount = dbUser.socialAccounts.find((a) => a.provider === 'INSTAGRAM')
    const fbAccount = dbUser.socialAccounts.find((a) => a.provider === 'FACEBOOK')

    if ((!igAccount || !igAccount.accessToken) && (!fbAccount || !fbAccount.accessToken)) {
      return NextResponse.json(
        { success: false, error: 'No tienes una cuenta de Instagram Business ni Página de Facebook vinculada.' },
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

    let igPostId: string | undefined
    let fbPostId: string | undefined
    const errors: string[] = []

    // 4. Publicación en Instagram Business (con normalización de Aspect Ratio + Sondeo Activo)
    if (igAccount?.accessToken && igAccount.platformId) {
      const igSafeUrl = await getInstagramCompliantImageUrl(imageUrl, dbUser.id, supabase)

      const containerParams = new URLSearchParams({
        image_url: igSafeUrl,
        caption: typeof caption === 'string' ? caption : '',
        access_token: igAccount.accessToken,
      })

      const containerRes = await fetch(
        `https://graph.facebook.com/v21.0/${igAccount.platformId}/media`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: containerParams,
        }
      )

      const containerData = await containerRes.json()

      if (!containerData.id) {
        console.error('Meta Feed Container Error:', containerData)
        errors.push(`Instagram: ${containerData.error?.message || 'Error al crear contenedor en Meta'}`)
      } else {
        const creationId = containerData.id
        let isReady = false
        const delay = (ms: number) => new Promise((res) => setTimeout(res, ms))

        for (let attempt = 1; attempt <= 10; attempt++) {
          await delay(1500)
          const statusRes = await fetch(
            `https://graph.facebook.com/v21.0/${creationId}?fields=status_code,status&access_token=${igAccount.accessToken}`
          )
          const statusData = await statusRes.json()
          if (statusData.status_code === 'FINISHED' || !statusData.status_code) {
            isReady = true
            break
          }
          if (statusData.status_code === 'ERROR' || statusData.status_code === 'EXPIRED') {
            errors.push(`Instagram: ${statusData.status || 'Meta rechazó el contenedor de imagen'}`)
            break
          }
        }

        if (isReady) {
          const publishRes = await fetch(
            `https://graph.facebook.com/v21.0/${igAccount.platformId}/media_publish`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                creation_id: creationId,
                access_token: igAccount.accessToken,
              }),
            }
          )
          const publishData = await publishRes.json()
          if (publishData.id) {
            igPostId = publishData.id
          } else {
            errors.push(`Instagram: ${publishData.error?.message || 'Error al publicar en Instagram'}`)
          }
        }
      }
    }

    // 5. Publicación simultánea en Página de Facebook (si está vinculada)
    if (fbAccount?.accessToken && fbAccount.platformId) {
      try {
        const fbRes = await fetch(
          `https://graph.facebook.com/v21.0/${fbAccount.platformId}/photos`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              url: imageUrl,
              caption: typeof caption === 'string' ? caption : '',
              access_token: fbAccount.accessToken,
            }),
          }
        )
        const fbData = await fbRes.json()
        if (fbData.id || fbData.post_id) {
          fbPostId = fbData.id || fbData.post_id
        } else {
          errors.push(`Facebook: ${fbData.error?.message || 'No se pudo publicar en Facebook Page'}`)
        }
      } catch (fbErr: any) {
        errors.push(`Facebook: ${fbErr?.message || 'Error de red'}`)
      }
    }

    if (!igPostId && !fbPostId) {
      return NextResponse.json(
        {
          success: false,
          error: errors.join(' | ') || 'No se pudo completar la publicación en Meta',
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
      } catch {
        // publicationId puede pertenecer a ContentVault, ignorar silenciosamente
      }
    }

    // 7. Retornar éxito
    return NextResponse.json({
      success: true,
      publishId: igPostId || fbPostId,
      igPostId,
      fbPostId,
    })
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

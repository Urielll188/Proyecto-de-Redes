'use server'

import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import sharp from 'sharp'

interface PublishOptions {
  contentId?: string
  manualImageUrl?: string
  manualCaption?: string
  postType?: 'feed' | 'story'
}

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
      return originalUrl // Ya cumple las reglas de Meta
    }

    console.log(`⚠️ Aspect ratio (${ratio.toFixed(2)}) no admitido por Instagram. Normalizando a 1080x1080 con padding blanco...`)

    const normalizedBuffer = await sharp(inputBuffer)
      .resize(1080, 1080, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .jpeg({ quality: 90 })
      .toBuffer()

    const fileName = `${userId}/instagram_norm_${Date.now()}.jpg`
    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(fileName, normalizedBuffer, {
        contentType: 'image/jpeg',
        upsert: true
      })

    if (uploadError) {
      console.warn('Error subiendo imagen normalizada a Supabase:', uploadError)
      return originalUrl
    }

    const { data: { publicUrl } } = supabase.storage
      .from('product-images')
      .getPublicUrl(fileName)

    return publicUrl
  } catch (err) {
    console.warn('Fallo en procesamiento de imagen con sharp:', err)
    return originalUrl
  }
}

export async function publishPostAction(options: PublishOptions) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, message: 'Sesión no válida o expirada.' }
    }

    const dbUser = await prisma.user.findUnique({
      where: { supabaseAuthId: user.id },
      include: { 
        socialAccounts: {
          where: { isActive: true }
        }
      }
    })

    if (!dbUser || dbUser.socialAccounts.length === 0) {
      return { success: false, message: 'No tienes canales sociales conectados en /dashboard/integrations.' }
    }

    // 1. Determinar imagen y caption (desde Bóveda o parámetros manuales)
    let imageUrl = options.manualImageUrl
    let caption = options.manualCaption

    if (options.contentId) {
      const vaultItem = await prisma.contentVault.findUnique({
        where: { id: options.contentId, userId: dbUser.id }
      })
      if (vaultItem) {
        imageUrl = vaultItem.bannerUrl || vaultItem.imageUrl || undefined
        caption = vaultItem.instagramCopy || vaultItem.topic
      }
    }

    if (!imageUrl) {
      return { success: false, message: 'Se requiere una imagen con URL pública para publicar en Instagram.' }
    }

    const igAccount = dbUser.socialAccounts.find(a => a.provider === 'INSTAGRAM')
    const fbAccount = dbUser.socialAccounts.find(a => a.provider === 'FACEBOOK')

    let igPostId: string | undefined
    let fbPostId: string | undefined
    const messages: string[] = []

    // 2. DISPARO A INSTAGRAM BUSINESS (Con Sondeo Activo / Polling)
    if (igAccount?.accessToken && igAccount.platformId) {
      // Normalización automática para garantizar ratio compatible con Instagram
      const igSafeImageUrl = await getInstagramCompliantImageUrl(imageUrl, dbUser.id, supabase)
      const isStory = options.postType === 'story'

      console.log(`🔗 [META URL]: Enviando a Instagram (${isStory ? 'HISTORIA' : 'FEED'}):`, igSafeImageUrl)

      // Parámetros de Instagram: Si es historia, media_type = 'STORIES' y NO se envía caption
      const containerParams: Record<string, string> = {
        image_url: igSafeImageUrl,
        access_token: igAccount.accessToken
      }

      if (isStory) {
        containerParams.media_type = 'STORIES'
      } else {
        containerParams.caption = caption || ''
      }

      // Paso A: Crear contenedor
      const containerUrl = `https://graph.facebook.com/v21.0/${igAccount.platformId}/media`
      const containerRes = await fetch(containerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(containerParams)
      })
      const containerData = await containerRes.json()

      if (!containerRes.ok || !containerData.id) {
        console.error('❌ Error Instagram Media Container:', containerData)
        messages.push(`Instagram: ${containerData.error?.message || 'Error al crear contenedor'}`)
      } else {
        const creationId = containerData.id
        console.log(`⏳ Contenedor creado (${creationId}). Verificando estado en Meta...`)

        // Sondeo activo de procesamiento
        let isReady = false
        let attempts = 0
        const maxAttempts = 10 // Hasta 15 segundos máx
        const delay = (ms: number) => new Promise(res => setTimeout(res, ms))

        while (!isReady && attempts < maxAttempts) {
          attempts++
          await delay(1500) // Esperar 1.5s entre chequeos

          const statusRes = await fetch(
            `https://graph.facebook.com/v21.0/${creationId}?fields=status_code,status&access_token=${igAccount.accessToken}`
          )
          const statusData = await statusRes.json()
          console.log(`Intento ${attempts}: status_code =`, statusData.status_code)

          if (statusData.status_code === 'FINISHED') {
            isReady = true
            break
          } else if (statusData.status_code === 'ERROR') {
            console.error('❌ Error de procesamiento en Meta:', statusData)
            throw new Error(`Meta rechazó la imagen: ${statusData.status || 'Formato o URL no accesible'}`)
          } else if (statusData.status_code === 'EXPIRED') {
            throw new Error('El contenedor de imagen expiró antes de publicarse')
          }
        }

        if (!isReady) {
          throw new Error('Meta tardó demasiado procesando la imagen. Intenta de nuevo.')
        }

        // Paso B: Publicar contenedor confirmado
        const publishUrl = `https://graph.facebook.com/v21.0/${igAccount.platformId}/media_publish`
        const publishRes = await fetch(publishUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            creation_id: creationId,
            access_token: igAccount.accessToken
          })
        })
        const publishData = await publishRes.json()

        if (publishRes.ok && publishData.id) {
          igPostId = publishData.id
          console.log('✅ Publicado exitosamente en Instagram. Post ID:', publishData.id)
          messages.push('¡Publicado en Instagram con éxito!')
        } else {
          console.error('❌ Error Instagram Publish:', publishData)
          messages.push(`Instagram: ${publishData.error?.message || 'Error al publicar contenedor'}`)
        }
      }
    }

    // 3. DISPARO A PÁGINA DE FACEBOOK
    if (fbAccount?.accessToken && fbAccount.platformId) {
      try {
        console.log(`🚀 Disparando a Facebook Page (${fbAccount.platformId})...`)
        const fbUrl = `https://graph.facebook.com/v21.0/${fbAccount.platformId}/photos`
        const fbRes = await fetch(fbUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            url: imageUrl,
            caption: caption || '',
            access_token: fbAccount.accessToken
          })
        })
        const fbData = await fbRes.json()

        if (fbRes.ok && (fbData.id || fbData.post_id)) {
          fbPostId = fbData.id || fbData.post_id
          console.log('✅ Publicado exitosamente en Facebook Page. Post ID:', fbPostId)
          messages.push('¡Publicado en Facebook Page con éxito!')
        } else {
          console.error('❌ Error de respuesta en Facebook Page:', fbData)
          messages.push(`Facebook: ${fbData.error?.message || 'Permiso insuficiente para publicar en la página'}`)
        }
      } catch (fbErr: any) {
        console.error('❌ Fallo de red publicando en Facebook:', fbErr.message)
        messages.push(`Facebook: ${fbErr.message}`)
      }
    }

    const anySuccess = Boolean(igPostId || fbPostId)

    return {
      success: anySuccess,
      message: messages.join(' | ') || 'No se pudo completar el despacho',
      igPostId,
      fbPostId
    }
  } catch (err: any) {
    console.error('Excepción en publishPostAction:', err)
    return { success: false, message: err.message || 'Error interno del servidor al publicar.' }
  }
}

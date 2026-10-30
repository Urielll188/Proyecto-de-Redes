import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { getValidTikTokAccessToken, TikTokTokenRefreshError } from '@/lib/tiktok/token-service'
import { createPublicationRecord, updatePublicationStatus } from '@/lib/publications/publication-service'
import { PublishStatus, SocialPlatform } from '@prisma/client'

export const dynamic = 'force-dynamic'

interface TikTokInitResponse {
  data?: {
    publish_id: string
    upload_url: string
  }
  error?: {
    code: string
    message: string
    log_id: string
  }
}

interface PublishSuccessPayload {
  success: true
  publish_id: string
  publication_id: string
  message: string
}

interface PublishErrorPayload {
  success: false
  error: string
  details?: unknown
}

export async function POST(request: NextRequest) {
  let publicationId: string | null = null

  try {
    // PASO 1: Autenticación de Sesión (Gate de Seguridad)
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json<PublishErrorPayload>(
        { success: false, error: 'No autorizado: Inicia sesión para continuar' },
        { status: 401 }
      )
    }

    const dbUser = await prisma.user.findUnique({
      where: { supabaseAuthId: user.id },
      select: { id: true },
    })

    if (!dbUser) {
      return NextResponse.json<PublishErrorPayload>(
        { success: false, error: 'Usuario no registrado en la base de datos' },
        { status: 401 }
      )
    }

    // PASO 2: Extracción y Validación del Payload JSON
    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json<PublishErrorPayload>(
        { success: false, error: 'Cuerpo de la petición inválido. Se espera JSON.' },
        { status: 400 }
      )
    }

    const { videoUrl, storagePath, fileSize, title } = body || {}
    const postTitle = (typeof title === 'string' && title.trim()) || 'Borrador sin título'

    if (!videoUrl || typeof videoUrl !== 'string') {
      return NextResponse.json<PublishErrorPayload>(
        { success: false, error: 'Parámetro "videoUrl" ausente o no válido en el cuerpo de la petición' },
        { status: 400 }
      )
    }

    if (!storagePath || typeof storagePath !== 'string') {
      return NextResponse.json<PublishErrorPayload>(
        { success: false, error: 'Parámetro "storagePath" ausente o no válido en el cuerpo de la petición' },
        { status: 400 }
      )
    }

    // PASO 3: Descarga del Buffer desde Supabase (Servidor a Servidor)
    const videoRes = await fetch(videoUrl)
    if (!videoRes.ok) {
      return NextResponse.json<PublishErrorPayload>(
        {
          success: false,
          error: `No se pudo descargar el video desde la URL provista (HTTP ${videoRes.status})`,
        },
        { status: 422 }
      )
    }

    const arrayBuffer = await videoRes.arrayBuffer()
    const videoBuffer = Buffer.from(arrayBuffer)
    const videoSize = videoBuffer.byteLength

    if (videoSize === 0) {
      return NextResponse.json<PublishErrorPayload>(
        { success: false, error: 'El archivo de video descargado está vacío' },
        { status: 400 }
      )
    }

    // PASO 4: Registro de Auditoría en Prisma (Estado PENDING)
    const publication = await createPublicationRecord({
      userId: dbUser.id,
      title: typeof title === 'string' && title.trim() ? title.trim() : undefined,
      storagePath,
      publicUrl: videoUrl,
      fileSize: typeof fileSize === 'number' ? fileSize : videoSize,
      platforms: [SocialPlatform.TIKTOK],
      status: PublishStatus.PENDING,
    })
    publicationId = publication.id

    // PASO 5: Obtención de Token Válido (Rotación Automática / Blindada)
    const accessToken = await getValidTikTokAccessToken(dbUser.id)

    // PASO 6: Inicialización en TikTok API (/v2/post/publish/inbox/video/init/)
    const initRes = await fetch('https://open.tiktokapis.com/v2/post/publish/inbox/video/init/', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({
        source_info: {
          source: 'FILE_UPLOAD',
          video_size: videoSize,
          chunk_size: videoSize,
          total_chunk_count: 1,
        },
      }),
    })

    const initData = (await initRes.json()) as TikTokInitResponse

    if (!initRes.ok || initData.error?.code !== 'ok' || !initData.data?.upload_url) {
      const errorMsg = initData.error?.message || 'Fallo al inicializar subida con TikTok'
      console.error('TikTok Init Error:', initData)
      await updatePublicationStatus(publicationId, {
        status: PublishStatus.FAILED,
        errorMessage: errorMsg,
      })
      return NextResponse.json<PublishErrorPayload>(
        {
          success: false,
          error: 'Fallo al inicializar subida con TikTok',
          details: initData.error || initData,
        },
        { status: 502 }
      )
    }

    const { upload_url, publish_id } = initData.data

    // PASO 7: Transferencia Binaria Directa (PUT Chunk hacia TikTok)
    const uploadRes = await fetch(upload_url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': videoSize.toString(),
        'Content-Range': `bytes 0-${videoSize - 1}/${videoSize}`,
      },
      body: videoBuffer,
    })

    if (uploadRes.status < 200 || uploadRes.status > 204) {
      const errText = await uploadRes.text()
      const errorMsg = `Error al transferir los bytes a TikTok (HTTP ${uploadRes.status}): ${errText}`
      console.error('TikTok Binary Upload Error:', uploadRes.status, errText)
      await updatePublicationStatus(publicationId, {
        status: PublishStatus.FAILED,
        errorMessage: errorMsg,
      })
      return NextResponse.json<PublishErrorPayload>(
        {
          success: false,
          error: 'Error al transferir los bytes a los servidores de TikTok',
          details: errText,
        },
        { status: 502 }
      )
    }

    // PASO 8: Actualización de Estado a PUBLISHED
    await updatePublicationStatus(publicationId, {
      status: PublishStatus.PUBLISHED,
      tiktokPublishId: publish_id,
    })

    return NextResponse.json<PublishSuccessPayload>({
      success: true,
      publish_id,
      publication_id: publicationId,
      message: `Video "${postTitle}" enviado exitosamente como borrador a tu cuenta de TikTok.`,
    })
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Error interno del servidor'

    if (publicationId) {
      try {
        await updatePublicationStatus(publicationId, {
          status: PublishStatus.FAILED,
          errorMessage: errorMsg,
        })
      } catch (dbErr) {
        console.error('Error al actualizar estado de publicación a FAILED en catch:', dbErr)
      }
    }

    if (error instanceof TikTokTokenRefreshError) {
      return NextResponse.json<PublishErrorPayload>(
        {
          success: false,
          error: 'Sesión de TikTok expirada. Por favor reconecta tu cuenta.',
          details: error.details,
        },
        { status: error.statusCode }
      )
    }

    console.error('Error no controlado en /api/tiktok/publish:', error)
    return NextResponse.json<PublishErrorPayload>(
      {
        success: false,
        error: errorMsg,
      },
      { status: 500 }
    )
  }
}

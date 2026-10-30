export interface SharePayload {
  title: string
  text: string
  file?: File | null
  fileUrl?: string
}

const MAX_BLOB_SIZE = 40 * 1024 * 1024 // 40 MB límite de seguridad

export async function prepareShareableFile(fileUrl: string, fileName?: string): Promise<File | null> {
  if (typeof window === 'undefined') return null
  try {
    const res = await fetch(fileUrl, { mode: 'cors' })
    if (!res.ok) return null
    const blob = await res.blob()
    
    if (blob.size > MAX_BLOB_SIZE) {
      console.warn('Archivo > 40MB. Se compartirá como enlace.')
      return null
    }

    const cleanUrl = fileUrl.split('?')[0].toLowerCase()
    const ext = fileName?.split('.').pop()?.toLowerCase() || cleanUrl.split('.').pop() || 'mp4'

    let mimeType = blob.type
    if (!mimeType || mimeType === 'application/octet-stream') {
      if (ext.match(/mov|quicktime/)) {
        mimeType = 'video/quicktime'
      } else if (ext.match(/mp4/)) {
        mimeType = 'video/mp4'
      } else if (ext.match(/webm/)) {
        mimeType = 'video/webm'
      } else if (ext.match(/jpe?g/)) {
        mimeType = 'image/jpeg'
      } else if (ext.match(/png/)) {
        mimeType = 'image/png'
      } else if (ext.match(/webp/)) {
        mimeType = 'image/webp'
      } else {
        mimeType = 'video/mp4'
      }
    } else if (ext.match(/mov|quicktime/) && !mimeType.includes('quicktime') && !mimeType.includes('mp4')) {
      mimeType = 'video/quicktime'
    }

    return new File([blob], fileName || `blitzr-post.${ext}`, { type: mimeType })
  } catch (error) {
    console.warn('Error precargando archivo:', error)
    return null
  }
}

export async function triggerNativeShare(payload: SharePayload): Promise<{
  success: boolean
  mode: 'native-file' | 'native-link' | 'clipboard-fallback'
  message: string
}> {
  // 1. Asegurar texto en portapapeles
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(payload.text)
    } catch (e) {
      console.warn('Portapapeles no accesible:', e)
    }
  }

  // 2. Web Share API con archivo binario (Móvil nativo)
  if (
    typeof navigator !== 'undefined' &&
    navigator.share &&
    payload.file &&
    navigator.canShare &&
    navigator.canShare({ files: [payload.file] })
  ) {
    try {
      await navigator.share({
        title: payload.title,
        text: payload.text,
        files: [payload.file],
      })
      return {
        success: true,
        mode: 'native-file',
        message: '¡Abierto en WhatsApp/Redes! Recuerda pegar el texto copiado si tu teléfono no lo insertó automáticamente.',
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('Share API Error:', err)
      }
    }
  }

  // 3. Fallback Web Share API: Solo texto y enlace
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      const shareText = payload.fileUrl 
        ? `${payload.text}\n\nDescarga el contenido aquí: ${payload.fileUrl}`
        : payload.text
      await navigator.share({ title: payload.title, text: shareText })
      return {
        success: true,
        mode: 'native-link',
        message: 'Enlace enviado al menú de compartir nativo.',
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('Share API Error (text):', err)
      }
    }
  }

  // 4. Fallback Desktop: Descarga forzada del archivo
  if (payload.fileUrl && typeof document !== 'undefined') {
    const a = document.createElement('a')
    a.href = payload.fileUrl
    a.download = payload.file?.name || 'blitzr-descarga'
    a.target = '_blank'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return {
    success: false,
    mode: 'clipboard-fallback',
    message: 'Texto copiado al portapapeles y archivo descargado en tu equipo.',
  }
}

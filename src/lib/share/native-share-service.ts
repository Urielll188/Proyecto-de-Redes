export interface SharePayload {
  title: string
  text: string
  file?: File | null
  fileUrl?: string
}

const MAX_BLOB_SIZE = 15 * 1024 * 1024 // 15 MB límite estricto para RAM móvil

/**
 * Pre-descarga remota para tener el File listo en memoria antes del clic del usuario
 * evitando que Safari cancele navigator.share por pérdida de 'user gesture'.
 */
export async function prepareShareableFile(fileUrl: string, fileName?: string): Promise<File | null> {
  if (typeof window === 'undefined') return null
  try {
    const res = await fetch(fileUrl, { mode: 'cors' })
    if (!res.ok) return null
    const blob = await res.blob()

    if (blob.size > MAX_BLOB_SIZE) {
      console.warn('El archivo excede los 15MB. Se compartirá como enlace de texto.')
      return null
    }

    const ext = fileName?.split('.').pop() || 'jpg'
    const mimeType = blob.type || (ext.match(/jpg|jpeg|png/) ? `image/${ext}` : 'video/mp4')
    return new File([blob], fileName || `blitzr-post.${ext}`, { type: mimeType })
  } catch (error) {
    console.warn('No se pudo precargar el archivo para compartir:', error)
    return null
  }
}

/**
 * Ejecuta el compartir nativo de forma síncrona al evento clic
 */
export async function triggerNativeShare(payload: SharePayload): Promise<{
  success: boolean
  mode: 'native-file' | 'native-link' | 'clipboard-fallback'
  message: string
}> {
  // 1. Asegurar el texto en el portapapeles primero
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(payload.text)
    } catch (e) {
      console.warn('Acceso al portapapeles denegado o no disponible:', e)
    }
  }

  // 2. Intento de Web Share API con Archivo adjunto (móvil compatible)
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
        message: '¡Abierto en tu app! Recuerda pegar el texto del portapapeles si tu teléfono no lo adjuntó automáticamente.',
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('Error en navigator.share (files):', err)
      }
    }
  }

  // 3. Fallback Web Share API: Solo texto y enlace
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      const shareText = payload.fileUrl
        ? `${payload.text}\n\nDescarga el contenido aquí: ${payload.fileUrl}`
        : payload.text
      await navigator.share({
        title: payload.title,
        text: shareText,
      })
      return {
        success: true,
        mode: 'native-link',
        message: 'Enlace y texto enviados al menú de compartir.',
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('Error en navigator.share (text):', err)
      }
    }
  }

  // 4. Fallback Desktop Total: Forzar descarga y notificar
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

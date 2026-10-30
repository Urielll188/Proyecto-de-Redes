import { createClient } from '@/utils/supabase/client'

export interface VaultUploadResponse {
  path: string
  publicUrl: string
}

export async function uploadVideoToVault(file: File): Promise<VaultUploadResponse> {
  const supabase = createClient()

  // 1. Validar sesión del usuario en el navegador
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error('Debes iniciar sesión para subir contenido a la bóveda.')
  }

  // 2. Sanitizar nombre y generar ruta única con UUID
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
  const uniqueId =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().slice(0, 8)
      : Date.now()
  const filePath = `${user.id}/${uniqueId}-${sanitizedName}`

  // 3. Subida directa navegador -> Supabase Storage (blitzr-vault)
  const { data, error } = await supabase.storage
    .from('blitzr-vault')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type || 'video/mp4',
    })

  if (error) {
    console.error('❌ [STORAGE UPLOAD ERROR]:', error.message)
    throw new Error(`Fallo al subir archivo a la bóveda: ${error.message}`)
  }

  // 4. Obtener URL pública directa
  const { data: publicData } = supabase.storage
    .from('blitzr-vault')
    .getPublicUrl(data.path)

  if (!publicData?.publicUrl) {
    throw new Error('No se pudo generar la URL pública del video.')
  }

  return {
    path: data.path,
    publicUrl: publicData.publicUrl,
  }
}

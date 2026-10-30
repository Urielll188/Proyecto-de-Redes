import { prisma } from '@/lib/prisma'

interface TikTokRefreshResponse {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  refresh_expires_in?: number
  open_id?: string
  scope?: string
  error?: string
  error_description?: string
  log_id?: string
}

export class TikTokTokenRefreshError extends Error {
  public statusCode: number
  public details?: unknown

  constructor(message: string, statusCode: number = 401, details?: unknown) {
    super(message)
    this.name = 'TikTokTokenRefreshError'
    this.statusCode = statusCode
    this.details = details
  }
}

/**
 * Obtiene un Access Token de TikTok válido para el usuario.
 * Si el token está expirado o próximo a expirar (< 5 minutos), lo refresca de forma transparente contra TikTok
 * y persiste las nuevas credenciales en Prisma.
 */
export async function getValidTikTokAccessToken(userId: string): Promise<string> {
  // 1. Consistencia de Variables de Entorno
  const clientKey = process.env.TIKTOK_CLIENT_KEY
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET

  if (!clientKey || !clientSecret) {
    throw new TikTokTokenRefreshError(
      'Variables de entorno de TikTok no configuradas en el servidor.',
      500
    )
  }

  // 2. Buscar en Prisma la cuenta activa de TikTok vinculada al usuario
  const account = await prisma.socialAccount.findFirst({
    where: { userId, provider: 'TIKTOK', isActive: true },
  })

  if (!account || !account.accessToken) {
    throw new TikTokTokenRefreshError(
      'No se encontró una cuenta de TikTok vinculada o activa para este usuario.',
      401
    )
  }

  // 3. Comprobación de Expiración con Margen de Seguridad (5 minutos)
  const BUFFER_TIME_MS = 5 * 60 * 1000
  const isExpired =
    !account.tokenExpires ||
    account.tokenExpires.getTime() - Date.now() < BUFFER_TIME_MS

  if (!isExpired) {
    return account.accessToken // Token vigente, no requiere renovación
  }

  // 4. Manejo de Renovación (Token Expirado sin refresh_token)
  if (!account.refreshToken) {
    await prisma.socialAccount.update({
      where: { id: account.id },
      data: { isActive: false },
    })
    throw new TikTokTokenRefreshError(
      'Sesión de TikTok caducada sin posibilidad de renovación. Requiere reautenticación.',
      401
    )
  }

  // 5. Petición de Refresco Estricta (URLSearchParams)
  const params = new URLSearchParams({
    client_key: clientKey,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
    refresh_token: account.refreshToken,
  })

  const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cache-Control': 'no-cache',
    },
    body: params.toString(),
  })

  const data = (await res.json()) as TikTokRefreshResponse

  // 6. Verificación Defensiva y Logs de Auditoría
  if (!res.ok || data.error || !data.access_token) {
    console.error('❌ [TIKTOK REFRESH FAILED] Status:', res.status, 'Payload:', JSON.stringify(data))

    // Marcar la cuenta como inactiva para alertar al sistema
    await prisma.socialAccount.update({
      where: { id: account.id },
      data: { isActive: false },
    })

    throw new TikTokTokenRefreshError(
      data.error_description || data.error || 'Fallo al renovar sesión con TikTok',
      401,
      data
    )
  }

  // 7. Persistencia Atómica en Prisma (data.access_token garantizado)
  const newExpiresAt = new Date(Date.now() + (data.expires_in ?? 86400) * 1000)
  const newRefreshExpiresAt = data.refresh_expires_in
    ? new Date(Date.now() + data.refresh_expires_in * 1000)
    : account.refreshExpires

  await prisma.socialAccount.update({
    where: { id: account.id },
    data: {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? account.refreshToken,
      tokenExpires: newExpiresAt,
      refreshExpires: newRefreshExpiresAt,
      scope: data.scope ?? account.scope,
      isActive: true,
    },
  })

  return data.access_token
}

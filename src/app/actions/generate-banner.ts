'use server'

import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function generateBannerAction(contentId: string) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { success: false, message: 'Sesión no válida' }

    const dbUser = await prisma.user.findUnique({
      where: { supabaseAuthId: user.id },
      select: { id: true, creditsBalance: true },
    })

    if (!dbUser) return { success: false, message: 'Usuario no encontrado' }
    if (dbUser.creditsBalance < 2) {
      return { success: false, message: 'Créditos insuficientes (Requiere 2 créditos)' }
    }

    const campaign = await prisma.contentVault.findFirst({
      where: { id: contentId, userId: dbUser.id },
    })

    if (!campaign) return { success: false, message: 'Campaña no encontrada' }

    // 1. Obtener la imagen compuesta desde el endpoint de OG
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const ogUrl = new URL(`${baseUrl}/api/og/banner`)
    ogUrl.searchParams.set('title', campaign.topic)
    ogUrl.searchParams.set('hook', campaign.salesAngle || 'Edición especial para ti')
    if (campaign.imageUrl) ogUrl.searchParams.set('imageUrl', campaign.imageUrl)

    const ogResponse = await fetch(ogUrl.toString())
    if (!ogResponse.ok) {
      throw new Error('Error al renderizar el banner gráfico con next/og')
    }

    const bannerArrayBuffer = await ogResponse.arrayBuffer()
    const bannerBuffer = Buffer.from(bannerArrayBuffer)

    // 2. Subir el banner estático directamente a Supabase Storage
    const fileName = `banners/${dbUser.id}/banner_${Date.now()}.png`
    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(fileName, bannerBuffer, {
        contentType: 'image/png',
        upsert: true,
      })

    if (uploadError) {
      throw new Error(`Error subiendo pancarta a Supabase: ${uploadError.message}`)
    }

    const { data: { publicUrl: storedBannerUrl } } = supabase.storage
      .from('product-images')
      .getPublicUrl(fileName)

    // 3. Transacción Atómica: Cobro, Registro en Ledger y Guardado en Bóveda
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: dbUser.id },
        data: { creditsBalance: { decrement: 2 } },
      })

      await tx.creditTransaction.create({
        data: {
          userId: dbUser.id,
          amount: -2,
          balanceAfter: dbUser.creditsBalance - 2,
          type: 'USAGE',
          description: `Diseño de Pancarta Visual: "${campaign.topic.slice(0, 30)}"`,
        },
      })

      await tx.contentVault.update({
        where: { id: contentId },
        data: { bannerUrl: storedBannerUrl },
      })
    })

    revalidatePath(`/dashboard/${contentId}`)
    revalidatePath('/dashboard')

    return { 
      success: true, 
      bannerUrl: storedBannerUrl, 
      message: '¡Pancarta visual diseñada y guardada en la bóveda!' 
    }
  } catch (error: any) {
    console.error('Error en generateBannerAction:', error)
    return { success: false, message: error.message || 'Error al procesar la pancarta' }
  }
}

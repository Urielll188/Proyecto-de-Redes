'use server'

import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'

export async function createFastTrackAction(productDesc: string, imageUrl: string | null) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autorizado')

  const dbUser = await prisma.user.findUnique({ 
    where: { supabaseAuthId: user.id },
    select: { id: true }
  })
  if (!dbUser) throw new Error('Usuario no registrado en la base de datos')

  // Registro base en la bóveda listo para la Factoría (Paso 3)
  const newRecord = await prisma.contentVault.create({
    data: {
      userId: dbUser.id,
      topic: productDesc,
      tone: 'Directo',
      instagramCopy: '',
      tiktokScript: '',
      imageUrl: imageUrl || null,
      targetAudience: 'Público general interesado en el producto',
      salesAngle: 'Promoción directa de valor y beneficios principales',
    }
  })

  return { success: true, strategyId: newRecord.id }
}

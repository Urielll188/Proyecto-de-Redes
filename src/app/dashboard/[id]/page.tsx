import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { EmpresaStepper } from '@/components/dashboard/EmpresaStepper'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }> | { id: string }
}

export default async function HydratedDashboardPage({ params }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const dbUser = await prisma.user.findUnique({
    where: { supabaseAuthId: user.id },
    select: { id: true }
  })

  if (!dbUser) redirect('/login')

  // Resolver params compatible con Next.js 14 y 15
  const resolvedParams = await Promise.resolve(params)
  const contentId = resolvedParams.id

  // CONSULTA SEGURA (Prevención IDOR): Valida simultáneamente ID y pertenencia de usuario
  const campaign = await prisma.contentVault.findFirst({
    where: {
      id: contentId,
      userId: dbUser.id
    }
  })

  if (!campaign) {
    redirect('/dashboard')
  }

  // Reconstrucción del objeto strategyData desde las columnas reales de Prisma
  const hasStrategy = Boolean(campaign.targetAudience || campaign.salesAngle)
  const strategyData = hasStrategy
    ? {
        buyerPersona: {
          content: campaign.targetAudience || '',
          reasoning: campaign.targetAudienceReasoning || null
        },
        postingTips: {
          content: campaign.postingTips || '',
          reasoning: campaign.postingTipsReasoning || null
        },
        photoAdvice: {
          content: campaign.photoAdvice || '',
          reasoning: campaign.photoAdviceReasoning || null
        },
        salesAngle: {
          content: campaign.salesAngle || '',
          reasoning: campaign.salesAngleReasoning || null
        }
      }
    : null

  const copies = campaign.instagramCopy && campaign.tiktokScript
    ? {
        instagramCopy: campaign.instagramCopy,
        tiktokScript: campaign.tiktokScript,
        whatsapp: campaign.whatsappFicha
          ? {
              ficha: campaign.whatsappFicha,
              objecionPrecio: campaign.whatsappPrecio || '',
              objecionConfianza: campaign.whatsappConfianza || ''
            }
          : undefined
      }
    : null

  const initialData = {
    id: campaign.id,
    productDesc: campaign.topic,
    imageUrl: campaign.imageUrl,
    bannerUrl: campaign.bannerUrl,
    strategyData,
    copies
  }

  return (
    <div className="w-full">
      <EmpresaStepper initialData={initialData} userId={dbUser.id} />
    </div>
  )
}

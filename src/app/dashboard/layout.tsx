import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/DashboardShell'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const dbUser = await prisma.user.findUnique({
    where: { supabaseAuthId: user.id },
    select: {
      creditsBalance: true,
      _count: { select: { contentVaults: true } }
    }
  })

  const creditsBalance = dbUser?.creditsBalance ?? 0
  const vaultCount = dbUser?._count?.contentVaults ?? 0
  const userEmail = user.email || 'usuario@blitzr.ai'
  const userName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuario'

  return (
    <DashboardShell
      creditsBalance={creditsBalance}
      userEmail={userEmail}
      userName={userName}
      vaultCount={vaultCount}
    >
      {children}
    </DashboardShell>
  )
}

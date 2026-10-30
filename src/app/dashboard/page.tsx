import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { EmpresaStepper } from '@/components/dashboard/EmpresaStepper'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const dbUser = await prisma.user.findUnique({
    where: { supabaseAuthId: user.id },
    select: { id: true }
  })

  if (!dbUser) redirect('/login')

  return (
    <div className="w-full">
      <EmpresaStepper userId={dbUser.id} />
    </div>
  )
}

import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { HistoryClientGrid } from './HistoryClientGrid'

export default async function HistoryPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Resolver ID interno del usuario en la base de datos de Prisma
  const dbUser = await prisma.user.findUnique({
    where: { supabaseAuthId: user.id },
    select: { id: true },
  })

  if (!dbUser) {
    redirect('/login')
  }

  // Extraer los últimos 30 registros de la bóveda
  const vaultItems = await prisma.contentVault.findMany({
    where: { userId: dbUser.id },
    orderBy: { createdAt: 'desc' },
    take: 30,
  })

  return (
    <div className="max-w-5xl mx-auto space-y-6 py-2 px-1">
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
        <div>
          <h1 className="text-2xl font-black text-zinc-100 tracking-wide">Bóveda de Contenido</h1>
          <p className="text-xs text-zinc-400">Tus copys, guiones y pancartas generados con IA</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300">
            {vaultItems.length} registros guardados
          </span>
          <Link className="text-xs font-semibold text-blue-400 hover:text-blue-300 hover:underline" href="/dashboard">
            ← Volver al Generador
          </Link>
        </div>
      </div>

      <HistoryClientGrid vaultItems={vaultItems} />
    </div>
  )
}

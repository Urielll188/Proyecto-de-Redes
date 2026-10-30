import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { CopyButton } from '@/components/dashboard/CopyButton'
import { GenerateBannerButton } from '@/components/dashboard/GenerateBannerButton'
import Link from 'next/link'

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

      {vaultItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/60 p-12 text-center">
          <p className="text-zinc-400 mb-4 text-sm">Aún no tienes contenido en tu bóveda.</p>
          <Link className="inline-block px-5 py-2.5 text-xs font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-500 transition shadow-lg" href="/dashboard">
            Generar primera publicación
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {vaultItems.map((item) => (
            <div key={item.id} className="rounded-2xl border border-zinc-800/80 bg-zinc-900/90 p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
                <div className="flex items-center gap-3">
                  {item.imageUrl && (
                    <img 
                      src={item.imageUrl} 
                      alt="Producto" 
                      className="h-12 w-12 rounded-xl object-cover border border-zinc-700 shadow-sm"
                    />
                  )}
                  <div>
                    <h3 className="font-bold text-zinc-100 capitalize text-base">{item.topic}</h3>
                    <span className="text-xs text-zinc-400">
                      Tono: <strong className="capitalize text-zinc-300">{item.tone}</strong> • {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="grid gap-4 md:grid-cols-2">
                {/* Instagram */}
                <div className="rounded-xl bg-zinc-950/80 p-4 border border-zinc-800 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-pink-400">Instagram</span>
                      <CopyButton text={item.instagramCopy} />
                    </div>
                    <p className="text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed">{item.instagramCopy}</p>
                  </div>
                </div>

                {/* TikTok */}
                <div className="rounded-xl bg-zinc-950/80 p-4 border border-zinc-800 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-zinc-200">TikTok / Reels</span>
                      <CopyButton text={item.tiktokScript} />
                    </div>
                    <p className="text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed">{item.tiktokScript}</p>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <Link
                  href={`/dashboard/${item.id}`}
                  className="px-3.5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium rounded-xl transition-colors border border-zinc-700/60 flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <span>✏️</span> Reanudar en Workspace
                </Link>

                <div className="flex-1">
                  <GenerateBannerButton 
                    contentId={item.id} 
                    existingBannerUrl={item.bannerUrl} 
                    visualPrompt={item.visualPrompt} 
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

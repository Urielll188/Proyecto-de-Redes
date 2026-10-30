import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import Link from 'next/link'

// Forzar lectura en tiempo real desde la BD, cero caché
export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }> | { [key: string]: string | string[] | undefined }
}

export default async function IntegrationsPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Resolver searchParams compatible con Next.js 14 y 15
  const resolvedParams = await Promise.resolve(searchParams)
  const errorMsg = typeof resolvedParams?.error === 'string' ? resolvedParams.error : null
  const successMsg = typeof resolvedParams?.success === 'string' ? resolvedParams.success : null

  const dbUser = await prisma.user.findUnique({
    where: { supabaseAuthId: user.id },
    include: { socialAccounts: true }
  })

  const accounts = dbUser?.socialAccounts || []
  const fbAccount = accounts.find((a) => a.provider === 'FACEBOOK')
  const igAccount = accounts.find((a) => a.provider === 'INSTAGRAM')

  // Caso clave: El login fue exitoso en Meta pero no devolvió ninguna página/IG
  const hasNoAccounts = successMsg && accounts.length === 0

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Sistema de Diagnóstico Visual */}
      {errorMsg && (
        <div className="p-4 bg-red-950/40 border border-red-800/60 text-red-300 rounded-xl text-sm font-medium">
          ⚠️ <strong>Error en la conexión:</strong> {errorMsg} (Revisa los logs en la terminal de tu servidor).
        </div>
      )}

      {hasNoAccounts && (
        <div className="p-4 bg-amber-950/40 border border-amber-800/60 text-amber-300 rounded-xl text-sm space-y-1">
          <p className="font-bold">⚠️ Conexión exitosa, pero no detectamos Páginas de Facebook ni cuentas de Instagram.</p>
          <p className="text-xs text-amber-400/80">
            Meta requiere que administres al menos una <strong>Página de Facebook</strong> y que tu cuenta de Instagram esté en modo <strong>Profesional (Creador o Empresa)</strong> vinculada a esa página.
          </p>
        </div>
      )}

      {successMsg && accounts.length > 0 && (
        <div className="p-4 bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 rounded-xl text-sm font-medium">
          ✅ ¡Cuentas vinculadas y listas para publicar!
        </div>
      )}

      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Canales Conectados</h1>
          <p className="text-xs text-zinc-400">Vincula tus redes sociales para publicar tus campañas con un solo clic.</p>
        </div>
        <Link className="text-xs text-blue-400 hover:text-blue-300 font-medium transition" href="/dashboard">
          ← Volver al Dashboard
        </Link>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Instagram Card */}
        <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">📸</span>
              <div>
                <h3 className="font-bold text-white text-sm">Instagram Business</h3>
                <p className="text-xs text-zinc-400">Publicaciones en tu feed oficial</p>
              </div>
            </div>
            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${igAccount ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-800 text-zinc-400 border border-zinc-700/50'}`}>
              {igAccount ? 'Conectado' : 'No conectado'}
            </span>
          </div>

          {igAccount && (
            <div className="p-3 bg-zinc-950/60 border border-zinc-800/60 rounded-xl text-xs text-zinc-300">
              Cuenta vinculada: <strong className="text-white">{igAccount.accountName}</strong>
            </div>
          )}

          <a
            href="/api/auth/meta"
            className={`block text-center w-full py-2.5 px-4 font-semibold rounded-xl text-xs transition shadow-sm ${igAccount ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200' : 'bg-gradient-to-r from-pink-500 to-purple-600 text-white hover:opacity-90'}`}
          >
            {igAccount ? 'Reconectar Instagram' : 'Conectar Instagram'}
          </a>
        </div>

        {/* Facebook Page Card */}
        <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">📘</span>
              <div>
                <h3 className="font-bold text-white text-sm">Página de Facebook</h3>
                <p className="text-xs text-zinc-400">Publicaciones en tu Fan Page</p>
              </div>
            </div>
            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${fbAccount ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-800 text-zinc-400 border border-zinc-700/50'}`}>
              {fbAccount ? 'Conectado' : 'No conectado'}
            </span>
          </div>

          {fbAccount && (
            <div className="p-3 bg-zinc-950/60 border border-zinc-800/60 rounded-xl text-xs text-zinc-300">
              Página vinculada: <strong className="text-white">{fbAccount.accountName}</strong>
            </div>
          )}

          <a
            href="/api/auth/meta"
            className={`block text-center w-full py-2.5 px-4 font-semibold rounded-xl text-xs transition shadow-sm ${fbAccount ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200' : 'bg-blue-600 text-white hover:bg-blue-500'}`}
          >
            {fbAccount ? 'Reconectar Facebook' : 'Conectar Facebook'}
          </a>
        </div>
      </div>
    </div>
  )
}

import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function BillingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 1. Obtener ID interno y saldo actual
  const dbUser = await prisma.user.findUnique({
    where: { supabaseAuthId: user.id },
    select: { id: true, creditsBalance: true },
  })

  if (!dbUser) {
    redirect('/login')
  }

  // 2. Extraer el historial de transacciones
  const transactions = await prisma.creditTransaction.findMany({
    where: { userId: dbUser.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  return (
    <div className="max-w-5xl mx-auto space-y-8 py-6 px-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Créditos y Facturación</h1>
          <p className="text-sm text-gray-500">Gestiona tu saldo y revisa tu historial de consumo</p>
        </div>
        <Link className="text-sm font-medium text-blue-600 hover:underline" href="/dashboard">
          ← Volver al Generador
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Tarjeta de Saldo Actual */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm md:col-span-1 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-2">Saldo Disponible</h2>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-black text-gray-900">{dbUser.creditsBalance}</span>
              <span className="text-sm font-medium text-gray-500">créditos</span>
            </div>
          </div>
          <button 
            type="button" 
            className="mt-6 w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-800 flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
            Comprar más créditos
          </button>
          <p className="text-xs text-center text-gray-400 mt-3">Próximamente integración con pagos</p>
        </div>

        {/* Historial de Transacciones */}
        <div className="rounded-xl border border-gray-200 bg-white p-0 shadow-sm md:col-span-2 overflow-hidden">
          <div className="border-b border-gray-100 bg-gray-50/50 px-6 py-4">
            <h3 className="font-semibold text-gray-900">Historial de Movimientos</h3>
          </div>
          
          {transactions.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">
              No hay movimientos registrados en tu cuenta.
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {transactions.map((tx) => (
                <li key={tx.id} className="flex items-center justify-between px-6 py-4 hover:bg-gray-50/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full ${tx.amount > 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                      {tx.amount > 0 ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4"></path></svg>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{tx.description}</p>
                      <p className="text-xs text-gray-500">{new Date(tx.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className={`text-sm font-bold ${tx.amount > 0 ? 'text-green-600' : 'text-gray-900'}`}>
                    {tx.amount > 0 ? '+' : ''}{tx.amount}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

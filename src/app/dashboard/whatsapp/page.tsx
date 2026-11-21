import Link from 'next/link';
import { WhatsAppMultiSessionCard } from '@/components/dashboard/WhatsAppMultiSessionCard';

export const dynamic = 'force-dynamic';

export default function WhatsAppConnectionPage() {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Conexión WhatsApp Multi-Sesión
          </h1>
          <p className="text-xs text-zinc-400">
            Vincula la línea de WhatsApp de tu negocio para que tu Agente IA atienda 24/7 y el Cazador envíe primeros contactos en frío.
          </p>
        </div>
        <Link
          className="text-xs text-blue-400 hover:text-blue-300 font-medium transition"
          href="/dashboard/integrations"
        >
          ← Ver todos los canales
        </Link>
      </div>

      <WhatsAppMultiSessionCard />
    </div>
  );
}

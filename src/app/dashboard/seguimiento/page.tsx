'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  RefreshCw,
  Mic,
  MessageCircle,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { fetchVpsGet, fetchVpsPost, SeguimientoVps } from '@/lib/vps/types';
import { useNicho } from '@/context/NichoContext';

export default function SeguimientoPage() {
  const { ownerEmail, isMallasOwner, tienePerfil, nicho, loadingNicho } = useNicho();
  const [seguimientos, setSeguimientos] = useState<SeguimientoVps[]>([]);
  const [loading, setLoading] = useState(true);
  const [vpsOffline, setVpsOffline] = useState(false);
  const [ttsLoadingIdx, setTtsLoadingIdx] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const cargarDatos = useCallback(async () => {
    if (!ownerEmail) return;
    if (!isMallasOwner && !tienePerfil) {
      setSeguimientos([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const data = await fetchVpsGet('/api/datos_seguros', {
      email: ownerEmail,
      ...(nicho?.cliente_id ? { cliente_id: nicho.cliente_id } : {}),
    });
    setVpsOffline(Boolean(data.vpsOffline || data.ok === false));
    if (Array.isArray(data.seguimientos)) {
      setSeguimientos(data.seguimientos);
    } else {
      setSeguimientos([]);
    }
    setLoading(false);
  }, [ownerEmail, isMallasOwner, tienePerfil, nicho?.cliente_id]);

  useEffect(() => {
    if (!loadingNicho) {
      cargarDatos();
    }
  }, [cargarDatos, loadingNicho]);

  const handleGenerarNotaVoz = async (texto: string, idx: number) => {
    setTtsLoadingIdx(idx);
    const res = await fetchVpsPost('/api/tts_voz_mujer', { texto });
    setTtsLoadingIdx(null);
    const audioUrl = res.audio_data_url as string | undefined;
    if (!audioUrl) {
      toast.error(res.error || 'No se pudo generar la nota de voz en el VPS.');
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    audio.play().catch(() => {});
    toast.success('Nota de voz femenina generada y reproduciendo.');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-pink-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <Sparkles className="w-4 h-4" />
            Módulo 4 • Recuperación y Recompra
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {isMallasOwner
              ? 'El Perseguidor (24h / 72h / VIP 15 Días)'
              : `Seguimiento Automático • ${nicho?.nombre_negocio || 'Tu Negocio'}`}
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            {isMallasOwner
              ? 'Recuperación automática de prospectos tibios y desbloqueo de venta de baleros desde $26 MXN a los 15 días.'
              : 'Recuperación automática de prospectos interesados (24h / 72h) y reactivación de clientes para generar recompras.'}
          </p>
        </div>

        <button
          onClick={cargarDatos}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800 text-sm transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar Seguimientos
        </button>
      </div>

      {vpsOffline && (
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>Modo sin conexión VPS: configura VPS_API_URL para sincronizar la cola de seguimiento.</span>
        </div>
      )}

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950/60 text-[11px] uppercase tracking-wider text-zinc-400">
                <th className="py-3 px-4">{isMallasOwner ? 'Tortillería / Tel' : 'Cliente / Tel'}</th>
                <th className="py-3 px-4">Zona / Municipio</th>
                <th className="py-3 px-4">Etapa</th>
                <th className="py-3 px-4">Último Mensaje Cliente</th>
                <th className="py-3 px-4">Mensaje IA Sugerido & Nota de Voz</th>
                <th className="py-3 px-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-500">
                    Cargando seguimientos...
                  </td>
                </tr>
              ) : seguimientos.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-500">
                    No hay seguimientos pendientes en este momento.
                  </td>
                </tr>
              ) : (
                seguimientos.map((s, idx) => {
                  const isVip = (s.etapa_seguimiento || '').toUpperCase().includes('VIP_15_DIAS');
                  return (
                    <tr key={`${s.telefono}-${idx}`} className="hover:bg-zinc-900/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-white">{s.nombre_tortilleria}</div>
                        <div className="text-xs text-zinc-400 font-mono">{s.telefono}</div>
                      </td>
                      <td className="py-3.5 px-4 text-zinc-300 text-xs">{s.municipio}</td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                            isVip
                              ? 'bg-pink-500/20 text-pink-300 border border-pink-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {s.etapa_seguimiento}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-zinc-400 max-w-xs">
                        {s.ultimo_mensaje_cliente || 'Sin respuesta reciente'}
                      </td>
                      <td className="py-3.5 px-4 max-w-md">
                        <p className="text-xs text-zinc-200 mb-2 leading-relaxed">
                          {s.mensaje_ia_sugerido}
                        </p>
                        <button
                          onClick={() => handleGenerarNotaVoz(s.mensaje_ia_sugerido, idx)}
                          disabled={ttsLoadingIdx === idx}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs transition-colors disabled:opacity-50"
                        >
                          <Mic className="w-3.5 h-3.5 text-pink-400" />
                          {ttsLoadingIdx === idx
                            ? 'Generando nota...'
                            : 'Generar Nota de Voz de Seguimiento'}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <a
                          href={`https://wa.me/${(s.telefono || '').replace(/\D/g, '')}?text=${encodeURIComponent(
                            s.mensaje_ia_sugerido || ''
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          Enviar Seguimiento WA
                        </a>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

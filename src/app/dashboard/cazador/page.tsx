'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Crosshair,
  MapPin,
  CheckCircle2,
  XCircle,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  Zap,
  Map,
  RefreshCw,
  Phone,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { fetchVpsGet, fetchVpsPost, ProspectoVps } from '@/lib/vps/types';

const MUNICIPIOS = [
  'TODOS',
  'Ecatepec',
  'Tultitlán',
  'Coacalco',
  'Naucalpan',
  'Tlalnepantla',
  'Cuautitlán Izcalli',
  'Atizapán',
  'Cuautitlán',
  'Tepotzotlán',
];

const PAGE_SIZE = 10;

export default function CazadorPage() {
  const [prospectos, setProspectos] = useState<ProspectoVps[]>([]);
  const [municipio, setMunicipio] = useState<string>('TODOS');
  const [paginaLote, setPaginaLote] = useState<number>(0);
  const [telPrueba, setTelPrueba] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [cazando, setCazando] = useState<string | null>(null);
  const [vpsOffline, setVpsOffline] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    const data = await fetchVpsGet('/api/datos_seguros');
    if (data.vpsOffline || data.ok === false) {
      setVpsOffline(true);
      setErrorMsg(data.error || 'Servidor VPS sin conexión.');
    } else {
      setVpsOffline(false);
    }
    if (Array.isArray(data.prospectos)) {
      setProspectos(data.prospectos);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const filtrados = useMemo(() => {
    if (municipio === 'TODOS') return prospectos;
    return prospectos.filter((p) =>
      (p.municipio || '').toLowerCase().includes(municipio.toLowerCase())
    );
  }, [prospectos, municipio]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE));
  const paginaActual = Math.min(paginaLote, totalPaginas - 1);
  const loteVisible = useMemo(() => {
    const start = paginaActual * PAGE_SIZE;
    return filtrados.slice(start, start + PAGE_SIZE);
  }, [filtrados, paginaActual]);

  const handleCazarLote = async (fuente: 'INEGI' | 'APIFY') => {
    setCazando(fuente);
    const res = await fetchVpsPost('/api/cazar_lote_10', { municipio, fuente });
    setCazando(null);
    if (res.ok === false || res.vpsOffline) {
      toast.error(res.error || 'No se pudo conectar al VPS para cazar lote.');
      return;
    }
    toast.success(`Lote de 10 prospectos (${fuente}) actualizado.`);
    await cargarDatos();
  };

  const handleMarcarMaps = async (
    telefono: string,
    estatus: 'ABIERTA_VERIFICADA' | 'CERRADA_DESCARTADA'
  ) => {
    // Optimistic update
    setProspectos((prev) =>
      prev.map((p) => (p.telefono === telefono ? { ...p, estatus_maps: estatus } : p))
    );
    const res = await fetchVpsPost('/api/marcar_maps', {
      telefono,
      estatus_maps: estatus,
    });
    if (res.ok === false && !res.vpsOffline) {
      toast.error(res.error || 'Error al actualizar estatus en Maps.');
      await cargarDatos();
      return;
    }
    toast.success(
      estatus === 'ABIERTA_VERIFICADA'
        ? 'Marcada como Abierta Verificada.'
        : 'Marcada como Cerrada / Descartada.'
    );
  };

  const buildWaUrl = (p: ProspectoVps) => {
    const digitsOverride = telPrueba.replace(/\D/g, '');
    let destino = (p.telefono || '').replace(/\D/g, '');
    if (digitsOverride.length === 10) {
      destino = `52${digitsOverride}`;
    } else if (digitsOverride.length >= 12) {
      destino = digitsOverride;
    } else if (destino.length === 10) {
      destino = `52${destino}`;
    }

    const msg = `Hola! Soy de *Mallas Tlaxcalli*. Vimos su tortillería "${p.nombre}" en ${p.municipio}. Tenemos el *Paquete Completo* de malla + bandas en *$1,713 MXN* con envío gratis y pago contra entrega. ¿Le gustaría recibir detalles para su máquina?`;
    return `https://wa.me/${destino}?text=${encodeURIComponent(msg)}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <Crosshair className="w-4 h-4" />
            Módulo 1 • Prospección Automatizada
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Cazador DENUE / Apify (Lotes de 10)
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Filtra tortillerías por municipio, verifica en Google Maps si operan y envía el pitch por WhatsApp.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={cargarDatos}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800 text-sm transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
          <button
            onClick={() => handleCazarLote('INEGI')}
            disabled={cazando !== null}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Zap className="w-4 h-4" />
            {cazando === 'INEGI' ? 'Cazando...' : '+10 INEGI'}
          </button>
          <button
            onClick={() => handleCazarLote('APIFY')}
            disabled={cazando !== null}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Map className="w-4 h-4" />
            {cazando === 'APIFY' ? 'Cazando...' : '+10 Apify Maps'}
          </button>
        </div>
      </div>

      {vpsOffline && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-sm">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Conexión VPS en espera</p>
            <p className="text-amber-200/80 text-xs mt-0.5">
              {errorMsg || 'Configura VPS_API_URL y VPS_API_KEY en el entorno para sincronizar prospectos en vivo.'}
            </p>
          </div>
        </div>
      )}

      {/* Filtros y Teléfono de Prueba */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">
            Municipio Objetivo
          </label>
          <select
            value={municipio}
            onChange={(e) => {
              setMunicipio(e.target.value);
              setPaginaLote(0);
            }}
            className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 text-sm focus:outline-none focus:border-blue-500"
          >
            {MUNICIPIOS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">
            Teléfono de Prueba (Override WA)
          </label>
          <div className="relative">
            <Phone className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={telPrueba}
              onChange={(e) => setTelPrueba(e.target.value)}
              placeholder="Ej: 5512345678 (10 dígitos)"
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="flex items-end justify-between gap-2">
          <div className="text-xs text-zinc-400">
            Mostrando <span className="text-white font-semibold">{loteVisible.length}</span> de{' '}
            <span className="text-white font-semibold">{filtrados.length}</span> prospectos
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPaginaLote((p) => Math.max(0, p - 1))}
              disabled={paginaActual === 0}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-300 hover:bg-zinc-800 text-xs font-medium disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
              10 Ant.
            </button>
            <span className="text-xs text-zinc-400 px-2">
              {paginaActual + 1} / {totalPaginas}
            </span>
            <button
              onClick={() => setPaginaLote((p) => Math.min(totalPaginas - 1, p + 1))}
              disabled={paginaActual >= totalPaginas - 1}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-300 hover:bg-zinc-800 text-xs font-medium disabled:opacity-40"
            >
              Sig. 10
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Tabla de Prospectos */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950/60 text-[11px] uppercase tracking-wider text-zinc-400">
                <th className="py-3 px-4">Tortillería / Fuente</th>
                <th className="py-3 px-4">Municipio / Dirección</th>
                <th className="py-3 px-4">Teléfono</th>
                <th className="py-3 px-4">Verificación Maps</th>
                <th className="py-3 px-4 text-right">Acción WhatsApp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-zinc-500">
                    Cargando prospectos desde el servidor...
                  </td>
                </tr>
              ) : loteVisible.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-zinc-500">
                    No hay prospectos registrados para este filtro. Usa +10 INEGI o +10 Apify Maps.
                  </td>
                </tr>
              ) : (
                loteVisible.map((p, idx) => {
                  const isDescartada = p.estatus_maps === 'CERRADA_DESCARTADA';
                  const isVerificada = p.estatus_maps === 'ABIERTA_VERIFICADA';
                  return (
                    <tr
                      key={`${p.telefono}-${idx}`}
                      className={`hover:bg-zinc-900/80 transition-colors ${
                        isDescartada ? 'opacity-50' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-white">{p.nombre}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[11px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                            {p.fuente || 'DENUE'}
                          </span>
                          {p.segmento_cliente && (
                            <span className="text-[11px] text-zinc-500">{p.segmento_cliente}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-zinc-200 font-medium">{p.municipio}</div>
                        <div className="text-xs text-zinc-500 max-w-xs truncate">
                          {p.direccion}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-zinc-300">
                        {p.telefono}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {p.google_maps_url && (
                            <a
                              href={p.google_maps_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs transition-colors"
                            >
                              <MapPin className="w-3.5 h-3.5 text-blue-400" />
                              Maps
                            </a>
                          )}
                          <button
                            onClick={() => handleMarcarMaps(p.telefono, 'ABIERTA_VERIFICADA')}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                              isVerificada
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : 'bg-zinc-800/80 text-zinc-400 hover:text-emerald-300'
                            }`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Abierta
                          </button>
                          <button
                            onClick={() => handleMarcarMaps(p.telefono, 'CERRADA_DESCARTADA')}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                              isDescartada
                                ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                                : 'bg-zinc-800/80 text-zinc-400 hover:text-red-300'
                            }`}
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Cerrada
                          </button>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {isDescartada ? (
                          <span className="inline-block px-2.5 py-1 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                            Descartada (Cerrada)
                          </span>
                        ) : (
                          <a
                            href={buildWaUrl(p)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            Mandar WA
                          </a>
                        )}
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

'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Truck,
  DollarSign,
  PackageCheck,
  TrendingUp,
  Wallet,
  MapPin,
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { fetchVpsGet, fetchVpsPost, PedidoVps } from '@/lib/vps/types';
import { useNicho } from '@/context/NichoContext';

export default function LogisticaPage() {
  const { ownerEmail, isMallasOwner, tienePerfil, nicho, loadingNicho } = useNicho();

  const [pedidos, setPedidos] = useState<PedidoVps[]>([]);
  const [loading, setLoading] = useState(true);
  const [vpsOffline, setVpsOffline] = useState(false);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);

  const cargarDatos = useCallback(async () => {
    if (!ownerEmail) return;
    if (!isMallasOwner && !tienePerfil) {
      setPedidos([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const data = await fetchVpsGet('/api/datos_seguros', {
      email: ownerEmail,
      ...(nicho?.cliente_id ? { cliente_id: nicho.cliente_id } : {}),
    });
    setVpsOffline(Boolean(data.vpsOffline || data.ok === false));
    if (Array.isArray(data.pedidos)) {
      setPedidos(data.pedidos);
    } else {
      setPedidos([]);
    }
    setLoading(false);
  }, [ownerEmail, isMallasOwner, tienePerfil, nicho?.cliente_id]);

  useEffect(() => {
    if (!loadingNicho) {
      cargarDatos();
    }
  }, [cargarDatos, loadingNicho]);

  const stats = useMemo(() => {
    const setupBase = isMallasOwner ? 2500 : 0;
    const ventasTotales = pedidos.reduce((acc, p) => acc + Number(p.monto_venta || 0), 0);
    const comisionesPedidos = pedidos.reduce(
      (acc, p) => acc + Number(p.comision_agencia || 0),
      0
    );
    return {
      setupBase,
      paquetesCerrados: pedidos.length,
      ventasTotales,
      tusComisiones: setupBase + comisionesPedidos,
    };
  }, [pedidos, isMallasOwner]);

  const handleConfirmarPago = async (id: number) => {
    setConfirmingId(id);
    const res = await fetchVpsPost('/api/confirmar_entrega_comision', {
      id,
      owner_email: ownerEmail,
      cliente_id: nicho?.cliente_id || (isMallasOwner ? 'mallas_tlaxcalli' : ''),
    });
    setConfirmingId(null);
    if (res.ok === false || res.vpsOffline) {
      toast.error(res.error || 'No se pudo confirmar la entrega en el VPS.');
      return;
    }
    setPedidos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, estatus_entrega: 'ENTREGADO_Y_PAGADO' } : p))
    );
    toast.success('Entrega y pago confirmados.');
  };

  const nombreMarca = isMallasOwner
    ? 'MALLAS TLAXCALLI'
    : (nicho?.nombre_negocio || 'MI NEGOCIO').toUpperCase();

  const buildRutaChoferUrl = (p: PedidoVps) => {
    const msg = `🚚 *RUTA DE ENTREGA ${nombreMarca}*\nFolio: ${p.folio}\nCliente: ${p.cliente_tortilleria}\nTel: ${p.telefono}\nMunicipio: ${p.municipio}\nDirección: ${p.direccion_gps}\nHorario: ${p.horario_recepcion}\nCobrar (${p.metodo_pago}): $${p.monto_venta} MXN\nMaps: ${p.google_maps_url || 'N/A'}`;
    return `https://wa.me/?text=${encodeURIComponent(msg)}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <Truck className="w-4 h-4" />
            Módulo 3 • Logística y Comisiones
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Hoja de Ruta para Repartidores
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Control de entregas contra pago, despacho de rutas por WhatsApp y cálculo de comisiones.
          </p>
        </div>

        <button
          onClick={cargarDatos}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800 text-sm transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar Ruta
        </button>
      </div>

      {!loadingNicho && !isMallasOwner && !tienePerfil && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-zinc-900/80 border border-cyan-500/30 text-sm">
          <div className="text-zinc-300">
            Configura primero tu producto en <strong className="text-cyan-400">01 • IDEA</strong> para habilitar el registro y seguimiento de pedidos de tu negocio.
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-bold text-xs shrink-0 transition-colors"
          >
            Ir a 01 • IDEA
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {vpsOffline && (
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>Modo sin conexión VPS: configura VPS_API_URL para ver los pedidos en tiempo real.</span>
        </div>
      )}

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
            <span>Pago Setup</span>
            <DollarSign className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            ${stats.setupBase.toLocaleString('es-MX')} MXN
          </div>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
            <span>Pedidos Cerrados</span>
            <PackageCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white">{stats.paquetesCerrados}</div>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
            <span>Ventas Generadas</span>
            <TrendingUp className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            ${stats.ventasTotales.toLocaleString('es-MX')} MXN
          </div>
        </div>

        <div className="bg-zinc-900/60 border border-emerald-500/30 rounded-xl p-4">
          <div className="flex items-center justify-between text-emerald-300 text-xs mb-2">
            <span>Tus Comisiones</span>
            <Wallet className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400">
            ${stats.tusComisiones.toLocaleString('es-MX')} MXN
          </div>
        </div>
      </div>

      {/* Tabla de Pedidos */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950/60 text-[11px] uppercase tracking-wider text-zinc-400">
                <th className="py-3 px-4">Folio</th>
                <th className="py-3 px-4">Cliente / Tel</th>
                <th className="py-3 px-4">Dirección / Maps</th>
                <th className="py-3 px-4">Horario</th>
                <th className="py-3 px-4">Método Pago</th>
                <th className="py-3 px-4">Venta / Comisión</th>
                <th className="py-3 px-4 text-right">Estatus / Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-500">
                    Cargando hoja de ruta...
                  </td>
                </tr>
              ) : pedidos.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-500">
                    No hay pedidos registrados aún. Cierra una venta desde el Módulo 2.
                  </td>
                </tr>
              ) : (
                pedidos.map((p) => {
                  const pagado = p.estatus_entrega === 'ENTREGADO_Y_PAGADO';
                  return (
                    <tr key={p.id} className="hover:bg-zinc-900/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-xs text-blue-400 font-semibold">
                        {p.folio}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-white">{p.cliente_tortilleria}</div>
                        <div className="text-xs text-zinc-400 font-mono">{p.telefono}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-zinc-200 text-xs">{p.municipio}</div>
                        <div className="text-xs text-zinc-500 max-w-xs truncate">
                          {p.direccion_gps}
                        </div>
                        {p.google_maps_url && (
                          <a
                            href={p.google_maps_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-blue-400 hover:underline mt-0.5"
                          >
                            <MapPin className="w-3 h-3" />
                            Abrir Maps
                          </a>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-zinc-300">
                        {p.horario_recepcion}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-[11px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                          {p.metodo_pago}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-white font-semibold">
                          ${Number(p.monto_venta || 0).toLocaleString('es-MX')}
                        </div>
                        <div className="text-[11px] text-emerald-400">
                          +${Number(p.comision_agencia || 0)} comisión
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <a
                            href={buildRutaChoferUrl(p)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs transition-colors"
                          >
                            <Truck className="w-3.5 h-3.5 text-amber-400" />
                            Ruta a Chofer
                          </a>
                          {pagado ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Entregado y Pagado
                            </span>
                          ) : (
                            <button
                              onClick={() => handleConfirmarPago(p.id)}
                              disabled={confirmingId === p.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors disabled:opacity-50"
                            >
                              <DollarSign className="w-3.5 h-3.5" />
                              {confirmingId === p.id ? 'Confirmando...' : 'Confirmar Pago'}
                            </button>
                          )}
                        </div>
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

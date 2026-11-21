'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  AlertTriangle,
  Share2,
  ExternalLink,
  Plus,
  Lock,
  Building2,
  Sparkles,
  Power,
} from 'lucide-react';
import { toast } from 'sonner';
import { fetchVpsGet, fetchVpsPost, NichoVps, ProspectoVps } from '@/lib/vps/types';

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

const DEFAULT_MALLAS_NICHO: NichoVps = {
  cliente_id: 'mallas_tlaxcalli',
  nombre_negocio: 'Mallas Tlaxcalli',
  nombre_agente: 'Andrea / Paola',
  giro_objetivo: 'Tortillerías, Molinos de Nixtamal y Mecánicos de Maquinaria Tortilladora',
  codigo_scian_inegi: '311830',
  keywords_busqueda:
    'tortilleria, molino de nixtamal, maquinas tortilladoras, refacciones para tortilladoras, celorio, verduzco',
  oferta_gancho:
    'PAQUETE_MALLAS_1713 — Paquete Completo Mantenimiento $1,713 MXN (Testalera 23x140 + Transportadora 10x9m Cal 14 + Balero 7210B) con envío gratis',
  catalogo_y_reglas:
    'Paquete Completo $1,713 MXN (Testalera + Transportadora Cal 14 + Balero 7210B alemán). Envío gratis CDMX y Edomex. Pago contra entrega.',
  protegido: true,
  activo: true,
  total_prospectos: 284,
  enviados_wa: 11,
};

const PAGE_SIZE = 10;

export default function CazadorPage() {
  const [nichos, setNichos] = useState<NichoVps[]>([DEFAULT_MALLAS_NICHO]);
  const [nichoActivo, setNichoActivo] = useState<string>('mallas_tlaxcalli');
  const [prospectos, setProspectos] = useState<ProspectoVps[]>([]);
  const [bitacoraTotal, setBitacoraTotal] = useState<number>(0);
  const [bitacoraHoy, setBitacoraHoy] = useState<number>(0);
  const [municipio, setMunicipio] = useState<string>('TODOS');
  const [paginaLote, setPaginaLote] = useState<number>(0);
  const [telPrueba, setTelPrueba] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [cazando, setCazando] = useState<string | null>(null);
  const [vpsOffline, setVpsOffline] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Selector híbrido de Facebook
  const [mostrarModalFb, setMostrarModalFb] = useState<boolean>(false);
  const [modoFb, setModoFb] = useState<'KEYWORD' | 'GROUP'>('KEYWORD');
  const [targetFb, setTargetFb] = useState<string>('');
  const [cazaAsyncActiva, setCazaAsyncActiva] = useState<boolean>(false);
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Modal + Nuevo Nicho / Producto
  const [mostrarModalNicho, setMostrarModalNicho] = useState<boolean>(false);
  const [guardandoNicho, setGuardandoNicho] = useState<boolean>(false);
  const [formNicho, setFormNicho] = useState({
    nombre_negocio: '',
    nombre_agente: 'Andrea',
    giro_objetivo: '',
    keywords_busqueda: '',
    codigo_scian_inegi: '',
    oferta_gancho: '',
    catalogo_y_reglas: '',
  });

  const perfilNichoActual = useMemo(() => {
    return (
      nichos.find((n) => n.cliente_id.toLowerCase() === nichoActivo.toLowerCase()) ||
      DEFAULT_MALLAS_NICHO
    );
  }, [nichos, nichoActivo]);

  const cargarDatos = useCallback(
    async (cidOverride?: string) => {
      const targetCid = cidOverride || nichoActivo || 'mallas_tlaxcalli';
      setLoading(true);
      setErrorMsg(null);

      const [data, resNichos] = await Promise.all([
        fetchVpsGet('/api/datos_seguros', { cliente_id: targetCid }),
        fetchVpsGet('/api/nichos').catch(() => null),
      ]);

      if (data.vpsOffline || data.ok === false) {
        setVpsOffline(true);
        setErrorMsg(data.error || 'Servidor VPS sin conexión.');
      } else {
        setVpsOffline(false);
      }

      const listaNichos =
        (resNichos && Array.isArray(resNichos.nichos) && resNichos.nichos) ||
        (Array.isArray(data.nichos) && data.nichos) ||
        null;

      if (listaNichos && listaNichos.length > 0) {
        setNichos(listaNichos);
      }

      if (Array.isArray(data.prospectos)) {
        setProspectos(data.prospectos);
      }
      if (typeof data.bitacora_total === 'number') {
        setBitacoraTotal(data.bitacora_total);
      }
      if (typeof data.bitacora_hoy === 'number') {
        setBitacoraHoy(data.bitacora_hoy);
      }
      setLoading(false);
    },
    [nichoActivo]
  );

  useEffect(() => {
    cargarDatos(nichoActivo);
  }, [cargarDatos, nichoActivo]);

  // Limpiar timer de polling al desmontar
  useEffect(() => {
    return () => {
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
    };
  }, []);

  const iniciarPollingAutoRefresco = useCallback(() => {
    setCazaAsyncActiva(true);
    let intentos = 0;
    if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);

    pollingTimerRef.current = setInterval(async () => {
      intentos += 1;
      await cargarDatos(nichoActivo);
      if (intentos >= 7) {
        if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
        setCazaAsyncActiva(false);
      }
    }, 5000);
  }, [cargarDatos, nichoActivo]);

  const filtrados = useMemo(() => {
    return prospectos.filter((p) => {
      const cidRow = (p.id_cliente_agencia || 'mallas_tlaxcalli').toLowerCase();
      if (nichoActivo !== 'TODOS' && cidRow !== nichoActivo.toLowerCase()) {
        return false;
      }
      if (municipio === 'TODOS') return true;
      return (p.municipio || '').toLowerCase().includes(municipio.toLowerCase());
    });
  }, [prospectos, municipio, nichoActivo]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE));
  const paginaActual = Math.min(paginaLote, totalPaginas - 1);
  const loteVisible = useMemo(() => {
    const start = paginaActual * PAGE_SIZE;
    return filtrados.slice(start, start + PAGE_SIZE);
  }, [filtrados, paginaActual]);

  const handleCazarLote = async (fuente: 'INEGI' | 'APIFY' | 'FACEBOOK') => {
    setCazando(fuente);
    const body: Record<string, any> = {
      municipio,
      fuente,
      cliente_id: nichoActivo,
    };
    if (fuente === 'FACEBOOK') {
      body.modo = modoFb;
      body.target = targetFb.trim();
    }

    const res = await fetchVpsPost('/api/cazar_lote_10', body);
    setCazando(null);
    if (res.ok === false || res.vpsOffline) {
      toast.error(res.error || 'No se pudo conectar al VPS para cazar lote.');
      return;
    }

    if (res.async) {
      toast.info(
        res.mensaje ||
          `Cazando en Facebook para ${perfilNichoActual.nombre_negocio}. Los prospectos se actualizarán automáticamente.`
      );
      setMostrarModalFb(false);
      iniciarPollingAutoRefresco();
      return;
    }

    toast.success(
      `Lote de prospectos (${fuente}) actualizado para ${perfilNichoActual.nombre_negocio}.`
    );
    await cargarDatos(nichoActivo);
  };

  const handleCrearNicho = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNicho.nombre_negocio.trim() || !formNicho.giro_objetivo.trim()) {
      toast.error('Completa al menos el Nombre del Negocio y el Giro Objetivo.');
      return;
    }
    setGuardandoNicho(true);
    const res = await fetchVpsPost('/api/nichos', {
      ...formNicho,
      catalogo_y_reglas: formNicho.catalogo_y_reglas.slice(0, 2500),
    });
    setGuardandoNicho(false);

    if (!res.ok || res.vpsOffline) {
      toast.error(res.error || 'No se pudo guardar el nuevo nicho.');
      return;
    }

    if (Array.isArray(res.nichos)) {
      setNichos(res.nichos);
    }
    const nuevoCid = res.cliente_id || 'mallas_tlaxcalli';
    setNichoActivo(nuevoCid);
    setPaginaLote(0);
    setMostrarModalNicho(false);
    setFormNicho({
      nombre_negocio: '',
      nombre_agente: 'Andrea',
      giro_objetivo: '',
      keywords_busqueda: '',
      codigo_scian_inegi: '',
      oferta_gancho: '',
      catalogo_y_reglas: '',
    });
    toast.success(`Nicho "${formNicho.nombre_negocio}" creado y activado.`);
    await cargarDatos(nuevoCid);
  };

  const handleToggleNichoWorker = async () => {
    const nuevoEstado = !perfilNichoActual.activo;
    const res = await fetchVpsPost('/api/nichos/toggle', {
      cliente_id: perfilNichoActual.cliente_id,
      activo: nuevoEstado,
    });
    if (!res.ok || res.vpsOffline) {
      toast.error(res.error || 'No se pudo cambiar el estado del nicho.');
      return;
    }
    if (Array.isArray(res.nichos)) {
      setNichos(res.nichos);
    }
    toast.success(
      nuevoEstado
        ? `Nicho ${perfilNichoActual.nombre_negocio} activado en el Cazador 24/7.`
        : `Nicho ${perfilNichoActual.nombre_negocio} pausado en el Cazador 24/7.`
    );
  };

  const handleMarcarMaps = async (
    telefono: string,
    estatus: 'ABIERTA_VERIFICADA' | 'CERRADA_DESCARTADA'
  ) => {
    setProspectos((prev) =>
      prev.map((p) => (p.telefono === telefono ? { ...p, estatus_maps: estatus } : p))
    );
    const res = await fetchVpsPost('/api/marcar_maps', {
      telefono,
      estatus_maps: estatus,
    });
    if (res.ok === false && !res.vpsOffline) {
      toast.error(res.error || 'Error al actualizar estatus en Maps.');
      await cargarDatos(nichoActivo);
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

    const isTlaxcalli =
      (p.id_cliente_agencia || nichoActivo || 'mallas_tlaxcalli').toLowerCase() ===
      'mallas_tlaxcalli';

    const msg = isTlaxcalli
      ? `Hola! Soy de *Mallas Tlaxcalli*. Vimos su negocio "${p.nombre}" en ${p.municipio}. Tenemos el *Paquete Completo* de malla + bandas en *$1,713 MXN* con envío gratis y pago contra entrega. ¿Le gustaría recibir detalles para su máquina?`
      : `Hola! Le saluda ${perfilNichoActual.nombre_agente || 'Andrea'} de *${perfilNichoActual.nombre_negocio}*. Vimos a "${p.nombre}" en ${p.municipio} y queremos compartirle nuestra promoción: *${perfilNichoActual.oferta_gancho || p.oferta_recomendada || 'Oferta Especial'}*. ¿Gusta que le envíe los detalles sin compromiso?`;

    return `https://wa.me/${destino}?text=${encodeURIComponent(msg)}`;
  };

  const defaultFbPlaceholder =
    perfilNichoActual.cliente_id === 'mallas_tlaxcalli'
      ? `Ej: tortilleria maquinaria refacciones ${municipio !== 'TODOS' ? municipio : 'Edomex'}`
      : `Ej: ${perfilNichoActual.keywords_busqueda.split(',')[0] || perfilNichoActual.giro_objetivo} ${
          municipio !== 'TODOS' ? municipio : 'CDMX'
        }`;

  return (
    <div className="space-y-6">
      {/* Barra Superior: Selector Multi-Nicho / Multi-Tenant */}
      <div className="p-4 rounded-xl bg-zinc-950/90 border border-zinc-800/90 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400 shrink-0">
            <Building2 className="w-4 h-4" />
            Nicho / Negocio Activo:
          </div>

          <div className="flex flex-wrap items-center gap-2 flex-1">
            <select
              value={nichoActivo}
              onChange={(e) => {
                setNichoActivo(e.target.value);
                setPaginaLote(0);
              }}
              className="px-3.5 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-sm font-semibold focus:outline-none focus:border-amber-500 min-w-[240px]"
            >
              {nichos.map((n) => (
                <option key={n.cliente_id} value={n.cliente_id}>
                  {n.nombre_negocio} {n.protegido ? '🔒' : ''} ({n.total_prospectos} leads)
                </option>
              ))}
            </select>

            {perfilNichoActual.protegido && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold">
                <Lock className="w-3.5 h-3.5" />
                Tenant Base Protegido
              </span>
            )}

            <button
              type="button"
              onClick={handleToggleNichoWorker}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                perfilNichoActual.activo
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25'
                  : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-zinc-200'
              }`}
              title="Activar o pausar este nicho en la rotación automática 24/7"
            >
              <Power className="w-3.5 h-3.5" />
              {perfilNichoActual.activo ? 'Worker 24/7: Activo' : 'Worker 24/7: En Pausa'}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between lg:justify-end gap-3">
          <div className="flex items-center gap-4 text-xs text-zinc-400 bg-zinc-900/80 border border-zinc-800 px-3 py-1.5 rounded-lg">
            <div>
              Agente IA:{' '}
              <span className="text-zinc-100 font-semibold">
                {perfilNichoActual.nombre_agente || 'Andrea'}
              </span>
            </div>
            <div className="h-3 w-px bg-zinc-800" />
            <div>
              Bitácora WA:{' '}
              <span className="text-emerald-400 font-bold">
                {bitacoraTotal || perfilNichoActual.enviados_wa || 0}
              </span>{' '}
              <span className="text-zinc-500">({bitacoraHoy} hoy)</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setMostrarModalNicho(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            + Nuevo Nicho / Producto
          </button>
        </div>
      </div>

      {/* Modal Dark Obsidian: + Nuevo Nicho / Producto */}
      {mostrarModalNicho && (
        <div className="p-5 rounded-xl bg-zinc-950/95 border border-amber-500/40 space-y-4 shadow-2xl">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div className="flex items-center gap-2 text-amber-400 text-sm font-bold uppercase tracking-wider">
              <Sparkles className="w-4 h-4" />
              Configurar Nuevo Nicho / Producto para Cazador y Andrea IA
            </div>
            <button
              type="button"
              onClick={() => setMostrarModalNicho(false)}
              className="text-zinc-400 hover:text-white text-xs font-semibold"
            >
              ✕ Cerrar
            </button>
          </div>

          <form onSubmit={handleCrearNicho} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Nombre del Negocio / Marca *
                </label>
                <input
                  type="text"
                  required
                  value={formNicho.nombre_negocio}
                  onChange={(e) => setFormNicho({ ...formNicho, nombre_negocio: e.target.value })}
                  placeholder="Ej: Empaques Industriales Bajío"
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Nombre de la Asesora IA (WhatsApp)
                </label>
                <input
                  type="text"
                  value={formNicho.nombre_agente}
                  onChange={(e) => setFormNicho({ ...formNicho, nombre_agente: e.target.value })}
                  placeholder="Ej: Andrea"
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Código SCIAN INEGI (Opcional)
                </label>
                <input
                  type="text"
                  value={formNicho.codigo_scian_inegi}
                  onChange={(e) =>
                    setFormNicho({ ...formNicho, codigo_scian_inegi: e.target.value })
                  }
                  placeholder="Vacío = búsqueda abierta por keywords"
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs font-mono focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Giro / Tipo de Clientes a Prospectar *
                </label>
                <input
                  type="text"
                  required
                  value={formNicho.giro_objetivo}
                  onChange={(e) => setFormNicho({ ...formNicho, giro_objetivo: e.target.value })}
                  placeholder="Ej: Panaderías, Pizzerías y Pastelerías"
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Palabras Clave de Búsqueda (INEGI, Maps y Facebook)
                </label>
                <input
                  type="text"
                  value={formNicho.keywords_busqueda}
                  onChange={(e) =>
                    setFormNicho({ ...formNicho, keywords_busqueda: e.target.value })
                  }
                  placeholder="Ej: panaderia, horno para pan, pasteleria, amasadora"
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Oferta Gancho Principal (Primer contacto en frío y etiqueta de lead) *
              </label>
              <input
                type="text"
                required
                value={formNicho.oferta_gancho}
                onChange={(e) => setFormNicho({ ...formNicho, oferta_gancho: e.target.value })}
                placeholder="Ej: Kit de 10 Charolas Aluminio Reforzado por $1,450 MXN con envío gratis"
                className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-zinc-300">
                  Catálogo de Precios, Objeciones y Reglas de Cierre para Andrea
                </label>
                <span className="text-[11px] text-zinc-500 font-mono">
                  {formNicho.catalogo_y_reglas.length} / 2500 máx.
                </span>
              </div>
              <textarea
                rows={4}
                maxLength={2500}
                value={formNicho.catalogo_y_reglas}
                onChange={(e) =>
                  setFormNicho({ ...formNicho, catalogo_y_reglas: e.target.value.slice(0, 2500) })
                }
                placeholder="Describe precios, garantías, zonas de entrega, métodos de pago y datos necesarios para cerrar pedido. Andrea usará este contexto automáticamente cuando un prospecto de este nicho responda por WhatsApp."
                className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
              <span className="text-[11px] text-zinc-400">
                🔒 El negocio base <strong>Mallas Tlaxcalli</strong> permanece 100% protegido e intacto.
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMostrarModalNicho(false)}
                  className="px-3.5 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-xs font-medium hover:bg-zinc-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoNicho}
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold transition-colors disabled:opacity-50"
                >
                  {guardandoNicho ? 'Guardando Nicho...' : 'Guardar y Activar Nicho'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <Crosshair className="w-4 h-4" />
            Módulo 1 • Prospección Multi-Fuente ({perfilNichoActual.nombre_negocio})
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Cazador INEGI / Apify Maps / Facebook
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Giro activo: <span className="text-zinc-200">{perfilNichoActual.giro_objetivo}</span> •
            Oferta: <span className="text-amber-300/90">{perfilNichoActual.oferta_gancho}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => cargarDatos(nichoActivo)}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800 text-sm transition-colors disabled:opacity-50"
          >
            <RefreshCw
              className={`w-4 h-4 ${loading || cazaAsyncActiva ? 'animate-spin text-blue-400' : ''}`}
            />
            {cazaAsyncActiva ? 'Auto-refrescando...' : 'Actualizar'}
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
          <button
            onClick={() => setMostrarModalFb(true)}
            disabled={cazando !== null}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors disabled:opacity-50 shadow-sm"
          >
            <Share2 className="w-4 h-4" />
            +15 Facebook Grupos
          </button>
        </div>
      </div>

      {/* Modal / Selector Híbrido de Facebook */}
      {mostrarModalFb && (
        <div className="p-4 rounded-xl bg-zinc-900/90 border border-indigo-500/40 space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider">
              <Share2 className="w-4 h-4" />
              Cazador en Facebook — {perfilNichoActual.nombre_negocio}
            </div>
            <button
              onClick={() => setMostrarModalFb(false)}
              className="text-zinc-500 hover:text-zinc-300 text-xs"
            >
              ✕ Cerrar
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Estrategia de Búsqueda
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setModoFb('KEYWORD')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold border transition-all ${
                    modoFb === 'KEYWORD'
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                  }`}
                >
                  Por Palabra Clave
                </button>
                <button
                  type="button"
                  onClick={() => setModoFb('GROUP')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold border transition-all ${
                    modoFb === 'GROUP'
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                  }`}
                >
                  URL de Grupo Público
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                {modoFb === 'KEYWORD'
                  ? 'Término o Giro Comercial (opcional)'
                  : 'Enlace directo del Grupo de Facebook'}
              </label>
              <input
                type="text"
                value={targetFb}
                onChange={(e) => setTargetFb(e.target.value)}
                placeholder={
                  modoFb === 'KEYWORD' ? defaultFbPlaceholder : 'https://www.facebook.com/groups/...'
                }
                className="w-full px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => setMostrarModalFb(false)}
              className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 text-xs font-medium hover:bg-zinc-700"
            >
              Cancelar
            </button>
            <button
              onClick={() => handleCazarLote('FACEBOOK')}
              disabled={cazando !== null}
              className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-sm"
            >
              {cazando === 'FACEBOOK' ? 'Extrayendo con IA...' : 'Iniciar Caza en Facebook'}
            </button>
          </div>
        </div>
      )}

      {vpsOffline && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-sm">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Conexión VPS en espera</p>
            <p className="text-amber-200/80 text-xs mt-0.5">
              {errorMsg ||
                'Configura VPS_API_URL y VPS_API_KEY en el entorno para sincronizar prospectos en vivo.'}
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
            WhatsApp de Prueba (Opcional)
          </label>
          <input
            type="text"
            value={telPrueba}
            onChange={(e) => setTelPrueba(e.target.value)}
            placeholder="Ej: 5512345678 (redirige los clics aquí)"
            className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 text-sm focus:outline-none focus:border-blue-500 font-mono"
          />
        </div>

        <div className="flex items-end justify-between lg:justify-end gap-3">
          <div className="text-xs text-zinc-400">
            Prospectos en <span className="text-amber-300 font-semibold">{perfilNichoActual.nombre_negocio}</span>:{' '}
            <span className="font-bold text-white text-sm">{filtrados.length}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPaginaLote((p) => Math.max(0, p - 1))}
              disabled={paginaActual === 0}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-300 hover:bg-zinc-800 text-xs font-medium disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
              Ant.
            </button>
            <span className="text-xs text-zinc-400 px-2 font-mono">
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
                <th className="py-3 px-4">Prospecto / Fuente</th>
                <th className="py-3 px-4">Municipio / Dirección</th>
                <th className="py-3 px-4">Teléfono</th>
                <th className="py-3 px-4">Verificación / Enlace</th>
                <th className="py-3 px-4 text-right">Acción WhatsApp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-zinc-500">
                    Cargando prospectos de {perfilNichoActual.nombre_negocio}...
                  </td>
                </tr>
              ) : loteVisible.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-zinc-500">
                    No hay prospectos registrados en {perfilNichoActual.nombre_negocio} para este filtro. Usa +10 INEGI, +10 Apify Maps o +15 Facebook Grupos.
                  </td>
                </tr>
              ) : (
                loteVisible.map((p, idx) => {
                  const isDescartada = p.estatus_maps === 'CERRADA_DESCARTADA';
                  const isVerificada = p.estatus_maps === 'ABIERTA_VERIFICADA';
                  const isFacebook = (p.fuente || '').toUpperCase().includes('FACEBOOK');

                  return (
                    <tr
                      key={`${p.id_cliente_agencia || nichoActivo}-${p.telefono}-${idx}`}
                      className={`hover:bg-zinc-900/80 transition-colors ${
                        isDescartada ? 'opacity-50' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-white">{p.nombre}</div>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span
                            className={`text-[11px] px-2 py-0.5 rounded font-medium ${
                              isFacebook
                                ? 'bg-indigo-950/80 text-indigo-300 border border-indigo-700/50'
                                : 'bg-zinc-800 text-zinc-300'
                            }`}
                          >
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
                          {isFacebook && p.google_maps_url ? (
                            <a
                              href={p.google_maps_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-indigo-950/70 border border-indigo-800/60 hover:bg-indigo-900 text-indigo-200 text-xs transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
                              Ver Post
                            </a>
                          ) : p.google_maps_url ? (
                            <a
                              href={p.google_maps_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs transition-colors"
                            >
                              <MapPin className="w-3.5 h-3.5 text-blue-400" />
                              Maps
                            </a>
                          ) : null}

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

'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
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
  Lock,
  Building2,
  Sparkles,
  Power,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { fetchVpsGet, fetchVpsPost, FrenteCazaVps, ProspectoVps } from '@/lib/vps/types';
import { useNicho } from '@/context/NichoContext';

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

const CIUDADES_DINAMICAS_MX = [
  'CDMX y Area Metropolitana',
  'Ciudad de México',
  'Ecatepec, Edomex',
  'Tlalnepantla, Edomex',
  'Naucalpan, Edomex',
  'Monterrey, Nuevo León',
  'Guadalajara, Jalisco',
  'Puebla, Puebla',
  'Querétaro, Querétaro',
  'Toluca, Edomex',
  'Tlaxcala, Tlaxcala',
  'León, Guanajuato',
  'Mérida, Yucatán',
];

const PAGE_SIZE = 10;

export default function CazadorPage() {
  const { ownerEmail, isMallasOwner, tienePerfil, nicho, modeloNegocio, loadingNicho, refreshNicho } = useNicho();

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

  // Estado Multi-Frente & Cobertura Dinámica (solo para clientes != mallas_tlaxcalli)
  const [frentes, setFrentes] = useState<FrenteCazaVps[]>([]);
  const [frenteActivoId, setFrenteActivoId] = useState<number | null>(null);
  const [zonaDinamica, setZonaDinamica] = useState<string>('Ciudad de México');
  const [zonasObjetivo, setZonasObjetivo] = useState<string>('CDMX y Area Metropolitana');
  const [flujoContinuoActivo, setFlujoContinuoActivo] = useState<boolean>(true);
  const [autoAbasteciendo, setAutoAbasteciendo] = useState<boolean>(false);
  const [mostrarNuevoFrente, setMostrarNuevoFrente] = useState<boolean>(false);
  const [nuevoFrenteNombre, setNuevoFrenteNombre] = useState<string>('');
  const [nuevoFrenteKws, setNuevoFrenteKws] = useState<string>('');
  const [nuevoFrenteAngulo, setNuevoFrenteAngulo] = useState<string>('');
  const [waConfirmadosTotal, setWaConfirmadosTotal] = useState<number>(0);

  const cargarDatos = useCallback(async () => {
    if (!ownerEmail) return;
    if (!isMallasOwner && !tienePerfil) {
      setProspectos([]);
      setBitacoraTotal(0);
      setBitacoraHoy(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const [data, frentesRes] = await Promise.all([
      fetchVpsGet('/api/datos_seguros', {
        email: ownerEmail,
        ...(nicho?.cliente_id ? { cliente_id: nicho.cliente_id } : {}),
      }),
      !isMallasOwner && nicho?.cliente_id
        ? fetchVpsGet('/api/cazador/frentes', {
            email: ownerEmail,
            cliente_id: nicho.cliente_id,
          })
        : Promise.resolve(null),
    ]);

    if (data.vpsOffline || data.ok === false) {
      setVpsOffline(true);
      setErrorMsg(data.error || 'Servidor VPS sin conexión.');
    } else {
      setVpsOffline(false);
    }

    if (Array.isArray(data.prospectos)) {
      setProspectos(data.prospectos);
    } else {
      setProspectos([]);
    }
    setBitacoraTotal(typeof data.bitacora_total === 'number' ? data.bitacora_total : 0);
    setBitacoraHoy(typeof data.bitacora_hoy === 'number' ? data.bitacora_hoy : 0);

    if (frentesRes && frentesRes.ok && !frentesRes.es_mallas) {
      const listaFr = Array.isArray(frentesRes.frentes) ? (frentesRes.frentes as FrenteCazaVps[]) : [];
      setFrentes(listaFr);
      setFrenteActivoId((prev) => prev ?? (listaFr[0]?.id ?? null));
      if (typeof frentesRes.zonas_objetivo === 'string' && frentesRes.zonas_objetivo.trim()) {
        setZonasObjetivo(frentesRes.zonas_objetivo);
        const primeraZona = frentesRes.zonas_objetivo.split(',')[0]?.trim();
        if (primeraZona) {
          setZonaDinamica((prev) => (prev === 'Ciudad de México' ? primeraZona : prev));
        }
      }
      setFlujoContinuoActivo(Boolean(frentesRes.flujo_continuo_activo));
      setWaConfirmadosTotal(Number(frentesRes.metricas?.wa_confirmados || 0));
    }
    setLoading(false);
  }, [ownerEmail, isMallasOwner, tienePerfil, nicho?.cliente_id]);

  useEffect(() => {
    if (!loadingNicho) {
      cargarDatos();
    }
  }, [cargarDatos, loadingNicho]);

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
      await cargarDatos();
      await refreshNicho();
      if (intentos >= 7) {
        if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
        setCazaAsyncActiva(false);
      }
    }, 5000);
  }, [cargarDatos, refreshNicho]);

  const filtrados = useMemo(() => {
    if (!isMallasOwner && !tienePerfil) return [];
    const activeCid = (nicho?.cliente_id || (isMallasOwner ? 'mallas_tlaxcalli' : '')).toLowerCase();
    return prospectos.filter((p) => {
      const cidRow = (p.id_cliente_agencia || 'mallas_tlaxcalli').toLowerCase();
      if (activeCid && cidRow !== activeCid) {
        return false;
      }
      if (municipio === 'TODOS') return true;
      return (p.municipio || '').toLowerCase().includes(municipio.toLowerCase());
    });
  }, [prospectos, municipio, isMallasOwner, tienePerfil, nicho?.cliente_id]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE));
  const paginaActual = Math.min(paginaLote, totalPaginas - 1);
  const loteVisible = useMemo(() => {
    const start = paginaActual * PAGE_SIZE;
    return filtrados.slice(start, start + PAGE_SIZE);
  }, [filtrados, paginaActual]);

  const handleCazarLote = async (fuente: 'INEGI' | 'APIFY' | 'FACEBOOK') => {
    if (!isMallasOwner && (!tienePerfil || !nicho)) {
      toast.error('Primero define tu producto en "01 • IDEA" para activar el Cazador.');
      return;
    }

    const frenteSeleccionado = !isMallasOwner
      ? frentes.find((f) => f.id === frenteActivoId) || null
      : null;

    setCazando(fuente);
    const body: Record<string, any> = {
      municipio: isMallasOwner ? municipio : zonaDinamica || 'Ciudad de México',
      zona: isMallasOwner ? municipio : zonaDinamica || 'Ciudad de México',
      fuente,
      owner_email: ownerEmail,
      cliente_id: nicho?.cliente_id || 'mallas_tlaxcalli',
      ...(frenteSeleccionado
        ? {
            frente_id: frenteSeleccionado.id,
            frente_nombre: frenteSeleccionado.nombre_frente,
            keywords_frente: frenteSeleccionado.keywords_busqueda,
            angulo_contacto: frenteSeleccionado.angulo_andrea,
          }
        : {}),
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
          `Cazando en Facebook para ${nicho?.nombre_negocio || 'tu negocio'}. Los prospectos se actualizarán automáticamente.`
      );
      setMostrarModalFb(false);
      iniciarPollingAutoRefresco();
      return;
    }

    toast.success(
      `Lote de prospectos (${fuente}) actualizado para ${nicho?.nombre_negocio || 'tu negocio'}.`
    );
    await cargarDatos();
    await refreshNicho();
  };

  const handleToggleFlujoContinuo = async () => {
    if (isMallasOwner || !nicho) return;
    const nuevo = !flujoContinuoActivo;
    setFlujoContinuoActivo(nuevo);
    const res = await fetchVpsPost('/api/cazador/frentes', {
      accion: 'config',
      cliente_id: nicho.cliente_id,
      zonas_objetivo: zonasObjetivo,
      flujo_continuo_activo: nuevo,
    });
    if (!res?.ok) {
      setFlujoContinuoActivo(!nuevo);
      toast.error(res?.error || 'No se pudo actualizar el Flujo Continuo 24/7.');
      return;
    }
    toast.success(nuevo ? 'Flujo Continuo 24/7 activado.' : 'Flujo Continuo 24/7 en pausa.');
  };

  const handleGuardarZonaObjetivo = async (nuevaZona: string) => {
    setZonaDinamica(nuevaZona);
    setZonasObjetivo(nuevaZona);
    if (isMallasOwner || !nicho) return;
    await fetchVpsPost('/api/cazador/frentes', {
      accion: 'config',
      cliente_id: nicho.cliente_id,
      zonas_objetivo: nuevaZona,
      flujo_continuo_activo: flujoContinuoActivo,
    });
  };

  const handleCrearFrente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoFrenteNombre.trim() || !nicho) return;
    const res = await fetchVpsPost('/api/cazador/frentes', {
      accion: 'crear',
      cliente_id: nicho.cliente_id,
      nombre_frente: nuevoFrenteNombre.trim(),
      keywords_busqueda: nuevoFrenteKws.trim() || nicho.keywords_busqueda,
      angulo_andrea: nuevoFrenteAngulo.trim(),
    });
    if (res?.ok) {
      setFrentes(res.frentes || []);
      setNuevoFrenteNombre('');
      setNuevoFrenteKws('');
      setNuevoFrenteAngulo('');
      setMostrarNuevoFrente(false);
      toast.success('Frente de caza agregado.');
    } else {
      toast.error(res?.error || 'No se pudo agregar el frente.');
    }
  };

  const handleAutoAbastecer = async () => {
    if (isMallasOwner || !nicho) return;
    setAutoAbasteciendo(true);
    const res = await fetchVpsPost('/api/cazador/auto-abastecer', {
      cliente_id: nicho.cliente_id,
      forzar: true,
      frente_id: frenteActivoId,
      zona: zonaDinamica,
    });
    setAutoAbasteciendo(false);
    if (res?.ok && !res.omitido) {
      toast.success(
        `Auto-abastecido: ${res.lote_extraido || 0} leads en "${res.frente_nombre}" (${res.zona}).`
      );
      await cargarDatos();
    } else {
      toast.info(res?.motivo || res?.error || 'Sin cambios en la cola actual.');
    }
  };

  const handleToggleNichoWorker = async () => {
    if (!nicho) return;
    const nuevoEstado = !nicho.activo;
    const res = await fetchVpsPost('/api/nichos/toggle', {
      cliente_id: nicho.cliente_id,
      activo: nuevoEstado,
    });
    if (!res.ok || res.vpsOffline) {
      toast.error(res.error || 'No se pudo cambiar el estado del nicho.');
      return;
    }
    await refreshNicho();
    toast.success(
      nuevoEstado
        ? `Nicho ${nicho.nombre_negocio} activado en el Cazador 24/7.`
        : `Nicho ${nicho.nombre_negocio} pausado en el Cazador 24/7.`
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

    const msg = isMallasOwner
      ? `Hola! Soy de *Mallas Tlaxcalli*. Vimos su negocio "${p.nombre}" en ${p.municipio}. Tenemos el *Paquete Completo* de malla + bandas en *$1,713 MXN* con envío gratis y pago contra entrega. ¿Le gustaría recibir detalles para su máquina?`
      : `Hola! Le saluda ${nicho?.nombre_agente || 'Andrea'} de *${nicho?.nombre_negocio || 'nuestro equipo'}*. Vimos a "${p.nombre}" en ${p.municipio} y queremos compartirle nuestra promoción: *${nicho?.oferta_gancho || p.oferta_recomendada || 'Oferta Especial'}*. ¿Gusta que le envíe los detalles sin compromiso?`;

    return `https://wa.me/${destino}?text=${encodeURIComponent(msg)}`;
  };

  // Vista en blanco limpia si el usuario secundario aún no ha definido su idea en 01 • IDEA
  if (!loadingNicho && !isMallasOwner && !tienePerfil) {
    return (
      <div className="space-y-6">
        <div className="border-b border-zinc-800 pb-5">
          <div className="flex items-center gap-2 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <Crosshair className="w-4 h-4" />
            Módulo 1 • Prospección Multi-Fuente
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Cazador INEGI / Apify Maps / Facebook
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Prospectos en base de datos: <span className="text-white font-bold">0</span> • Bitácora WA:{' '}
            <span className="text-white font-bold">0</span>
          </p>
        </div>

        <div className="p-8 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-center max-w-2xl mx-auto space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mx-auto text-cyan-400">
            <Sparkles className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-white">
            Aún no has configurado la idea de tu negocio
          </h2>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Para que el Motor Cazador busque clientes reales en INEGI DENUE, Google Maps y Facebook
            adaptados a tu giro, primero describe qué vendes en el paso{' '}
            <span className="text-cyan-400 font-semibold">01 • IDEA</span> y presiona{' '}
            <span className="text-white font-semibold">&ldquo;Dar inicio a mi idea&rdquo;</span>.
          </p>
          <div className="pt-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-bold text-sm transition-colors shadow-lg"
            >
              Ir a 01 • IDEA para iniciar mi negocio
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const nombreNegocioActivo = nicho?.nombre_negocio || (isMallasOwner ? 'Mallas Tlaxcalli' : 'Mi Negocio');
  const defaultFbPlaceholder = isMallasOwner
    ? `Ej: tortilleria maquinaria refacciones ${municipio !== 'TODOS' ? municipio : 'Edomex'}`
    : `Ej: ${(nicho?.keywords_busqueda || '').split(',')[0] || nicho?.giro_objetivo || 'negocios'} ${
        municipio !== 'TODOS' ? municipio : 'CDMX'
      }`;

  const isB2C = !isMallasOwner && modeloNegocio === 'EMPRENDEDOR_B2C';
  const isServiciosB2B = !isMallasOwner && modeloNegocio === 'SERVICIOS_B2B';

  return (
    <div className="space-y-6">
      {/* Barra Superior Informativa del Negocio del Usuario Logueado */}
      <div className="p-4 rounded-xl bg-zinc-950/90 border border-zinc-800/90 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 shadow-lg">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400">
            <Building2 className="w-4 h-4" />
            Negocio Activo:
          </div>
          <span className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-sm font-semibold">
            {nombreNegocioActivo} {isMallasOwner ? '🔒' : ''}
          </span>

          {isMallasOwner && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold">
              <Lock className="w-3.5 h-3.5" />
              Tenant Propietario Protegido
            </span>
          )}

          {isServiciosB2B && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 text-xs font-semibold">
              🛠️ Prospección Corporativa / Servicios B2B
            </span>
          )}

          {isB2C && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-semibold">
              🛡️ Modo Particular B2C (Inbound Seguro)
            </span>
          )}

          {nicho && !isB2C && (
            <button
              type="button"
              onClick={handleToggleNichoWorker}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                nicho.activo
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25'
                  : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-zinc-200'
              }`}
              title="Activar o pausar tu negocio en la rotación automática 24/7"
            >
              <Power className="w-3.5 h-3.5" />
              {nicho.activo ? 'Worker 24/7: Activo' : 'Worker 24/7: En Pausa'}
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-400 bg-zinc-900/80 border border-zinc-800 px-3.5 py-2 rounded-lg">
          <div>
            Asesora IA:{' '}
            <span className="text-zinc-100 font-semibold">
              {nicho?.nombre_agente || 'Andrea'}
            </span>
          </div>
          <div className="h-3 w-px bg-zinc-800" />
          <div>
            Bitácora WA:{' '}
            <span className="text-emerald-400 font-bold">{bitacoraTotal}</span>{' '}
            <span className="text-zinc-500">({bitacoraHoy} hoy)</span>
          </div>
          {!isMallasOwner && (
            <>
              <div className="h-3 w-px bg-zinc-800" />
              <Link
                href="/dashboard"
                className="text-cyan-400 hover:text-cyan-300 font-semibold"
              >
                Actualizar en 01 • IDEA →
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Panel Especial si el negocio es SERVICIOS_B2B */}
      {isServiciosB2B && (
        <div className="p-4 rounded-xl bg-cyan-950/30 border border-cyan-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="text-xs font-bold uppercase tracking-wider text-cyan-300">
              🏢 Prospección Corporativa / Servicios Técnicos B2B Activa
            </div>
            <p className="text-xs text-zinc-300">
              Clientes Objetivo sugeridos por IA:{' '}
              <strong className="text-white">{nicho?.giro_objetivo}</strong> • Palabras clave de búsqueda:{' '}
              <code className="text-cyan-300">{nicho?.keywords_busqueda}</code>
            </p>
          </div>
        </div>
      )}

      {/* Panel Especial si el negocio es EMPRENDEDOR_B2C (Oculta botones de scraping en frío) */}
      {isB2C ? (
        <div className="p-8 rounded-2xl bg-zinc-900/80 border border-amber-500/30 max-w-3xl mx-auto space-y-5 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold uppercase tracking-wider">
            🛡️ Modo Particular B2C (Inbound Seguro • Cero Bloqueos en WhatsApp)
          </div>
          <h2 className="text-xl font-bold text-white">
            Tu negocio ({nombreNegocioActivo}) vende directo al consumidor final
          </h2>
          <p className="text-sm text-zinc-300 leading-relaxed max-w-2xl mx-auto">
            En ventas por catálogo, comida o comercio local B2C, enviar mensajes masivos en frío a personas desconocidas genera reportes y bloqueos de tu número de WhatsApp. Por eso <strong>BLITZR protege tu línea desactivando el scraping en frío</strong> y manteniendo a <strong>Andrea IA activa 24/7</strong> para cerrar a cada cliente que te escriba por tus anuncios.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold text-xs hover:opacity-95 transition"
            >
              <Sparkles className="w-4 h-4" />
              Ir a 03 • ESTUDIO para crear anuncios Inbound
            </Link>
            <Link
              href="/dashboard/ventas-ia"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 font-semibold text-xs transition"
            >
              Probar a Andrea IA 24/7 →
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-800 pb-5">
          <div>
            <div className="flex items-center gap-2 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-1">
              <Crosshair className="w-4 h-4" />
              Módulo 1 • Prospección Multi-Fuente ({nombreNegocioActivo})
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Cazador INEGI / Apify Maps / Facebook
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              Giro activo: <span className="text-zinc-200">{nicho?.giro_objetivo}</span> • Oferta:{' '}
              <span className="text-amber-300/90">{nicho?.oferta_gancho}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={cargarDatos}
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
      )}

      {/* Modal / Selector Híbrido de Facebook */}
      {mostrarModalFb && (
        <div className="p-4 rounded-xl bg-zinc-900/90 border border-indigo-500/40 space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider">
              <Share2 className="w-4 h-4" />
              Cazador en Facebook — {nombreNegocioActivo}
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

      {/* Panel Multi-Frente & Flujo Continuo (solo para clientes != Mallas Tlaxcalli y no B2C) */}
      {!isMallasOwner && !isB2C && (
        <div className="p-4 rounded-xl bg-zinc-900/70 border border-cyan-500/30 space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                🎯 Frentes de Caza Activos ({frentes.length}) • Cobertura Dinámica
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                WhatsApp Confirmados/Contactados: <strong className="text-emerald-400">{waConfirmadosTotal}</strong> • Rotación automática por frente y zona.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleToggleFlujoContinuo}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                  flujoContinuoActivo
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                    : 'bg-zinc-950 border-zinc-700 text-zinc-400'
                }`}
              >
                <Power className="w-3.5 h-3.5" />
                {flujoContinuoActivo ? 'Flujo Continuo 24/7: ON' : 'Flujo Continuo 24/7: OFF'}
              </button>
              <button
                type="button"
                onClick={handleAutoAbastecer}
                disabled={autoAbasteciendo}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-zinc-950 text-xs font-extrabold transition cursor-pointer disabled:opacity-50"
              >
                <Zap className={`w-3.5 h-3.5 ${autoAbasteciendo ? 'animate-spin' : ''}`} />
                {autoAbasteciendo ? 'Abasteciendo...' : 'Auto-Abastecer Ahora'}
              </button>
              <button
                type="button"
                onClick={() => setMostrarNuevoFrente((v) => !v)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700 cursor-pointer"
              >
                + Frente
              </button>
            </div>
          </div>

          {frentes.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {frentes.map((fr) => {
                const selected = frenteActivoId === fr.id;
                return (
                  <button
                    key={fr.id ?? fr.nombre_frente}
                    type="button"
                    onClick={() => setFrenteActivoId(fr.id ?? null)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition text-left cursor-pointer ${
                      selected
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                        : 'bg-zinc-950/70 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    <span>{fr.nombre_frente}</span>
                    {fr.ticket_estimado && (
                      <span className="ml-1.5 text-[10px] text-emerald-300/90">
                        ({fr.ticket_estimado})
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {mostrarNuevoFrente && (
            <form
              onSubmit={handleCrearFrente}
              className="grid grid-cols-1 md:grid-cols-4 gap-2 pt-2 border-t border-white/10"
            >
              <input
                type="text"
                required
                value={nuevoFrenteNombre}
                onChange={(e) => setNuevoFrenteNombre(e.target.value)}
                placeholder="Nombre del frente (ej. Redes y CCTV)"
                className="px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white"
              />
              <input
                type="text"
                value={nuevoFrenteKws}
                onChange={(e) => setNuevoFrenteKws(e.target.value)}
                placeholder="Palabras clave (ej. oficinas, clinicas)"
                className="px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white"
              />
              <input
                type="text"
                value={nuevoFrenteAngulo}
                onChange={(e) => setNuevoFrenteAngulo(e.target.value)}
                placeholder="Ángulo de apertura para Andrea"
                className="px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white"
              />
              <button
                type="submit"
                className="px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold cursor-pointer"
              >
                Guardar Frente
              </button>
            </form>
          )}
        </div>
      )}

      {/* Filtros y Teléfono de Prueba */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">
            {isMallasOwner ? 'Municipio Objetivo' : 'Ciudad / Estado Dinámico'}
          </label>
          {isMallasOwner ? (
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
          ) : (
            <div className="space-y-1.5">
              <input
                type="text"
                list="ciudades-dinamicas-mx"
                value={zonaDinamica}
                onChange={(e) => {
                  setZonaDinamica(e.target.value);
                  setPaginaLote(0);
                }}
                onBlur={(e) => handleGuardarZonaObjetivo(e.target.value)}
                placeholder="Ej. Monterrey, Nuevo León / Puebla / CDMX"
                className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 text-sm focus:outline-none focus:border-cyan-500"
              />
              <datalist id="ciudades-dinamicas-mx">
                {CIUDADES_DINAMICAS_MX.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          )}
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
            Prospectos en <span className="text-amber-300 font-semibold">{nombreNegocioActivo}</span>:{' '}
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
                    Cargando prospectos de {nombreNegocioActivo}...
                  </td>
                </tr>
              ) : loteVisible.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-zinc-500">
                    No hay prospectos registrados en {nombreNegocioActivo} para este filtro. Usa +10 INEGI, +10 Apify Maps o +15 Facebook Grupos.
                  </td>
                </tr>
              ) : (
                loteVisible.map((p, idx) => {
                  const isDescartada = p.estatus_maps === 'CERRADA_DESCARTADA';
                  const isVerificada = p.estatus_maps === 'ABIERTA_VERIFICADA';
                  const isFacebook = (p.fuente || '').toUpperCase().includes('FACEBOOK');

                  return (
                    <tr
                      key={`${p.id_cliente_agencia || 'nicho'}-${p.telefono}-${idx}`}
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
                          {!isMallasOwner && p.frente_nombre && (
                            <span className="text-[11px] px-2 py-0.5 rounded font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                              Frente: {p.frente_nombre}
                            </span>
                          )}
                          {!isMallasOwner &&
                            ['VERIFICADO_WA', 'WHATSAPP_CONFIRMADO', 'CONTACTADO_WA'].includes(
                              (p.estatus_contacto_wa || '').toUpperCase()
                            ) && (
                              <span className="text-[11px] px-2 py-0.5 rounded font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                ✓ WhatsApp Confirmado
                              </span>
                            )}
                          {!isMallasOwner &&
                            (p.estatus_contacto_wa || '').toUpperCase() === 'SIN_WHATSAPP' && (
                              <span className="text-[11px] px-2 py-0.5 rounded font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                Fijo / Sin WA
                              </span>
                            )}
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

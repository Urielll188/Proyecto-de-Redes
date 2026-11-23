'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Smartphone,
  QrCode,
  KeyRound,
  CheckCircle2,
  RefreshCw,
  Power,
  Unlink,
  Bot,
  UserCog,
  Send,
  Volume2,
  Database,
  Search,
  Download,
  MapPin,
  Phone,
  MessageCircle,
  Crosshair,
  ShieldCheck,
  Sparkles,
  Building2,
  Filter,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { fetchVpsGet, fetchVpsPost, ProspectoVps } from '@/lib/vps/types';

interface WaStatus {
  conectado?: boolean;
  vinculando?: boolean;
  qr_data_url?: string;
  pairingCode?: string;
  codigo_8_digitos?: string;
  miNumero?: string;
  numero_vinculado?: string;
  pausaRespuestasGeneral?: boolean;
  motorPausadoLocal?: boolean;
  motor_50_activo?: boolean;
  fotos_producto_reales?: number;
  fotos_publicidad?: number;
  ultimoError?: string | null;
}

interface ChatMsg {
  role: 'user' | 'assistant';
  text: string;
  audioUrl?: string;
}

type TabKey = 'whatsapp' | 'agentes' | 'cazador';
type FiltroWaKey = 'VERIFICADOS' | 'TODOS' | 'PENDIENTES' | 'FIJOS';

function esWaConfirmado(estatus?: string): boolean {
  const s = (estatus || '').toUpperCase();
  return s === 'VERIFICADO_WA' || s === 'CONTACTADO_WA';
}

function esSinWa(estatus?: string): boolean {
  return (estatus || '').toUpperCase() === 'SIN_WHATSAPP';
}

function construirUrlWaMexico(telefonoRaw?: string, mensaje?: string): string | null {
  const digits = (telefonoRaw || '').replace(/\D/g, '');
  if (digits.length < 10) return null;
  const last10 = digits.slice(-10);
  const textParam = mensaje ? `?text=${encodeURIComponent(mensaje)}` : '';
  return `https://wa.me/52${last10}${textParam}`;
}

const ANDREA_CHIPS = [
  { label: 'Precio del Paquete Completo', text: 'Hola, ¿qué precio tiene el paquete completo de malla y bandas?' },
  { label: 'No sé qué máquina tengo', text: 'Hola, no sé qué modelo de máquina tortilladora tengo, ¿me ayudas?' },
  { label: 'Envío y pago contra entrega', text: '¿Cómo funciona el envío gratis y el pago contra entrega?' },
  { label: 'Soy mecánico (Mayoreo)', text: 'Soy mecánico de tortillerías, ¿manejas precio de mayoreo?' },
];

const MAXIMUS_CHIPS = [
  { label: 'Resumen de hoy', text: 'Dame un resumen en vivo de hoy: cuántas tortillerías tenemos, cuántos mensajes van y si hay pedidos.' },
  { label: 'Desglose por municipio', text: '¿Cuántas tortillerías tenemos extraídas por municipio ahorita?' },
  { label: 'Pedidos y rutas', text: '¿Qué pedidos o entregas tenemos pendientes en logística?' },
];

const PAGE_SIZE = 15;

export function MallasClientHub() {
  const [activeTab, setActiveTab] = useState<TabKey>('whatsapp');

  // 1. Estado WhatsApp en vivo
  const [waStatus, setWaStatus] = useState<WaStatus | null>(null);
  const [loadingWa, setLoadingWa] = useState(true);
  const [ultimaActualizacionWa, setUltimaActualizacionWa] = useState<string>('');
  const [telVincular, setTelVincular] = useState('');
  const [solicitandoCodigo, setSolicitandoCodigo] = useState(false);
  const [solicitandoQr, setSolicitandoQr] = useState(false);
  const [togglingMotor, setTogglingMotor] = useState(false);
  const [desvinculando, setDesvinculando] = useState(false);

  // 2. Estado Base de Datos & Cazador
  const [prospectos, setProspectos] = useState<ProspectoVps[]>([]);
  const [bitacoraHoy, setBitacoraHoy] = useState(0);
  const [bitacoraTotal, setBitacoraTotal] = useState(0);
  const [loadingDb, setLoadingDb] = useState(true);
  const [municipioFiltro, setMunicipioFiltro] = useState('TODOS');
  const [filtroWa, setFiltroWa] = useState<FiltroWaKey>('VERIFICADOS');
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(0);
  const [cazandoLote, setCazandoLote] = useState(false);

  // 3. Andrea Chat
  const [sessionId] = useState(() => `mallas_demo_${Date.now()}`);
  const [andreaMsgs, setAndreaMsgs] = useState<ChatMsg[]>([
    {
      role: 'assistant',
      text: '¡Hola! Bienvenido a Mallas Tlaxcalli. Soy Andrea, tu asesora en línea. Manejamos el Paquete Completo (malla + bandas) en $1,713 MXN con envío gratis y pago contra entrega. ¿Qué modelo de máquina tortilladora manejas?',
    },
  ]);
  const [andreaInput, setAndreaInput] = useState('');
  const [sendingAndrea, setSendingAndrea] = useState(false);
  const [andreaVoz, setAndreaVoz] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 4. Maximus (Dueño)
  const [telDueno, setTelDueno] = useState('');
  const [autorizandoDueno, setAutorizandoDueno] = useState(false);
  const [duenoAutorizadoMsg, setDuenoAutorizadoMsg] = useState<string | null>(null);
  const [maximusMsgs, setMaximusMsgs] = useState<ChatMsg[]>([
    {
      role: 'assistant',
      text: '¡Hola! Soy Maximus, tu asistente personal de Mallas Tlaxcalli. Desde tu WhatsApp puedes pedirme reportes en vivo, cuántos prospectos llevamos por municipio, pausar campañas o mandarme un número nuevo para que Andrea lo contacte.',
    },
  ]);
  const [maximusInput, setMaximusInput] = useState('');
  const [sendingMaximus, setSendingMaximus] = useState(false);

  const cargarWa = useCallback(async () => {
    try {
      const res = await fetchVpsGet('/api/estatus_wa', {
        cliente_id: 'mallas_tlaxcalli',
        mallas_demo: '1',
      });
      if (res && !res.vpsOffline) {
        setWaStatus(res as WaStatus);
        setUltimaActualizacionWa(new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      }
    } catch {
      // silencioso
    } finally {
      setLoadingWa(false);
    }
  }, []);

  const cargarDatos = useCallback(async () => {
    setLoadingDb(true);
    try {
      const res = await fetchVpsGet('/api/datos_seguros', {
        cliente_id: 'mallas_tlaxcalli',
        mallas_demo: '1',
      });
      if (res && !res.vpsOffline && res.ok !== false) {
        setProspectos(Array.isArray(res.prospectos) ? res.prospectos : []);
        setBitacoraHoy(Number(res.bitacora_hoy || 0));
        setBitacoraTotal(Number(res.bitacora_total || 0));
      }
    } catch {
      // silencioso
    } finally {
      setLoadingDb(false);
    }
  }, []);

  useEffect(() => {
    cargarWa();
    cargarDatos();
    const timer = setInterval(cargarWa, 2500);
    return () => clearInterval(timer);
  }, [cargarWa, cargarDatos]);

  // Acciones WhatsApp
  const handlePedirCodigo8 = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = telVincular.replace(/\D/g, '');
    if (digits.length < 10) {
      toast.error('Ingresa los 10 dígitos del WhatsApp del negocio.');
      return;
    }
    setSolicitandoCodigo(true);
    const res = await fetchVpsPost('/api/vincular_wa', {
      cliente_id: 'mallas_tlaxcalli',
      telefono: digits,
      mallas_demo: true,
    });
    setSolicitandoCodigo(false);
    const code = (res?.pairingCode || res?.codigo_8_digitos || res?.codigo || '') as string;
    if (res?.ok && code) {
      toast.success(`Código generado: ${code}`);
      cargarWa();
    } else {
      toast.error(String(res?.error || 'No se pudo generar el código. Intenta con el QR.'));
    }
  };

  const handlePedirQr = async () => {
    setSolicitandoQr(true);
    await fetchVpsPost('/api/vincular_wa', {
      cliente_id: 'mallas_tlaxcalli',
      modo: 'qr',
      mallas_demo: true,
    });
    setSolicitandoQr(false);
    toast.success('Solicitando QR actualizado...');
    setTimeout(cargarWa, 1200);
  };

  const handleToggleAndrea = async (activar: boolean) => {
    setTogglingMotor(true);
    const res = await fetchVpsPost('/api/control_motor', {
      cliente_id: 'mallas_tlaxcalli',
      accion: activar ? 'activar' : 'pausar',
      mallas_demo: true,
    });
    setTogglingMotor(false);
    if (res?.ok !== false) {
      toast.success(activar ? 'Andrea activada en WhatsApp.' : 'Respuestas de Andrea pausadas.');
      cargarWa();
    } else {
      toast.error(String(res?.error || 'No se pudo cambiar el estado del motor.'));
    }
  };

  const handleDesvincular = async () => {
    if (!window.confirm('¿Desvincular la sesión actual de WhatsApp para enlazar otro teléfono?')) return;
    setDesvinculando(true);
    await fetchVpsPost('/api/desvincular_wa', {
      cliente_id: 'mallas_tlaxcalli',
      mallas_demo: true,
    });
    setDesvinculando(false);
    toast.info('Sesión desvinculada. Generando QR nuevo...');
    setTimeout(cargarWa, 1500);
  };

  // Acciones Andrea
  const playAudio = (url?: string) => {
    if (!url) return;
    try {
      if (audioRef.current) audioRef.current.pause();
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.play().catch(() => {});
    } catch {
      // ignore
    }
  };

  const enviarAndrea = async (texto?: string) => {
    const content = (texto ?? andreaInput).trim();
    if (!content || sendingAndrea) return;
    setAndreaMsgs((prev) => [...prev, { role: 'user', text: content }]);
    if (!texto) setAndreaInput('');
    setSendingAndrea(true);
    try {
      const res = await fetchVpsPost('/api/chat', {
        session_id: sessionId,
        mensaje: content,
        incluir_voz: andreaVoz,
        cliente_id: 'mallas_tlaxcalli',
        mallas_demo: true,
      });
      const reply = String(res?.respuesta || res?.reply || res?.error || 'Sin respuesta del servidor.');
      const audioUrl = res?.audio_data_url as string | undefined;
      setAndreaMsgs((prev) => [...prev, { role: 'assistant', text: reply, audioUrl }]);
      if (andreaVoz && audioUrl) playAudio(audioUrl);
    } catch {
      setAndreaMsgs((prev) => [
        ...prev,
        { role: 'assistant', text: 'Hubo una pausa en la conexión. Intenta enviar el mensaje de nuevo.' },
      ]);
    } finally {
      setSendingAndrea(false);
    }
  };

  // Acciones Maximus
  const handleAutorizarDueno = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = telDueno.replace(/\D/g, '');
    if (digits.length < 10) {
      toast.error('Ingresa los 10 dígitos del WhatsApp personal del dueño.');
      return;
    }
    const last10 = digits.slice(-10);
    const jid = `521${last10}@s.whatsapp.net`;

    setAutorizandoDueno(true);
    try {
      const res = await fetchVpsPost('/api/verificar_dueno_wa', {
        jid,
        autorizar: true,
        texto: 'Autorizado desde Panel Mallas',
        mallas_demo: true,
      });
      if (res?.es_dueno) {
        setDuenoAutorizadoMsg(`Número ${last10} autorizado con Maximus en WhatsApp.`);
        toast.success('WhatsApp del dueño autorizado con Maximus.');
        setTelDueno('');
      } else {
        toast.error(String(res?.error || 'No se pudo autorizar el número.'));
      }
    } catch {
      toast.error('No se pudo conectar con la VPS para autorizar.');
    } finally {
      setAutorizandoDueno(false);
    }
  };

  const enviarMaximus = async (texto?: string) => {
    const content = (texto ?? maximusInput).trim();
    if (!content || sendingMaximus) return;
    setMaximusMsgs((prev) => [...prev, { role: 'user', text: content }]);
    if (!texto) setMaximusInput('');
    setSendingMaximus(true);
    try {
      const res = await fetchVpsPost('/api/agente_ceo_pau', {
        mensaje: content,
        session_id: `maximus_demo_${sessionId}`,
        mallas_demo: true,
      });
      if (res?.vpsOffline) {
        setMaximusMsgs((prev) => [
          ...prev,
          { role: 'assistant', text: 'La VPS tardó en responder. Intenta de nuevo con una pregunta corta.' },
        ]);
        return;
      }
      const reply = String(
        res?.respuesta_ceo || res?.respuesta || res?.reply || res?.error || 'Maximus no respondió en este momento.'
      );
      setMaximusMsgs((prev) => [...prev, { role: 'assistant', text: reply }]);
    } catch {
      setMaximusMsgs((prev) => [
        ...prev,
        { role: 'assistant', text: 'Se agotó el tiempo de espera. Vuelve a intentar en un segundo.' },
      ]);
    } finally {
      setSendingMaximus(false);
    }
  };

  // Acción Cazar Lote +10 en vivo
  const handleCazarLote = async () => {
    setCazandoLote(true);
    const res = await fetchVpsPost('/api/cazar_lote_10', {
      municipio: municipioFiltro === 'TODOS' ? 'Ecatepec' : municipioFiltro,
      cliente_id: 'mallas_tlaxcalli',
      mallas_demo: true,
    });
    setCazandoLote(false);
    if (res?.ok !== false) {
      toast.success('Búsqueda ejecutada. Actualizando base de datos...');
      cargarDatos();
    } else {
      toast.error(String(res?.error || 'No se pudo ejecutar la búsqueda en vivo.'));
    }
  };

  // Métricas e informe por municipio
  const estadisticasMunicipio = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of prospectos) {
      const mun = (p.municipio || 'Sin municipio').trim();
      map[mun] = (map[mun] || 0) + 1;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [prospectos]);

  const maxPorMunicipio = estadisticasMunicipio[0]?.[1] || 1;

  const waConfirmadosCount = useMemo(
    () => prospectos.filter((p) => esWaConfirmado(p.estatus_contacto_wa)).length,
    [prospectos]
  );

  const pendientesCount = useMemo(
    () =>
      prospectos.filter(
        (p) => !esWaConfirmado(p.estatus_contacto_wa) && !esSinWa(p.estatus_contacto_wa)
      ).length,
    [prospectos]
  );

  const fijosCount = useMemo(
    () => prospectos.filter((p) => esSinWa(p.estatus_contacto_wa)).length,
    [prospectos]
  );

  const municipiosLista = useMemo(
    () => ['TODOS', ...estadisticasMunicipio.map(([m]) => m)],
    [estadisticasMunicipio]
  );

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const list = prospectos.filter((p) => {
      if (municipioFiltro !== 'TODOS' && (p.municipio || '').trim() !== municipioFiltro) {
        return false;
      }
      if (filtroWa === 'VERIFICADOS' && !esWaConfirmado(p.estatus_contacto_wa)) {
        return false;
      }
      if (
        filtroWa === 'PENDIENTES' &&
        (esWaConfirmado(p.estatus_contacto_wa) || esSinWa(p.estatus_contacto_wa))
      ) {
        return false;
      }
      if (filtroWa === 'FIJOS' && !esSinWa(p.estatus_contacto_wa)) {
        return false;
      }
      if (!q) return true;
      return (
        (p.nombre || '').toLowerCase().includes(q) ||
        (p.telefono || '').toLowerCase().includes(q) ||
        (p.municipio || '').toLowerCase().includes(q) ||
        (p.fuente || '').toLowerCase().includes(q)
      );
    });

    // Priorizar siempre WhatsApp confirmado arriba, luego pendientes, luego fijos
    return [...list].sort((a, b) => {
      const rank = (p: ProspectoVps) =>
        esWaConfirmado(p.estatus_contacto_wa) ? 0 : esSinWa(p.estatus_contacto_wa) ? 2 : 1;
      return rank(a) - rank(b);
    });
  }, [prospectos, municipioFiltro, filtroWa, busqueda]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE));
  const paginaSegura = Math.min(pagina, totalPaginas - 1);
  const visibles = filtrados.slice(paginaSegura * PAGE_SIZE, (paginaSegura + 1) * PAGE_SIZE);

  const conectado = Boolean(waStatus?.conectado);
  const numeroWa = waStatus?.miNumero || waStatus?.numero_vinculado || '';
  const pairingCode = waStatus?.pairingCode || waStatus?.codigo_8_digitos || '';
  const andreaActiva = !waStatus?.pausaRespuestasGeneral;

  return (
    <div className="space-y-6 pb-16 select-text">
      {/* HEADER EJECUTIVO EXCLUSIVO MALLAS TLAXCALLI */}
      <section className="rounded-3xl bg-gradient-to-br from-zinc-900 via-zinc-900 to-amber-950/30 border border-amber-500/30 p-5 sm:p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-400/30 text-amber-300 text-xs font-bold mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              Vista Exclusiva • Mallas Tlaxcalli
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Centro de Comando WhatsApp + Cazador
            </h1>
            <p className="text-sm text-zinc-300 mt-1">
              Conecta el WhatsApp de Mallas al instante, prueba a Andrea y Maximus en vivo, y revisa la base de tortillerías extraídas.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <div
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl border text-xs font-bold ${
                conectado
                  ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300'
                  : 'bg-amber-500/15 border-amber-400/40 text-amber-200'
              }`}
            >
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  conectado ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              />
              {conectado ? `WhatsApp Conectado (${numeroWa || 'Activo'})` : 'WhatsApp Listo para Vincular'}
            </div>

            <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-cyan-500/15 border border-cyan-400/30 text-cyan-200 text-xs font-bold">
              <Database className="w-3.5 h-3.5" />
              {prospectos.length} prospectos en base
            </div>
          </div>
        </div>

        {/* NAVEGACIÓN DE 3 BLOQUES (GRANDE PARA MÓVIL Y LAPTOP) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-5">
          <button
            type="button"
            onClick={() => setActiveTab('whatsapp')}
            className={`min-h-[52px] px-4 py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 border transition-all cursor-pointer ${
              activeTab === 'whatsapp'
                ? 'bg-emerald-500 text-zinc-950 border-emerald-400 shadow-lg shadow-emerald-500/20'
                : 'bg-zinc-950/70 text-zinc-300 border-white/10 hover:bg-zinc-800'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            1. Conectar WhatsApp
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('agentes')}
            className={`min-h-[52px] px-4 py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 border transition-all cursor-pointer ${
              activeTab === 'agentes'
                ? 'bg-amber-400 text-zinc-950 border-amber-300 shadow-lg shadow-amber-500/20'
                : 'bg-zinc-950/70 text-zinc-300 border-white/10 hover:bg-zinc-800'
            }`}
          >
            <Bot className="w-4 h-4" />
            2. Andrea + Maximus
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('cazador')}
            className={`min-h-[52px] px-4 py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 border transition-all cursor-pointer ${
              activeTab === 'cazador'
                ? 'bg-cyan-400 text-zinc-950 border-cyan-300 shadow-lg shadow-cyan-500/20'
                : 'bg-zinc-950/70 text-zinc-300 border-white/10 hover:bg-zinc-800'
            }`}
          >
            <Crosshair className="w-4 h-4" />
            3. Informe Cazador ({prospectos.length})
          </button>
        </div>
      </section>

      {/* ==================== BLOQUE 1: CONECTAR WHATSAPP EN VIVO ==================== */}
      {activeTab === 'whatsapp' && (
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Columna QR / Estado */}
          <div className="lg:col-span-7 rounded-3xl bg-zinc-900/90 border border-white/10 p-5 sm:p-6 space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-emerald-400" />
                  Vincular WhatsApp de Mallas Tlaxcalli
                </h2>
                <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
                  Escanea este código desde WhatsApp → Dispositivos vinculados → Vincular dispositivo.
                </p>
              </div>
              <button
                type="button"
                onClick={cargarWa}
                className="p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-white/10 cursor-pointer"
                title="Actualizar estado"
              >
                <RefreshCw className={`w-4 h-4 ${loadingWa ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {conectado ? (
              <div className="rounded-2xl bg-emerald-950/40 border border-emerald-500/40 p-6 text-center space-y-3">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
                <h3 className="text-xl font-black text-white">¡WhatsApp Conectado en Vivo!</h3>
                <p className="text-sm text-emerald-200">
                  Línea activa: <strong>{numeroWa || 'Sesión Mallas Tlaxcalli'}</strong>
                </p>
                <p className="text-xs text-zinc-300">
                  Andrea ya puede responder prospectos con texto, notas de voz y las {waStatus?.fotos_producto_reales ?? 13} fotos reales del catálogo.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-2xl bg-zinc-950/80 border border-white/10 p-5 space-y-4">
                <div className="w-full rounded-xl bg-amber-500/10 border border-amber-400/30 px-3.5 py-2.5 text-xs text-amber-200 leading-relaxed">
                  <strong>Importante:</strong> No uses la cámara normal del celular. Abre{' '}
                  <strong>WhatsApp → menú (⋮) → Dispositivos vinculados → Vincular un dispositivo</strong> y apunta a este QR.
                </div>

                {waStatus?.qr_data_url ? (
                  <div className="p-3 bg-white rounded-2xl shadow-2xl">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={waStatus.qr_data_url}
                      alt="Código QR WhatsApp Mallas Tlaxcalli"
                      className="w-56 h-56 sm:w-64 sm:h-64 object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-56 h-56 rounded-2xl bg-zinc-900 border border-dashed border-zinc-700 flex flex-col items-center justify-center text-zinc-400 text-xs text-center p-4">
                    <QrCode className="w-8 h-8 mb-2 text-zinc-500" />
                    Presiona &ldquo;Actualizar QR&rdquo; para generar un código fresco.
                  </div>
                )}

                {ultimaActualizacionWa && (
                  <p className="text-[11px] text-emerald-300/90 font-mono">
                    ● QR sincronizado en vivo ({ultimaActualizacionWa})
                  </p>
                )}

                {pairingCode && (
                  <div className="w-full max-w-sm rounded-xl bg-amber-500/10 border border-amber-400/30 p-3 text-center">
                    <p className="text-[11px] uppercase tracking-wider font-bold text-amber-300">
                      Código de 8 dígitos disponible
                    </p>
                    <p className="text-2xl font-black tracking-[0.2em] text-white mt-1 font-mono">
                      {pairingCode}
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handlePedirQr}
                  disabled={solicitandoQr}
                  className="px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-bold border border-white/10 cursor-pointer disabled:opacity-50"
                >
                  {solicitandoQr ? 'Generando QR...' : 'Generar QR nuevo'}
                </button>
              </div>
            )}

            {/* Controles rápidos de motor */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => handleToggleAndrea(!andreaActiva)}
                disabled={togglingMotor}
                className={`min-h-[48px] px-4 py-3 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50 ${
                  andreaActiva
                    ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-400/40'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950'
                }`}
              >
                <Power className="w-4 h-4" />
                {andreaActiva ? 'Andrea ACTIVA (Clic para pausar)' : 'Activar Respuestas de Andrea'}
              </button>

              <button
                type="button"
                onClick={handleDesvincular}
                disabled={desvinculando}
                className="min-h-[48px] px-4 py-3 rounded-2xl bg-zinc-800 hover:bg-red-950/60 hover:text-red-300 text-zinc-300 border border-white/10 font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
              >
                <Unlink className="w-4 h-4" />
                {desvinculando ? 'Desvinculando...' : 'Cambiar / Desvincular línea'}
              </button>
            </div>
          </div>

          {/* Columna Código de 8 dígitos (para vincular desde el mismo celular sin cámara) */}
          <div className="lg:col-span-5 rounded-3xl bg-zinc-900/90 border border-white/10 p-5 sm:p-6 space-y-5">
            <div>
              <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-400" />
                ¿Sin segundo celular? Usa Código de 8 Dígitos
              </h3>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                Escribe el número de WhatsApp del negocio (10 dígitos) y te damos un código para pegarlo directo en WhatsApp.
              </p>
            </div>

            <form onSubmit={handlePedirCodigo8} className="space-y-3">
              <input
                type="tel"
                value={telVincular}
                onChange={(e) => setTelVincular(e.target.value)}
                placeholder="Ej. 5512345678"
                className="w-full px-4 py-3.5 rounded-2xl bg-zinc-950 border border-white/15 text-base text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-400"
              />
              <button
                type="submit"
                disabled={solicitandoCodigo}
                className="w-full min-h-[50px] px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-zinc-950 font-extrabold text-sm cursor-pointer disabled:opacity-50"
              >
                {solicitandoCodigo ? 'Generando código...' : 'Generar Código de 8 Dígitos'}
              </button>
            </form>

            <div className="rounded-2xl bg-zinc-950/70 border border-white/10 p-4 space-y-2.5 text-xs text-zinc-300">
              <p className="font-bold text-white">Pasos rápidos en el teléfono del cliente:</p>
              <p>1. Abre WhatsApp → menú (⋮) → <strong>Dispositivos vinculados</strong>.</p>
              <p>2. Toca <strong>Vincular un dispositivo</strong>.</p>
              <p>3. Si usas código, toca abajo <strong>&ldquo;Vincular con el número de teléfono&rdquo;</strong> e ingresa los 8 caracteres.</p>
              <p className="text-emerald-300 pt-1">
                ✓ Al conectar, Andrea y Maximus quedan activos de inmediato.
              </p>
            </div>

            {/* Tarjeta Conexión Facebook + Instagram */}
            <div className="rounded-2xl bg-blue-950/30 border border-blue-500/30 p-4 space-y-3">
              <div>
                <h4 className="text-sm font-extrabold text-white flex items-center gap-2">
                  📘 Conectar Página de Facebook e Instagram
                </h4>
                <p className="text-xs text-zinc-300 mt-1">
                  Inicia sesión con el Facebook administrador de Mallas Tlaxcalli para vincular su Fan Page e Instagram Business.
                </p>
              </div>
              <a
                href="/api/auth/meta"
                className="w-full min-h-[48px] px-4 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg transition"
              >
                Iniciar sesión con Facebook
              </a>
            </div>
          </div>
        </section>
      )}

      {/* ==================== BLOQUE 2: ANDREA + MAXIMUS EN VIVO ==================== */}
      {activeTab === 'agentes' && (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* TARJETA ANDREA (VENTAS) */}
          <div className="rounded-3xl bg-zinc-900/90 border border-emerald-500/30 flex flex-col overflow-hidden h-[600px]">
            <div className="p-4 bg-emerald-950/30 border-b border-emerald-500/20 flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-white">Andrea • Vendedora IA</h2>
                  <p className="text-xs text-emerald-300">Atiende tortillerías y cierra pedidos 24/7</p>
                </div>
              </div>
              <label className="inline-flex items-center gap-1.5 text-xs text-zinc-200 bg-zinc-900 px-2.5 py-1.5 rounded-xl border border-white/10 cursor-pointer">
                <input
                  type="checkbox"
                  checked={andreaVoz}
                  onChange={(e) => setAndreaVoz(e.target.checked)}
                />
                <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                Voz
              </label>
            </div>

            <div className="px-4 py-2.5 bg-zinc-950/60 border-b border-white/5 flex flex-wrap gap-1.5">
              {ANDREA_CHIPS.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  onClick={() => enviarAndrea(c.text)}
                  disabled={sendingAndrea}
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-zinc-800 hover:bg-emerald-500/20 hover:text-emerald-200 text-zinc-300 border border-white/10 cursor-pointer"
                >
                  {c.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {andreaMsgs.map((m, idx) => (
                <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                      m.role === 'user'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-zinc-800 text-zinc-100 border border-white/10'
                    }`}
                  >
                    {m.text}
                    {m.audioUrl && (
                      <button
                        type="button"
                        onClick={() => playAudio(m.audioUrl)}
                        className="mt-2 inline-flex items-center gap-1.5 text-xs text-emerald-300 hover:underline"
                      >
                        <Volume2 className="w-3.5 h-3.5" /> Escuchar audio
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {sendingAndrea && (
                <div className="text-xs text-emerald-300 animate-pulse">Andrea está escribiendo...</div>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                enviarAndrea();
              }}
              className="p-3 bg-zinc-950/80 border-t border-white/10 flex gap-2"
            >
              <input
                type="text"
                value={andreaInput}
                onChange={(e) => setAndreaInput(e.target.value)}
                placeholder="Escribe como si fueras dueño de tortillería..."
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-white/10 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-400"
              />
              <button
                type="submit"
                disabled={sendingAndrea || !andreaInput.trim()}
                className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold disabled:opacity-40 cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>

          {/* TARJETA MAXIMUS (ASISTENTE DEL DUEÑO) */}
          <div className="rounded-3xl bg-zinc-900/90 border border-amber-500/30 flex flex-col overflow-hidden h-[600px]">
            <div className="p-4 bg-amber-950/30 border-b border-amber-500/20 flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
                  <UserCog className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-white">Maximus • Asistente del Dueño</h2>
                  <p className="text-xs text-amber-300">Reportes en vivo y control total desde tu WhatsApp</p>
                </div>
              </div>
            </div>

            {/* Registro rápido del número del dueño */}
            <form
              onSubmit={handleAutorizarDueno}
              className="p-3.5 bg-zinc-950/80 border-b border-white/10 space-y-2"
            >
              <p className="text-xs font-bold text-amber-200">
                Autorizar WhatsApp del Dueño para hablar con Maximus:
              </p>
              <div className="flex gap-2">
                <input
                  type="tel"
                  value={telDueno}
                  onChange={(e) => setTelDueno(e.target.value)}
                  placeholder="Tu celular (10 dígitos)"
                  className="flex-1 px-3 py-2 rounded-xl bg-zinc-900 border border-white/15 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400"
                />
                <button
                  type="submit"
                  disabled={autorizandoDueno}
                  className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-extrabold text-xs cursor-pointer disabled:opacity-50 shrink-0"
                >
                  {autorizandoDueno ? 'Guardando...' : 'Autorizar Dueño'}
                </button>
              </div>
              {duenoAutorizadoMsg && (
                <p className="text-xs text-emerald-300 font-semibold">✓ {duenoAutorizadoMsg}</p>
              )}
            </form>

            <div className="px-4 py-2 bg-zinc-950/50 border-b border-white/5 flex flex-wrap gap-1.5">
              {MAXIMUS_CHIPS.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  onClick={() => enviarMaximus(c.text)}
                  disabled={sendingMaximus}
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-zinc-800 hover:bg-amber-500/20 hover:text-amber-200 text-zinc-300 border border-white/10 cursor-pointer"
                >
                  {c.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {maximusMsgs.map((m, idx) => (
                <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                      m.role === 'user'
                        ? 'bg-amber-500 text-zinc-950 font-medium'
                        : 'bg-zinc-800 text-zinc-100 border border-white/10'
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              ))}
              {sendingMaximus && (
                <div className="text-xs text-amber-300 animate-pulse">Maximus consultando base de datos en vivo...</div>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                enviarMaximus();
              }}
              className="p-3 bg-zinc-950/80 border-t border-white/10 flex gap-2"
            >
              <input
                type="text"
                value={maximusInput}
                onChange={(e) => setMaximusInput(e.target.value)}
                placeholder="Pídele un reporte o acción a Maximus..."
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-white/10 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400"
              />
              <button
                type="submit"
                disabled={sendingMaximus || !maximusInput.trim()}
                className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold disabled:opacity-40 cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </section>
      )}

      {/* ==================== BLOQUE 3: INFORME DETALLADO DEL CAZADOR + BASE DE DATOS ==================== */}
      {activeTab === 'cazador' && (
        <section className="space-y-5">
          {/* 3.1 INFORME EJECUTIVO: QUÉ BUSCAMOS Y CÓMO LO BUSCAMOS */}
          <div className="rounded-3xl bg-zinc-900/90 border border-cyan-500/30 p-5 sm:p-6 space-y-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                  Informe Técnico de Prospección
                </p>
                <h2 className="text-xl sm:text-2xl font-black text-white mt-0.5">
                  Qué buscamos y cómo extraemos los números
                </h2>
              </div>

              <div className="flex flex-wrap gap-2">
                <a
                  href="/api/vps/proxy?endpoint=/excel_mallas_tlaxcalli.csv&mallas_demo=1"
                  download="base_mallas_tlaxcalli.csv"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-extrabold text-xs transition"
                >
                  <Download className="w-4 h-4" />
                  Descargar Excel / CSV
                </a>
                <button
                  type="button"
                  onClick={handleCazarLote}
                  disabled={cazandoLote}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 border border-cyan-400/40 font-bold text-xs transition cursor-pointer disabled:opacity-50"
                >
                  <Crosshair className={`w-4 h-4 ${cazandoLote ? 'animate-spin' : ''}`} />
                  {cazandoLote ? 'Buscando en vivo...' : 'Cazar +10 Tortillerías Ahora'}
                </button>
              </div>
            </div>

            {/* KPIs rápidos */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-2xl bg-zinc-950/80 border border-white/10 p-4">
                <p className="text-xs text-zinc-400">Prospectos en Base</p>
                <p className="text-2xl font-black text-white mt-1">{prospectos.length}</p>
              </div>
              <div className="rounded-2xl bg-zinc-950/80 border border-white/10 p-4">
                <p className="text-xs text-zinc-400">WhatsApp Confirmado</p>
                <p className="text-2xl font-black text-emerald-400 mt-1">{waConfirmadosCount}</p>
              </div>
              <div className="rounded-2xl bg-zinc-950/80 border border-white/10 p-4">
                <p className="text-xs text-zinc-400">Municipios Cubiertos</p>
                <p className="text-2xl font-black text-cyan-400 mt-1">{estadisticasMunicipio.length}</p>
              </div>
              <div className="rounded-2xl bg-zinc-950/80 border border-white/10 p-4">
                <p className="text-xs text-zinc-400">Contactados (Hoy / Total)</p>
                <p className="text-2xl font-black text-amber-300 mt-1">
                  {bitacoraHoy} / {bitacoraTotal}
                </p>
              </div>
            </div>

            {/* Explicación detallada de Qué y Cómo */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-2xl bg-zinc-950/70 border border-white/10 p-4 space-y-2">
                <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
                  <Building2 className="w-4 h-4" />
                  1. Qué perfiles buscamos
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  <strong>Tortillerías activas</strong>, molinos de nixtamal, refaccionarias y <strong>mecánicos de máquinas tortilladoras</strong> (Verduzco, Celorio, Lenin, Tapia, Rodotec) que requieren cambio periódico de mallas y bandas.
                </p>
              </div>

              <div className="rounded-2xl bg-zinc-950/70 border border-white/10 p-4 space-y-2">
                <div className="flex items-center gap-2 text-cyan-300 font-bold text-sm">
                  <Crosshair className="w-4 h-4" />
                  2. Cómo los extraemos (3 fuentes)
                </div>
                <ul className="text-xs text-zinc-300 space-y-1 leading-relaxed">
                  <li>• <strong>INEGI DENUE:</strong> Directorio nacional por actividad económica de tortillerías.</li>
                  <li>• <strong>Google Maps:</strong> Geolocalización real, horarios y teléfonos por municipio.</li>
                  <li>• <strong>Facebook:</strong> Grupos y páginas de dueños y mecánicos del gremio.</li>
                </ul>
              </div>

              <div className="rounded-2xl bg-zinc-950/70 border border-white/10 p-4 space-y-2">
                <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
                  <ShieldCheck className="w-4 h-4" />
                  3. Limpieza y Meta Diaria
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Validamos teléfonos a 10 dígitos, eliminamos duplicados y clasificamos por municipio para enviar <strong>50 primeros contactos diarios (~1,500 al mes)</strong> sin spam, respetando horarios.
                </p>
              </div>
            </div>

            {/* Desglose visual por municipio */}
            {estadisticasMunicipio.length > 0 && (
              <div className="rounded-2xl bg-zinc-950/70 border border-white/10 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                    Cobertura actual por municipio (clic para filtrar)
                  </p>
                  {municipioFiltro !== 'TODOS' && (
                    <button
                      type="button"
                      onClick={() => {
                        setMunicipioFiltro('TODOS');
                        setPagina(0);
                      }}
                      className="text-xs text-cyan-400 hover:underline cursor-pointer"
                    >
                      Ver todos
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {estadisticasMunicipio.slice(0, 10).map(([mun, count]) => {
                    const pct = Math.max(8, Math.round((count / maxPorMunicipio) * 100));
                    const active = municipioFiltro === mun;
                    return (
                      <button
                        key={mun}
                        type="button"
                        onClick={() => {
                          setMunicipioFiltro(active ? 'TODOS' : mun);
                          setPagina(0);
                        }}
                        className={`text-left p-2.5 rounded-xl border transition cursor-pointer ${
                          active
                            ? 'bg-cyan-500/15 border-cyan-400/50'
                            : 'bg-zinc-900/70 border-white/5 hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-bold mb-1">
                          <span className="text-white truncate">{mun}</span>
                          <span className="text-cyan-300">{count}</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 3.2 BASE DE DATOS DE NÚMEROS EXTRAÍDOS */}
          <div className="rounded-3xl bg-zinc-900/90 border border-white/10 p-5 sm:p-6 space-y-4">
            {/* Pills de filtro por WhatsApp */}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setFiltroWa('VERIFICADOS');
                  setPagina(0);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-extrabold border transition cursor-pointer ${
                  filtroWa === 'VERIFICADOS'
                    ? 'bg-emerald-500 text-zinc-950 border-emerald-400'
                    : 'bg-zinc-950 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/10'
                }`}
              >
                ✓ WhatsApp Confirmado ({waConfirmadosCount})
              </button>
              <button
                type="button"
                onClick={() => {
                  setFiltroWa('TODOS');
                  setPagina(0);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                  filtroWa === 'TODOS'
                    ? 'bg-cyan-400 text-zinc-950 border-cyan-300'
                    : 'bg-zinc-950 text-zinc-300 border-white/10 hover:bg-zinc-800'
                }`}
              >
                Todos ({prospectos.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setFiltroWa('PENDIENTES');
                  setPagina(0);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                  filtroWa === 'PENDIENTES'
                    ? 'bg-zinc-200 text-zinc-950 border-white'
                    : 'bg-zinc-950 text-zinc-300 border-white/10 hover:bg-zinc-800'
                }`}
              >
                Por Verificar ({pendientesCount})
              </button>
              <button
                type="button"
                onClick={() => {
                  setFiltroWa('FIJOS');
                  setPagina(0);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                  filtroWa === 'FIJOS'
                    ? 'bg-amber-400 text-zinc-950 border-amber-300'
                    : 'bg-zinc-950 text-amber-200 border-amber-500/20 hover:bg-amber-500/10'
                }`}
              >
                Solo Llamada / Fijo ({fijosCount})
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-between">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => {
                    setBusqueda(e.target.value);
                    setPagina(0);
                  }}
                  placeholder="Buscar por nombre de tortillería, teléfono o municipio..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-950 border border-white/15 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-zinc-400 shrink-0" />
                <select
                  value={municipioFiltro}
                  onChange={(e) => {
                    setMunicipioFiltro(e.target.value);
                    setPagina(0);
                  }}
                  className="px-3 py-2.5 rounded-xl bg-zinc-950 border border-white/15 text-sm text-white focus:outline-none focus:border-cyan-400"
                >
                  {municipiosLista.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {loadingDb ? (
              <div className="py-12 text-center text-sm text-zinc-400">
                Cargando base de datos en vivo...
              </div>
            ) : visibles.length === 0 ? (
              <div className="py-12 text-center text-sm text-zinc-400">
                No se encontraron prospectos con ese filtro.
              </div>
            ) : (
              <div className="space-y-2.5">
                {visibles.map((p, idx) => {
                  const telDigits = (p.telefono || '').replace(/\D/g, '');
                  const sinWa = esSinWa(p.estatus_contacto_wa);
                  const confirmado = esWaConfirmado(p.estatus_contacto_wa);
                  const waHref = !sinWa
                    ? construirUrlWaMexico(
                        p.telefono,
                        `Hola ${p.nombre}, te saludamos de Mallas Tlaxcalli. Manejamos mallas y bandas para máquina tortilladora con envío gratis y pago contra entrega.`
                      )
                    : null;
                  const telHref = telDigits.length >= 10 ? `tel:+52${telDigits.slice(-10)}` : null;

                  return (
                    <div
                      key={`${p.nombre}-${p.telefono}-${idx}`}
                      className="rounded-2xl bg-zinc-950/75 border border-white/10 p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-extrabold text-white truncate">
                            {p.nombre || 'Negocio sin nombre'}
                          </h3>
                          {confirmado && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                              ✓ WhatsApp Confirmado
                            </span>
                          )}
                          {sinWa && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-400/30">
                              Teléfono Fijo
                            </span>
                          )}
                          {p.fuente && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/20">
                              {p.fuente}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 flex-wrap text-xs text-zinc-400">
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-zinc-500" />
                            {p.municipio || 'Sin municipio'}
                          </span>
                          <span className="inline-flex items-center gap-1 text-zinc-200 font-mono">
                            <Phone className="w-3.5 h-3.5 text-emerald-400" />
                            {p.telefono || 'Sin teléfono'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {waHref ? (
                          <a
                            href={waHref}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-400/30 text-xs font-bold transition"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            WhatsApp
                          </a>
                        ) : null}
                        {telHref && (
                          <a
                            href={telHref}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-white/10 text-xs font-bold transition"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            Llamar
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Paginación */}
            {filtrados.length > PAGE_SIZE && (
              <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs text-zinc-400">
                <span>
                  Mostrando {paginaSegura * PAGE_SIZE + 1}–
                  {Math.min((paginaSegura + 1) * PAGE_SIZE, filtrados.length)} de {filtrados.length}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPagina((p) => Math.max(0, p - 1))}
                    disabled={paginaSegura === 0}
                    className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-white cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="font-bold text-white">
                    {paginaSegura + 1} / {totalPaginas}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPagina((p) => Math.min(totalPaginas - 1, p + 1))}
                    disabled={paginaSegura >= totalPaginas - 1}
                    className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-white cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Store,
  Image as ImageIcon,
  Target,
  Smartphone,
  MessageSquareText,
  Radar,
  ShieldCheck,
  Sparkles,
  Bot,
  UserCog,
  SlidersHorizontal,
} from 'lucide-react';
import { useNicho } from '@/context/NichoContext';
import { fetchVpsGet } from '@/lib/vps/types';

interface PasoConfig {
  id: number;
  titulo: string;
  subtitulo: string;
  tiempo: string;
  descripcion: string;
  detalles: string[];
  accionLabel: string;
  accionHref: string;
  completado: boolean;
  etiquetaFase?: string;
  icono: React.ComponentType<{ className?: string }>;
}

export function PanelFacilView() {
  const { ownerEmail, isMallasOwner, tienePerfil, nicho, modeloNegocio, loadingNicho } = useNicho();

  const [abiertoId, setAbiertoId] = useState<number>(1);
  const [prospectosTotal, setProspectosTotal] = useState<number>(0);
  const [mensajesHoy, setMensajesHoy] = useState<number>(0);
  const [fotosCount, setFotosCount] = useState<number>(0);
  const [waConectado, setWaConectado] = useState<boolean>(false);
  const [waNumero, setWaNumero] = useState<string>('');
  const [cargandoEstado, setCargandoEstado] = useState<boolean>(true);

  useEffect(() => {
    let cancelado = false;

    async function cargarResumen() {
      if (loadingNicho || !ownerEmail) return;
      setCargandoEstado(true);

      try {
        const clienteId = nicho?.cliente_id || (isMallasOwner ? 'mallas_tlaxcalli' : '');
        const [datosRes, waRes] = await Promise.all([
          tienePerfil || isMallasOwner
            ? fetchVpsGet('/api/datos_seguros', {
                email: ownerEmail,
                ...(clienteId ? { cliente_id: clienteId } : {}),
              })
            : Promise.resolve(null),
          clienteId
            ? fetchVpsGet('/estatus_wa', { cliente_id: clienteId })
            : Promise.resolve(null),
        ]);

        if (cancelado) return;

        if (datosRes && !datosRes.vpsOffline && datosRes.ok !== false) {
          setProspectosTotal(Array.isArray(datosRes.prospectos) ? datosRes.prospectos.length : 0);
          setMensajesHoy(Number(datosRes.bitacora_hoy || 0));
          setFotosCount(
            Array.isArray(datosRes.fotos_negocio_pau) ? datosRes.fotos_negocio_pau.length : 0
          );
        }

        if (waRes && !waRes.vpsOffline) {
          setWaConectado(Boolean(waRes.conectado));
          setWaNumero(String(waRes.numero || waRes.telefono || ''));
        }
      } catch {
        // Silencioso para no bloquear la vista móvil
      } finally {
        if (!cancelado) setCargandoEstado(false);
      }
    }

    cargarResumen();
    return () => {
      cancelado = true;
    };
  }, [loadingNicho, ownerEmail, isMallasOwner, tienePerfil, nicho?.cliente_id]);

  const negocioNombre = isMallasOwner
    ? 'Mallas Tlaxcalli'
    : nicho?.nombre_negocio || 'Tu Negocio';

  const modeloLegible = useMemo(() => {
    if (isMallasOwner || modeloNegocio === 'DISTRIBUIDOR_B2B') return 'Venta a Negocios / Mayoreo';
    if (modeloNegocio === 'SERVICIOS_B2B') return 'Servicios Técnicos y Empresas';
    if (modeloNegocio === 'EMPRENDEDOR_B2C') return 'Venta Directa al Cliente Final';
    return 'Por definir en el Paso 1';
  }, [isMallasOwner, modeloNegocio]);

  const paso1Listo = Boolean(tienePerfil || isMallasOwner);
  const paso2Listo = fotosCount > 0;
  const paso3Listo = Boolean((tienePerfil && nicho?.oferta_gancho) || isMallasOwner);
  const paso4Listo = waConectado;
  const paso5Listo = paso1Listo && waConectado;
  const paso6Listo = prospectosTotal > 0;

  const pasos: PasoConfig[] = [
    {
      id: 1,
      titulo: '1. Cuéntanos de tu negocio',
      subtitulo: paso1Listo
        ? `Guardado: ${negocioNombre}`
        : 'Pega tu página web, sube un archivo o escríbelo',
      tiempo: '2 min',
      descripcion:
        'Aquí entrenamos al sistema para que conozca tus productos, precios, zona de cobertura y horarios. Si falta algún dato, la IA te hará preguntas cortas.',
      detalles: [
        'Opción rápida: pega el enlace de tu página web y lo leemos solo.',
        'Próximo en Fase 2: subir PDF/Word y entrevista guiada de dudas frecuentes.',
        'Define tu zona de atención y horario permitido de mensajes.',
      ],
      accionLabel: paso1Listo ? 'Editar datos de mi negocio' : 'Empezar Paso 1',
      accionHref: '/dashboard',
      completado: paso1Listo,
      icono: Store,
    },
    {
      id: 2,
      titulo: '2. Tus fotos o catálogo',
      subtitulo: paso2Listo
        ? `${fotosCount} foto(s) listas para enviar`
        : 'Sube 1 a 3 fotos reales desde tu celular',
      tiempo: '1 min',
      descripcion:
        'Cuando un cliente pregunta en WhatsApp "¿tienes fotos o catálogo?", Andrea le mandará estas imágenes automáticamente para generar confianza inmediata.',
      detalles: [
        'Sube fotos reales de tus productos o trabajos terminados.',
        'Si no tienes fotos, podrás crear un flyer profesional en 1 toque.',
      ],
      accionLabel: paso2Listo ? 'Ver o agregar más fotos' : 'Subir mis fotos',
      accionHref: '/dashboard/marketing-realista',
      completado: paso2Listo,
      icono: ImageIcon,
    },
    {
      id: 3,
      titulo: '3. Estrategia y reglas de seguridad',
      subtitulo: paso3Listo
        ? `Enfoque: ${modeloLegible}`
        : 'Revisa a quién vamos a buscar y aprueba',
      tiempo: '1 min',
      descripcion:
        'Te mostramos en palabras simples a qué clientes vamos a buscar todos los días y qué mensaje enviará Andrea. Tú solo revisas y apruebas.',
      detalles: [
        'Meta automática: mínimo 50 prospectos diarios (~1,500 al mes).',
        'Regla de oro: si un cliente pregunta algo difícil o se enoja, Andrea NO inventa — pausa y le avisa a Maximus en tu WhatsApp.',
      ],
      accionLabel: 'Revisar estrategia actual',
      accionHref: '/dashboard',
      completado: paso3Listo,
      icono: Target,
    },
    {
      id: 4,
      titulo: '4. Conecta WhatsApp y a Maximus',
      subtitulo: paso4Listo
        ? `WhatsApp conectado${waNumero ? ` (${waNumero})` : ''}`
        : 'Vincula el WhatsApp del negocio y tu número de dueño',
      tiempo: '2 min',
      descripcion:
        'Conecta tu WhatsApp una sola vez. A partir de aquí operan tus dos agentes: Andrea atiende clientes y Maximus te reporta directo a tu teléfono.',
      detalles: [
        'Andrea: atiende, cotiza y da seguimiento a prospectos 24/7.',
        'Maximus (Fase 3): tu asistente personal en WhatsApp para pedir reportes, pausar campañas o agregar información nueva.',
        'También puedes conectar Facebook o Instagram si lo deseas.',
      ],
      accionLabel: paso4Listo ? 'Ver estado de conexiones' : 'Conectar mi WhatsApp ahora',
      accionHref: '/dashboard/whatsapp',
      completado: paso4Listo,
      icono: Smartphone,
    },
    {
      id: 5,
      titulo: '5. Prueba a Andrea (30 segundos)',
      subtitulo: 'Hazle 2 preguntas reales antes de encenderla',
      tiempo: '1 min',
      descripcion:
        'Antes de que el sistema contacte a 50 personas al día, habla tú mismo con Andrea como si fueras un cliente. Cuando te convenza, enciendes el motor.',
      detalles: [
        'Pregúntale precios, horarios o dile que está caro para ver cómo responde.',
        'Escucha sus notas de voz reales antes de activar las campañas.',
      ],
      accionLabel: 'Probar a Andrea ahora',
      accionHref: '/dashboard/ventas-ia',
      completado: paso5Listo,
      icono: MessageSquareText,
    },
    {
      id: 6,
      titulo: '6. Tu Radar de Clientes en vivo',
      subtitulo:
        prospectosTotal > 0
          ? `${mensajesHoy} hoy • ${prospectosTotal} prospectos acumulados`
          : 'Mira cómo llegan tus prospectos todos los días',
      tiempo: 'En vivo',
      descripcion:
        'Comprueba con tus propios ojos a quién estamos encontrando y contactando. Cuando veas que ya está corriendo, puedes cerrar la web y controlar todo por WhatsApp.',
      detalles: [
        'Progreso visible hacia tu meta de 50 prospectos diarios.',
        'Resultados constantes por volumen y probabilidad, no por suerte.',
      ],
      accionLabel: 'Abrir mi Radar de Clientes',
      accionHref: '/dashboard/cazador',
      completado: paso6Listo,
      icono: Radar,
    },
  ];

  const completadosCount = pasos.filter((p) => p.completado).length;
  const porcentaje = Math.round((completadosCount / pasos.length) * 100);
  const progresoMetaHoy = Math.min(100, Math.round((mensajesHoy / 50) * 100));

  useEffect(() => {
    if (!cargandoEstado) {
      const primerPendiente = pasos.find((p) => !p.completado);
      if (primerPendiente) {
        setAbiertoId(primerPendiente.id);
      }
    }
    // Solo al terminar la carga inicial
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargandoEstado]);

  return (
    <div className="space-y-5 pb-8 select-text">
      {/* 1. CABECERA CLARA Y PROMESA PRINCIPAL */}
      <section className="rounded-3xl bg-gradient-to-br from-zinc-900 via-zinc-900 to-emerald-950/40 border border-white/10 p-5 sm:p-6 shadow-xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-xs font-bold mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          Panel Fácil • Paso a paso
        </div>

        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
          Automatiza {negocioNombre} en 6 pasos
        </h1>
        <p className="text-sm sm:text-base text-zinc-300 mt-2 leading-relaxed">
          Configura tu negocio <strong>una sola vez aquí</strong> y después controla todo
          directamente desde tu <strong>WhatsApp</strong>.
        </p>

        {/* Barra de progreso general */}
        <div className="mt-5 p-4 rounded-2xl bg-black/40 border border-white/10">
          <div className="flex items-center justify-between text-sm font-bold mb-2">
            <span className="text-zinc-200">Tu avance de configuración</span>
            <span className="text-emerald-400">
              {completadosCount} de {pasos.length} listos
            </span>
          </div>
          <div className="w-full h-3 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-500"
              style={{ width: `${Math.max(8, porcentaje)}%` }}
            />
          </div>
        </div>
      </section>

      {/* 2. TARJETA DE RESULTADOS TANGIBLES (META 50/DÍA) */}
      <section className="rounded-3xl bg-zinc-900/90 border border-cyan-500/25 p-5 shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-cyan-400">
              Motor de Prospectos Automático
            </p>
            <h2 className="text-lg sm:text-xl font-extrabold text-white mt-0.5">
              Meta: 50 prospectos diarios
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1">
              ~1,500 clientes potenciales al mes. Ventas por probabilidad, no por suerte.
            </p>
          </div>
          <div className="text-right shrink-0 bg-cyan-500/10 border border-cyan-400/30 rounded-2xl px-3.5 py-2">
            <p className="text-2xl font-black text-cyan-300 leading-none">{mensajesHoy}</p>
            <p className="text-[11px] font-semibold text-cyan-200/80 mt-1">de 50 hoy</p>
          </div>
        </div>

        <div className="mt-4">
          <div className="w-full h-2.5 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500"
              style={{ width: `${Math.max(mensajesHoy > 0 ? 10 : 3, progresoMetaHoy)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-zinc-400 mt-2">
            <span>Total encontrados: <strong className="text-white">{prospectosTotal}</strong></span>
            <Link
              href="/dashboard/cazador"
              className="text-cyan-400 hover:text-cyan-300 font-semibold inline-flex items-center gap-1"
            >
              Ver Radar
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* 3. TUS 2 AGENTES EN WHATSAPP (EXPLICACIÓN ULTRA CLARA) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-2xl bg-zinc-900/80 border border-white/10 p-4 flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shrink-0">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-extrabold text-white">Andrea • Tu Vendedora</p>
            <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
              Habla con tus clientes en WhatsApp 24/7, manda fotos, responde dudas y cierra pedidos.
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-zinc-900/80 border border-amber-500/20 p-4 flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center text-amber-400 shrink-0">
            <UserCog className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-extrabold text-white">Maximus • Tu Asistente</p>
            <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
              Solo habla contigo en tu WhatsApp: te da reportes diarios y obedece tus cambios.
            </p>
          </div>
        </div>
      </section>

      {/* 4. CHECKLIST INTERACTIVO DE 6 TAREAS */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-base font-extrabold text-white">
            Tus 6 tareas para dejarlo en piloto automático
          </h2>
        </div>

        {pasos.map((paso) => {
          const Icon = paso.icono;
          const estaAbierto = abiertoId === paso.id;

          return (
            <div
              key={paso.id}
              className={`rounded-3xl border transition-all overflow-hidden ${
                paso.completado
                  ? 'bg-emerald-950/20 border-emerald-500/35'
                  : estaAbierto
                  ? 'bg-zinc-900 border-cyan-500/45 shadow-lg shadow-cyan-500/5'
                  : 'bg-zinc-900/75 border-white/10'
              }`}
            >
              <button
                type="button"
                onClick={() => setAbiertoId(estaAbierto ? 0 : paso.id)}
                className="w-full text-left p-4 sm:p-5 flex items-center gap-3.5 cursor-pointer"
                aria-expanded={estaAbierto}
              >
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
                    paso.completado
                      ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
                      : 'bg-zinc-800 border-white/10 text-cyan-300'
                  }`}
                >
                  {paso.completado ? (
                    <CheckCircle2 className="w-6 h-6" />
                  ) : (
                    <Icon className="w-6 h-6" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base sm:text-lg font-extrabold text-white leading-snug">
                      {paso.titulo}
                    </h3>
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        paso.completado
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-white/10 text-zinc-300'
                      }`}
                    >
                      {paso.completado ? 'Listo' : paso.tiempo}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-zinc-400 mt-0.5 truncate">
                    {paso.subtitulo}
                  </p>
                </div>

                <div className="text-zinc-400 shrink-0 pl-1">
                  {estaAbierto ? (
                    <ChevronUp className="w-5 h-5" />
                  ) : (
                    <ChevronDown className="w-5 h-5" />
                  )}
                </div>
              </button>

              {estaAbierto && (
                <div className="px-4 sm:px-5 pb-5 pt-1 border-t border-white/5 space-y-4">
                  <p className="text-sm text-zinc-200 leading-relaxed">{paso.descripcion}</p>

                  <ul className="space-y-2">
                    {paso.detalles.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-zinc-300">
                        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>

                  <Link
                    href={paso.accionHref}
                    className="w-full min-h-[52px] px-5 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-zinc-950 font-extrabold text-base flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98]"
                  >
                    <span>{paso.accionLabel}</span>
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* 5. ACCESO TRANQUILO A VISTA AVANZADA */}
      <section className="rounded-2xl bg-zinc-900/60 border border-white/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-zinc-200">¿Prefieres ver todas las herramientas?</p>
          <p className="text-xs text-zinc-400">
            Tu panel completo de computadora sigue intacto cuando lo necesites.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-zinc-200 text-sm font-bold transition-colors shrink-0"
        >
          <SlidersHorizontal className="w-4 h-4" />
          Ir a Vista Avanzada
        </Link>
      </section>
    </div>
  );
}

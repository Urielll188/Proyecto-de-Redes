'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Bot,
  Send,
  Volume2,
  Sparkles,
  CheckCircle2,
  UserCheck,
  MapPin,
  Clock,
  CreditCard,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { fetchVpsPost } from '@/lib/vps/types';
import { useNicho } from '@/context/NichoContext';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  audioUrl?: string;
}

const MALLAS_TEST_CHIPS = [
  { label: 'No sé qué máquina tengo', prompt: 'Hola, no sé qué modelo de máquina tortilladora tengo.' },
  { label: 'Trampa ¿qué máquina te dije?', prompt: 'Oye, ¿qué máquina te dije hace rato que tenía?' },
  { label: 'Pedir fotos', prompt: '¿Me puedes mandar fotos reales de la malla y las bandas?' },
  { label: 'Candado Anti-Desvío', prompt: '¿Cómo funciona el envío y el pago contra entrega?' },
  { label: 'Mayoreo Mecánicos', prompt: 'Soy mecánico de tortillerías, ¿manejas precio de mayoreo?' },
];

const MUNICIPIOS = [
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

export default function VentasIaPage() {
  const { ownerEmail, isMallasOwner, tienePerfil, nicho, modeloNegocio, loadingNicho } = useNicho();
  const isServiciosB2B = !isMallasOwner && modeloNegocio === 'SERVICIOS_B2B';
  const isB2C = !isMallasOwner && modeloNegocio === 'EMPRENDEDOR_B2C';

  const [sessionId] = useState(() => `web_${Date.now()}`);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMsg, setInputMsg] = useState('');
  const [incluirVoz, setIncluirVoz] = useState(true);
  const [sending, setSending] = useState(false);
  const [playingWelcome, setPlayingWelcome] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Formulario de cierre de pedido / servicio (4 datos -> Módulo 3)
  const [cliente, setCliente] = useState('');
  const [alcanceServicio, setAlcanceServicio] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [municipio, setMunicipio] = useState('Ecatepec');
  const [horario, setHorario] = useState('10:00 AM - 2:00 PM');
  const [metodoPago, setMetodoPago] = useState<'TRANSFERENCIA_CONTRA_ENTREGA' | 'TERMINAL_MERCADO_PAGO'>(
    'TRANSFERENCIA_CONTRA_ENTREGA'
  );
  const [registrando, setRegistrando] = useState(false);

  const welcomeMessageText = useMemo(() => {
    if (isMallasOwner) {
      return '¡Hola! Bienvenido a Mallas Tlaxcalli. Soy tu asesora en línea. Tenemos el Paquete Completo (malla + bandas) en $1,713 MXN con envío gratis y pago contra entrega. ¿Qué modelo de máquina tortilladora manejas?';
    }
    if (tienePerfil && nicho) {
      if (isServiciosB2B) {
        return `¡Hola! Bienvenido a ${nicho.nombre_negocio}. Soy ${nicho.nombre_agente || 'Andrea'}, asesora de proyectos y servicios técnicos. Atendemos: ${nicho.oferta_gancho}. ¿Qué requerimiento o instalación necesitas cotizar para tu empresa?`;
      }
      return `¡Hola! Bienvenido a ${nicho.nombre_negocio}. Soy ${nicho.nombre_agente || 'Andrea'}, tu asesora en línea. Tenemos disponible: ${nicho.oferta_gancho}. ¿Te gustaría conocer los detalles o precios?`;
    }
    return '';
  }, [isMallasOwner, tienePerfil, nicho, isServiciosB2B]);

  useEffect(() => {
    if (welcomeMessageText) {
      setMessages([{ role: 'assistant', text: welcomeMessageText }]);
    } else {
      setMessages([]);
    }
  }, [welcomeMessageText]);

  const activeChips = useMemo(() => {
    if (isMallasOwner) return MALLAS_TEST_CHIPS;
    const prodName = nicho?.nombre_negocio || 'tu producto';
    if (isServiciosB2B) {
      return [
        { label: 'Cotizar instalación / proyecto', prompt: `Hola, necesitamos cotizar un servicio de ${prodName} para nuestra oficina.` },
        { label: 'Agendar levantamiento técnico', prompt: '¿Pueden venir a hacer una visita o levantamiento técnico esta semana?' },
        { label: 'Garantía y factura', prompt: '¿Qué garantía ofrecen en el servicio y dan factura para empresas?' },
        { label: 'Tiempos de ejecución', prompt: '¿En cuánto tiempo realizan la instalación una vez aprobada?' },
      ];
    }
    return [
      { label: 'Pedir precio y promoción', prompt: `Hola, ¿me das información y precio de ${prodName}?` },
      { label: '¿Cómo es la entrega?', prompt: '¿Cómo funciona la entrega a domicilio y formas de pago?' },
      { label: 'Objeción de precio', prompt: 'Se me hace un poco caro, ¿qué beneficio incluye?' },
      { label: 'Precio de mayoreo', prompt: '¿Manejan descuento por volumen o mayoreo?' },
    ];
  }, [isMallasOwner, nicho?.nombre_negocio, isServiciosB2B]);

  const playAudio = (url?: string) => {
    if (!url) return;
    try {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.play().catch(() => {});
    } catch {
      // ignore autoplay block
    }
  };

  const handlePlayWelcome = async () => {
    if (!messages[0]?.text) return;
    setPlayingWelcome(true);
    const res = await fetchVpsPost('/api/tts_voz_mujer', {
      texto: messages[0].text,
    });
    setPlayingWelcome(false);
    const audioUrl = res.audio_data_url as string | undefined;
    if (audioUrl) {
      playAudio(audioUrl);
      toast.success('Reproduciendo nota de voz de bienvenida.');
    } else {
      toast.error(res.error || 'No se pudo generar la voz femenina en el VPS.');
    }
  };

  const enviarMensaje = async (texto?: string) => {
    const content = (texto ?? inputMsg).trim();
    if (!content || sending) return;

    setMessages((prev) => [...prev, { role: 'user', text: content }]);
    if (!texto) setInputMsg('');
    setSending(true);

    const res = await fetchVpsPost('/api/chat', {
      session_id: sessionId,
      mensaje: content,
      incluir_voz: incluirVoz,
      owner_email: ownerEmail,
      cliente_id: nicho?.cliente_id || (isMallasOwner ? 'mallas_tlaxcalli' : ''),
    });
    setSending(false);

    if (res.ok === false || res.vpsOffline) {
      const fallback =
        res.error ||
        'El servidor VPS de la Cerradora IA no respondió. Verifica la conexión en el entorno.';
      setMessages((prev) => [...prev, { role: 'assistant', text: fallback }]);
      toast.error('Error de conexión con Cerradora IA.');
      return;
    }

    const replyText =
      (res.respuesta as string) ||
      (res.reply as string) ||
      (res.mensaje as string) ||
      'Respuesta recibida.';
    const audioUrl = res.audio_data_url as string | undefined;

    setMessages((prev) => [
      ...prev,
      { role: 'assistant', text: replyText, audioUrl },
    ]);

    if (incluirVoz && audioUrl) {
      playAudio(audioUrl);
    }
  };

  const handleRegistrarPedido = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cliente.trim() || !telefono.trim() || !direccion.trim()) {
      toast.error(
        isServiciosB2B
          ? 'Completa nombre de la empresa/cliente, teléfono y ubicación del sitio.'
          : 'Completa nombre del cliente/negocio, teléfono y dirección.'
      );
      return;
    }

    setRegistrando(true);
    const res = await fetchVpsPost('/api/registrar_pedido', {
      owner_email: ownerEmail,
      cliente_id: nicho?.cliente_id || (isMallasOwner ? 'mallas_tlaxcalli' : ''),
      cliente_tortilleria: cliente.trim(),
      telefono: telefono.trim(),
      direccion_gps: direccion.trim(),
      municipio,
      horario_recepcion: horario.trim(),
      metodo_pago: metodoPago,
      ...(isServiciosB2B && alcanceServicio.trim()
        ? { tipo_pedido: alcanceServicio.trim() }
        : {}),
    });
    setRegistrando(false);

    if (res.ok === false || res.vpsOffline) {
      toast.error(res.error || 'No se pudo registrar en el VPS.');
      return;
    }

    toast.success(
      isServiciosB2B
        ? 'Visita / Servicio agendado y enviado a Módulo 3 (Agenda Técnica).'
        : 'Pedido cerrado y enviado a Módulo 3 (Logística).'
    );
    setCliente('');
    setAlcanceServicio('');
    setTelefono('');
    setDireccion('');
  };

  // Estado vacío limpio para usuarios nuevos que aún no definen su idea en 01 • IDEA
  if (!loadingNicho && !isMallasOwner && !tienePerfil) {
    return (
      <div className="space-y-6">
        <div className="border-b border-zinc-800 pb-5">
          <div className="flex items-center gap-2 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <Bot className="w-4 h-4" />
            Módulo 2 • Inteligencia Comercial
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Cerradora IA de Ventas
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Simulador de asesora en línea con voz femenina natural y registro directo de cierres hacia Logística.
          </p>
        </div>

        <div className="p-8 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-center max-w-2xl mx-auto space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mx-auto text-cyan-400">
            <Bot className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-white">
            Entrena a Andrea con la idea de tu negocio
          </h2>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Ve al paso <span className="text-cyan-400 font-semibold">01 • IDEA</span>, describe tu
            producto u oferta y presiona{' '}
            <span className="text-white font-semibold">&ldquo;Dar inicio a mi idea&rdquo;</span>.
            Andrea adoptará automáticamente el catálogo, precios y discurso de cierre de tu negocio.
          </p>
          <div className="pt-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-bold text-sm transition-colors shadow-lg"
            >
              Configurar mi producto en 01 • IDEA
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const tituloNegocio = isMallasOwner
    ? 'Ventas Mallas Tlaxcalli'
    : nicho?.nombre_negocio || 'Mi Negocio';
  const nombreAsesora = isMallasOwner
    ? 'Ventas Mallas Tlaxcalli (Asesora en Línea)'
    : `${nicho?.nombre_agente || 'Andrea'} — ${tituloNegocio} (Asesora en Línea)`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <Bot className="w-4 h-4" />
            Módulo 2 • Inteligencia Comercial
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Cerradora IA &ldquo;{tituloNegocio}&rdquo;
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Simulador de asesora en línea con voz femenina natural y registro directo de cierres hacia Logística.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 cursor-pointer">
            <input
              type="checkbox"
              checked={incluirVoz}
              onChange={(e) => setIncluirVoz(e.target.checked)}
              className="rounded border-zinc-700 bg-zinc-950 text-blue-600 focus:ring-blue-500"
            />
            Auto-Voz Femenina
          </label>
          <button
            onClick={handlePlayWelcome}
            disabled={playingWelcome || !messages[0]?.text}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 text-xs font-medium transition-colors disabled:opacity-50"
          >
            <Volume2 className="w-4 h-4 text-blue-400" />
            {playingWelcome ? 'Generando...' : 'Escuchar Bienvenida'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Columna Izquierda: Chat Cerradora IA */}
        <div className="lg:col-span-7 flex flex-col bg-zinc-900/60 border border-zinc-800 rounded-xl overflow-hidden h-[620px]">
          <div className="px-4 py-3 bg-zinc-950/80 border-b border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-sm font-semibold text-white">{nombreAsesora}</span>
            </div>
            <span className="text-[11px] text-zinc-500 font-mono">Session: {sessionId}</span>
          </div>

          {/* Chips de prueba rápida */}
          <div className="px-4 py-2.5 bg-zinc-950/40 border-b border-zinc-800/80 flex flex-wrap gap-1.5">
            {activeChips.map((chip) => (
              <button
                key={chip.label}
                onClick={() => enviarMensaje(chip.prompt)}
                disabled={sending}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-zinc-800/90 hover:bg-blue-600/20 hover:text-blue-300 border border-zinc-700/70 text-[11px] text-zinc-300 transition-colors"
              >
                <Sparkles className="w-3 h-3 text-blue-400" />
                {chip.label}
              </button>
            ))}
          </div>

          {/* Mensajes */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-sm'
                      : 'bg-zinc-800/90 text-zinc-100 border border-zinc-700/60 rounded-bl-sm'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.text}</p>
                  {m.audioUrl && (
                    <button
                      onClick={() => playAudio(m.audioUrl)}
                      className="mt-2 inline-flex items-center gap-1.5 text-xs text-blue-300 hover:text-blue-200"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      Reproducir audio
                    </button>
                  )}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-zinc-800/70 border border-zinc-700/50 rounded-2xl px-4 py-2.5 text-xs text-zinc-400">
                  Escribiendo respuesta...
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              enviarMensaje();
            }}
            className="p-3 bg-zinc-950/80 border-t border-zinc-800 flex items-center gap-2"
          >
            <input
              type="text"
              value={inputMsg}
              onChange={(e) => setInputMsg(e.target.value)}
              placeholder={
                isMallasOwner
                  ? 'Escribe como si fueras el dueño de la tortillería...'
                  : `Escribe como un cliente interesado en ${tituloNegocio}...`
              }
              className="flex-1 px-3.5 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={sending || !inputMsg.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              Enviar
            </button>
          </form>
        </div>

        {/* Columna Derecha: Formulario Cierre de 4 Datos -> Módulo 3 */}
        <div className="lg:col-span-5 bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-1">
              <CheckCircle2 className="w-4 h-4" />
              {isServiciosB2B
                ? 'Agenda Técnica / Cierre de Servicio'
                : isB2C
                ? 'Cierre de Pedido Particular B2C'
                : 'Cierre Directo a Módulo 3'}
            </div>
            <h2 className="text-lg font-bold text-white">
              {isServiciosB2B
                ? 'Agendar Visita o Servicio Técnico'
                : 'Registrar Pedido Cerrado'}
            </h2>
            <p className="text-xs text-zinc-400 mt-1 mb-5">
              {isServiciosB2B
                ? 'Captura los datos de la empresa, alcance técnico, ubicación del sitio y horario de visita o instalación.'
                : 'Captura los 4 datos de entrega para enviar la orden a la Hoja de Ruta de entregas.'}
            </p>

            <form onSubmit={handleRegistrarPedido} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  {isMallasOwner
                    ? '1. Nombre de Tortillería / Cliente'
                    : isServiciosB2B
                    ? '1. Nombre de Empresa / Cliente'
                    : '1. Nombre del Negocio / Cliente'}
                </label>
                <div className="relative">
                  <UserCheck className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={cliente}
                    onChange={(e) => setCliente(e.target.value)}
                    placeholder={
                      isMallasOwner
                        ? 'Ej: Tortillería La Guadalupana'
                        : isServiciosB2B
                        ? 'Ej: Corporativo / Oficina Cliente'
                        : `Ej: Cliente de ${tituloNegocio}`
                    }
                    className="w-full pl-9 pr-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {isServiciosB2B && (
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    2. Alcance / Servicio Cotizado
                  </label>
                  <input
                    type="text"
                    value={alcanceServicio}
                    onChange={(e) => setAlcanceServicio(e.target.value)}
                    placeholder="Ej: Instalación de 12 nodos de red y 3 Access Points WiFi"
                    className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    {isServiciosB2B ? 'Teléfono de Contacto' : '2. Teléfono WhatsApp'}
                  </label>
                  <input
                    type="text"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="5512345678"
                    className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Municipio
                  </label>
                  <select
                    value={municipio}
                    onChange={(e) => setMunicipio(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    {MUNICIPIOS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  {isServiciosB2B
                    ? '3. Ubicación del Sitio / Instalación'
                    : '3. Dirección Completa / Referencia GPS'}
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={direccion}
                    onChange={(e) => setDireccion(e.target.value)}
                    placeholder={
                      isServiciosB2B
                        ? 'Dirección de oficina, bodega o sucursal a visitar'
                        : 'Calle, Número, Colonia'
                    }
                    className="w-full pl-9 pr-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    {isServiciosB2B
                      ? '4. Fecha / Horario de Visita o Instalación'
                      : '4. Horario de Recepción'}
                  </label>
                  <div className="relative">
                    <Clock className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={horario}
                      onChange={(e) => setHorario(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    {isServiciosB2B ? 'Modalidad de Cobro' : 'Método de Pago'}
                  </label>
                  <div className="relative">
                    <CreditCard className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
                    <select
                      value={metodoPago}
                      onChange={(e) =>
                        setMetodoPago(
                          e.target.value as
                            | 'TRANSFERENCIA_CONTRA_ENTREGA'
                            | 'TERMINAL_MERCADO_PAGO'
                        )
                      }
                      className="w-full pl-9 pr-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="TRANSFERENCIA_CONTRA_ENTREGA">
                        {isServiciosB2B
                          ? 'Transferencia / Anticipo y Finiquito'
                          : 'Transferencia Contra Entrega'}
                      </option>
                      <option value="TERMINAL_MERCADO_PAGO">Terminal Mercado Pago</option>
                    </select>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={registrando}
                className="w-full mt-2 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                {registrando
                  ? 'Registrando...'
                  : isServiciosB2B
                  ? 'Agendar Visita / Servicio en Módulo 3'
                  : 'Confirmar y Enviar a Logística'}
              </button>
            </form>
          </div>

          <div className="mt-6 pt-4 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-500">
            <span>Oferta activa:</span>
            <span className="text-emerald-400 font-semibold truncate max-w-[240px]">
              {isMallasOwner
                ? '$1,713 MXN • Envío Gratis'
                : nicho?.oferta_gancho || 'Promoción Activa'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

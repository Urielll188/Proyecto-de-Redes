'use client';

import React, { useRef, useState } from 'react';
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
} from 'lucide-react';
import { toast } from 'sonner';
import { fetchVpsPost } from '@/lib/vps/types';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  audioUrl?: string;
}

const TEST_CHIPS = [
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
  const [sessionId] = useState(() => `web_${Date.now()}`);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      text: '¡Hola! Bienvenido a Mallas Tlaxcalli. Soy tu asesora en línea. Tenemos el Paquete Completo (malla + bandas) en $1,713 MXN con envío gratis y pago contra entrega. ¿Qué modelo de máquina tortilladora manejas?',
    },
  ]);
  const [inputMsg, setInputMsg] = useState('');
  const [incluirVoz, setIncluirVoz] = useState(true);
  const [sending, setSending] = useState(false);
  const [playingWelcome, setPlayingWelcome] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Formulario de cierre de pedido (4 datos -> Módulo 3)
  const [cliente, setCliente] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [municipio, setMunicipio] = useState('Ecatepec');
  const [horario, setHorario] = useState('10:00 AM - 2:00 PM');
  const [metodoPago, setMetodoPago] = useState<'TRANSFERENCIA_CONTRA_ENTREGA' | 'TERMINAL_MERCADO_PAGO'>(
    'TRANSFERENCIA_CONTRA_ENTREGA'
  );
  const [registrando, setRegistrando] = useState(false);

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
      toast.error('Completa nombre de tortillería, teléfono y dirección.');
      return;
    }

    setRegistrando(true);
    const res = await fetchVpsPost('/api/registrar_pedido', {
      cliente_tortilleria: cliente.trim(),
      telefono: telefono.trim(),
      direccion_gps: direccion.trim(),
      municipio,
      horario_recepcion: horario.trim(),
      metodo_pago: metodoPago,
    });
    setRegistrando(false);

    if (res.ok === false || res.vpsOffline) {
      toast.error(res.error || 'No se pudo registrar el pedido en el VPS.');
      return;
    }

    toast.success('Pedido cerrado y enviado a Módulo 3 (Logística).');
    setCliente('');
    setTelefono('');
    setDireccion('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <Bot className="w-4 h-4" />
            Módulo 2 • Inteligencia Comercial
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Cerradora IA &ldquo;Ventas Mallas Tlaxcalli&rdquo;
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
            disabled={playingWelcome}
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
              <span className="text-sm font-semibold text-white">
                Ventas Mallas Tlaxcalli (Asesora en Línea)
              </span>
            </div>
            <span className="text-[11px] text-zinc-500 font-mono">Session: {sessionId}</span>
          </div>

          {/* Chips de prueba rápida */}
          <div className="px-4 py-2.5 bg-zinc-950/40 border-b border-zinc-800/80 flex flex-wrap gap-1.5">
            {TEST_CHIPS.map((chip) => (
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
              placeholder="Escribe como si fueras el dueño de la tortillería..."
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
              Cierre Directo a Módulo 3
            </div>
            <h2 className="text-lg font-bold text-white">Registrar Pedido Cerrado</h2>
            <p className="text-xs text-zinc-400 mt-1 mb-5">
              Captura los 4 datos de entrega para enviar la orden a la Hoja de Ruta de entregas.
            </p>

            <form onSubmit={handleRegistrarPedido} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  1. Nombre de Tortillería / Cliente
                </label>
                <div className="relative">
                  <UserCheck className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={cliente}
                    onChange={(e) => setCliente(e.target.value)}
                    placeholder="Ej: Tortillería La Guadalupana"
                    className="w-full pl-9 pr-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    2. Teléfono WhatsApp
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
                  3. Dirección Exacta / Referencia GPS
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={direccion}
                    onChange={(e) => setDireccion(e.target.value)}
                    placeholder="Av. Central #45, Col. Jardines"
                    className="w-full pl-9 pr-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    4. Horario de Recepción
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
                    Método de Pago
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
                        Transferencia Contra Entrega
                      </option>
                      <option value="TERMINAL_MERCADO_PAGO">
                        Terminal Mercado Pago
                      </option>
                    </select>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={registrando}
                className="w-full mt-2 py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {registrando
                  ? 'Enviando a Logística...'
                  : 'Cerrar Pedido ($1,713 MXN) -> Módulo 3'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

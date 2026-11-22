'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Smartphone,
  QrCode,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Power,
  ShieldCheck,
  Sparkles,
  Unlink,
  Play,
  Pause,
} from 'lucide-react';
import { useNicho } from '@/context/NichoContext';
import { fetchVpsGet, fetchVpsPost } from '@/lib/vps/types';

interface WaStatusPayload {
  ok?: boolean;
  tiene_perfil?: boolean;
  es_mallas?: boolean;
  cliente_id?: string;
  conectado?: boolean;
  vinculando?: boolean;
  qr?: string;
  qr_data_url?: string;
  pairingCode?: string;
  codigo_8_digitos?: string;
  miNumero?: string;
  numero_vinculado?: string;
  motorPausadoLocal?: boolean;
  pausaRespuestasGeneral?: boolean;
  erroresConsecutivosEnvio?: number;
  motor_50_activo?: boolean;
  ultimoError?: string | null;
}

export function WhatsAppMultiSessionCard() {
  const { ownerEmail, isMallasOwner, tienePerfil, nicho, modeloNegocio, loadingNicho } = useNicho();

  const [status, setStatus] = useState<WaStatusPayload | null>(null);
  const [loadingStatus, setLoadingStatus] = useState<boolean>(true);
  const [telefonoInput, setTelefonoInput] = useState<string>('');
  const [submittingCode, setSubmittingCode] = useState<boolean>(false);
  const [submittingQr, setSubmittingQr] = useState<boolean>(false);
  const [togglingMotor, setTogglingMotor] = useState<boolean>(false);
  const [unlinking, setUnlinking] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const clienteId = nicho?.cliente_id || (isMallasOwner ? 'mallas_tlaxcalli' : '');

  const fetchStatus = useCallback(async () => {
    if (!tienePerfil || !clienteId) {
      setLoadingStatus(false);
      return;
    }
    try {
      const res = await fetchVpsGet('/api/estatus_wa', {
        cliente_id: clienteId,
      });
      if (res) {
        setStatus(res as WaStatusPayload);
      }
    } catch {
      // silent polling error
    } finally {
      setLoadingStatus(false);
    }
  }, [tienePerfil, clienteId]);

  useEffect(() => {
    fetchStatus();
    if (!tienePerfil || !clienteId) return;
    const timer = setInterval(fetchStatus, 3500);
    return () => clearInterval(timer);
  }, [fetchStatus, tienePerfil, clienteId]);

  const handlePedirCodigo8 = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = telefonoInput.replace(/\D/g, '');
    if (digits.length < 10) {
      setFeedbackMsg({
        type: 'err',
        text: 'Ingresa los 10 dígitos de tu número de WhatsApp (ej. 5512345678).',
      });
      return;
    }
    setSubmittingCode(true);
    setFeedbackMsg(null);
    try {
      const res = await fetchVpsPost('/api/vincular_wa', {
        cliente_id: clienteId,
        telefono: digits,
      });
      const code = (res?.pairingCode || res?.codigo_8_digitos || res?.codigo || '') as string;
      if (res?.ok && code) {
        setFeedbackMsg({
          type: 'ok',
          text: `Código generado: ${code}. Ingrésalo en tu WhatsApp en "Vincular con el número de teléfono".`,
        });
      } else if (res?.ok) {
        setFeedbackMsg({
          type: 'ok',
          text: 'Solicitud enviada al puente WhatsApp. Espera unos segundos a que aparezca el código.',
        });
      } else {
        setFeedbackMsg({
          type: 'err',
          text: String(res?.error || 'No se pudo generar el código. Intenta nuevamente en 3 segundos.'),
        });
      }
      await fetchStatus();
    } catch (err: any) {
      setFeedbackMsg({
        type: 'err',
        text: err?.message || 'Error de red al solicitar código de vinculación.',
      });
    } finally {
      setSubmittingCode(false);
    }
  };

  const handleGenerarQr = async () => {
    setSubmittingQr(true);
    setFeedbackMsg(null);
    try {
      const res = await fetchVpsPost('/api/vincular_wa', {
        cliente_id: clienteId,
      });
      if (res?.ok) {
        setFeedbackMsg({
          type: 'ok',
          text: 'Generando código QR aislado para tu negocio. Escanéalo desde WhatsApp -> Dispositivos vinculados.',
        });
      } else {
        setFeedbackMsg({
          type: 'err',
          text: String(res?.error || 'No se pudo iniciar la sesión QR.'),
        });
      }
      await fetchStatus();
    } catch (err: any) {
      setFeedbackMsg({
        type: 'err',
        text: err?.message || 'Error al solicitar QR.',
      });
    } finally {
      setSubmittingQr(false);
    }
  };

  const handleToggleMotorFrio = async () => {
    if (!clienteId) return;
    setTogglingMotor(true);
    setFeedbackMsg(null);
    const isPaused = Boolean(status?.motorPausadoLocal);
    const accion = isPaused ? 'reanudar_frio' : 'pausar_frio';
    try {
      const res = await fetchVpsPost('/api/control_motor', {
        cliente_id: clienteId,
        accion,
        activo: isPaused,
      });
      if (res?.ok) {
        setFeedbackMsg({
          type: 'ok',
          text: isPaused
            ? '▶️ Envíos en frío reanudados (06:00–22:59 CDMX). Andrea responde 24/7.'
            : '⏸️ Envíos en frío pausados. Andrea sigue respondiendo 24/7 a clientes que escriban.',
        });
        await fetchStatus();
      }
    } catch (err: any) {
      setFeedbackMsg({
        type: 'err',
        text: err?.message || 'No se pudo actualizar el estado del motor.',
      });
    } finally {
      setTogglingMotor(false);
    }
  };

  const handleDesvincular = async () => {
    if (isMallasOwner || clienteId === 'mallas_tlaxcalli') return;
    setUnlinking(true);
    setFeedbackMsg(null);
    try {
      const res = await fetchVpsPost('/api/desvincular_wa', {
        cliente_id: clienteId,
      });
      if (res?.ok) {
        setFeedbackMsg({
          type: 'ok',
          text: 'Sesión de WhatsApp desvinculada limpiamente. Ya puedes conectar otro número.',
        });
        await fetchStatus();
      } else {
        setFeedbackMsg({
          type: 'err',
          text: String(res?.error || 'No se pudo desvincular la sesión.'),
        });
      }
    } catch (err: any) {
      setFeedbackMsg({
        type: 'err',
        text: err?.message || 'Error al desvincular WhatsApp.',
      });
    } finally {
      setUnlinking(false);
    }
  };

  if (loadingNicho) {
    return (
      <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3 text-zinc-400 text-sm">
          <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
          Cargando configuración de sesión WhatsApp...
        </div>
      </div>
    );
  }

  if (!isMallasOwner && !tienePerfil) {
    return (
      <div className="bg-zinc-900/90 border border-amber-500/30 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">
                WhatsApp Multi-Sesión (Agente Andrea 24/7 + Cazador)
              </h3>
              <p className="text-xs text-zinc-400">
                Cuenta autenticada: <span className="text-zinc-200 font-medium">{ownerEmail}</span>
              </p>
            </div>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
            Paso 1 Pendiente
          </span>
        </div>

        <div className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800/80 text-xs text-zinc-300 space-y-2 leading-relaxed">
          <p className="font-semibold text-white">
            Primero registra tu producto o idea en <span className="text-amber-400">01 • IDEA</span>
          </p>
          <p className="text-zinc-400">
            Para crearte tu sesión aislada de WhatsApp y configurar a tu asesora IA con tus propios precios y giro comercial, describe primero tu negocio en el generador principal.
          </p>
        </div>

        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold text-xs hover:opacity-95 transition"
        >
          <Sparkles className="w-4 h-4" />
          Ir a 01 • IDEA para activar mi perfil
        </Link>
      </div>
    );
  }

  const conectado = Boolean(status?.conectado);
  const numeroVinculado = status?.numero_vinculado || status?.miNumero || '';
  const codigo8 = status?.pairingCode || status?.codigo_8_digitos || '';
  const qrDataUrl = status?.qr_data_url || '';
  const motorPausado = Boolean(status?.motorPausadoLocal);
  const isB2C = !isMallasOwner && modeloNegocio === 'EMPRENDEDOR_B2C';
  const isServiciosB2B = !isMallasOwner && modeloNegocio === 'SERVICIOS_B2B';
  const modoLineaLabel = isB2C
    ? 'Particular B2C: Solo Respuestas Inbound 24/7'
    : isServiciosB2B
    ? 'Servicios B2B: Prospección Corporativa + Andrea'
    : 'Distribuidor B2B: Cazador + Andrea 24/7';

  return (
    <div className="bg-zinc-900/90 border border-emerald-500/30 rounded-2xl p-6 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-bold text-white text-base">
                Línea de WhatsApp — {nicho?.nombre_negocio || 'Mi Negocio'}
              </h3>
              {isMallasOwner && (
                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold">
                  <ShieldCheck className="w-3 h-3" /> Sesión Principal Protegida
                </span>
              )}
              <span
                className={`inline-flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded-full font-semibold border ${
                  isB2C
                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                    : isServiciosB2B
                    ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                    : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                }`}
              >
                {modoLineaLabel}
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Tenant ID: <code className="text-zinc-300">{clienteId}</code> • Asesora IA:{' '}
              <strong className="text-zinc-200">{nicho?.nombre_agente || 'Andrea'} (24/7)</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full font-semibold ${
              conectado
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                conectado ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            {loadingStatus ? 'Verificando...' : conectado ? 'WhatsApp Conectado' : 'Desconectado'}
          </span>

          <button
            type="button"
            onClick={fetchStatus}
            title="Refrescar estado"
            className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Status Summary Bar */}
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800/80 flex items-center justify-between">
          <div>
            <p className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">
              Número Vinculado
            </p>
            <p className="text-sm font-bold text-white mt-0.5">
              {conectado && numeroVinculado
                ? `+${numeroVinculado}`
                : conectado
                ? 'Sesión Activa en VPS'
                : 'Sin número vinculado'}
            </p>
          </div>
          {conectado ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
          )}
        </div>

        <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800/80 flex items-center justify-between gap-2">
          <div>
            <p className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">
              {isB2C ? 'Modo Operativo B2C (Protección Anti-Spam)' : 'Primer Contacto en Frío (06:00–22:59)'}
            </p>
            <p className="text-xs font-semibold mt-0.5 text-zinc-200">
              {isB2C ? (
                <span className="text-amber-300">
                  🛡️ Solo Respuestas Inbound 24/7 (Cero envíos en frío)
                </span>
              ) : motorPausado ? (
                <span className="text-amber-400">⏸️ En Pausa (Andrea 24/7 sigue activa)</span>
              ) : (
                <span className="text-emerald-400">▶️ Activo (Goteo Anti-Baneo + Andrea 24/7)</span>
              )}
            </p>
          </div>
          {!isB2C && (
            <button
              type="button"
              disabled={togglingMotor}
              onClick={handleToggleMotorFrio}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition shrink-0 ${
                motorPausado
                  ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700'
              }`}
            >
              {motorPausado ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              {motorPausado ? 'Reanudar Frío' : 'Pausar Frío'}
            </button>
          )}
        </div>
      </div>

      {feedbackMsg && (
        <div
          className={`p-3.5 rounded-xl text-xs font-medium border ${
            feedbackMsg.type === 'ok'
              ? 'bg-emerald-950/50 border-emerald-700/60 text-emerald-200'
              : 'bg-red-950/50 border-red-700/60 text-red-200'
          }`}
        >
          {feedbackMsg.text}
        </div>
      )}

      {/* Connection / Pairing Controls (Shown when disconnected or for linking) */}
      {!conectado && (
        <div className="grid md:grid-cols-2 gap-4 pt-1">
          {/* Option 1: 8-digit pairing code */}
          <form
            onSubmit={handlePedirCodigo8}
            className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800/80 space-y-3"
          >
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
              <KeyRound className="w-4 h-4" />
              <span>Opción 1 (Sin Cámara): Código de 8 Dígitos</span>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              En tu WhatsApp ve a <strong>Dispositivos vinculados</strong> →{' '}
              <strong>Vincular un dispositivo</strong> →{' '}
              <strong>Vincular con el número de teléfono</strong>.
            </p>
            <div className="space-y-2">
              <input
                type="tel"
                value={telefonoInput}
                onChange={(e) => setTelefonoInput(e.target.value)}
                placeholder="Tu número a 10 dígitos (ej. 5512345678)"
                className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-xs focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                disabled={submittingCode}
                className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-bold text-xs transition"
              >
                {submittingCode ? 'Generando código en VPS...' : 'Generar Código de 8 Dígitos'}
              </button>
            </div>

            {codigo8 && (
              <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-center space-y-1">
                <p className="text-[11px] text-emerald-300 font-medium">
                  Captura este código en tu WhatsApp:
                </p>
                <p className="text-xl font-mono font-black tracking-widest text-emerald-400">
                  {codigo8}
                </p>
              </div>
            )}
          </form>

          {/* Option 2: QR Code */}
          <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800/80 space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                <QrCode className="w-4 h-4" />
                <span>Opción 2: Escaneo de Código QR</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Abre WhatsApp en tu teléfono → <strong>Dispositivos vinculados</strong> →{' '}
                <strong>Vincular un dispositivo</strong> y escanea el QR de tu sesión.
              </p>
            </div>

            {qrDataUrl ? (
              <div className="flex flex-col items-center justify-center p-3 bg-white rounded-xl mx-auto">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrDataUrl}
                  alt="Código QR WhatsApp"
                  className="w-48 h-48 object-contain"
                />
              </div>
            ) : (
              <div className="p-6 rounded-xl border border-dashed border-zinc-800 text-center text-xs text-zinc-500">
                Presiona el botón inferior para generar un QR nuevo en vivo.
              </div>
            )}

            <button
              type="button"
              disabled={submittingQr}
              onClick={handleGenerarQr}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs transition"
            >
              {submittingQr ? 'Iniciando socket QR...' : qrDataUrl ? 'Actualizar Código QR' : 'Generar Código QR'}
            </button>
          </div>
        </div>
      )}

      {/* Unlink option for secondary tenants */}
      {!isMallasOwner && clienteId !== 'mallas_tlaxcalli' && (conectado || codigo8 || qrDataUrl) && (
        <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between">
          <p className="text-xs text-zinc-400">
            ¿Deseas cambiar de número de WhatsApp para tu negocio?
          </p>
          <button
            type="button"
            disabled={unlinking}
            onClick={handleDesvincular}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-950/50 hover:bg-red-900/60 text-red-300 border border-red-800/50 text-xs font-semibold transition"
          >
            <Unlink className="w-3.5 h-3.5" />
            {unlinking ? 'Desvinculando...' : 'Desvincular número'}
          </button>
        </div>
      )}
    </div>
  );
}

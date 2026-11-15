'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Camera,
  Upload,
  Sparkles,
  Copy,
  Check,
  Image as ImageIcon,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { fetchVpsGet, fetchVpsPost, FotoPauVps } from '@/lib/vps/types';

type FiltroCss = 'natural' | 'contraste' | 'calido' | 'original';

const FILTROS: Record<FiltroCss, { label: string; style: string }> = {
  natural: {
    label: 'Estudio Natural (Balanceado)',
    style: 'contrast(1.06) saturate(1.12) brightness(1.03)',
  },
  contraste: {
    label: 'Alto Contraste Industrial (Acero)',
    style: 'contrast(1.22) saturate(1.08) brightness(0.98)',
  },
  calido: {
    label: 'Cálido Tortillería (Maíz/Dorado)',
    style: 'sepia(0.15) saturate(1.25) contrast(1.05) brightness(1.04)',
  },
  original: {
    label: 'Sin Filtro (Original)',
    style: 'none',
  },
};

export default function MarketingRealistaPage() {
  const [fotos, setFotos] = useState<FotoPauVps[]>([]);
  const [selectedFotoUrl, setSelectedFotoUrl] = useState<string>('');
  const [filtro, setFiltro] = useState<FiltroCss>('natural');
  const [uploading, setUploading] = useState(false);

  const [enfoque, setEnfoque] = useState('Paquete Completo ($1,713 MXN) + Envío Gratis');
  const [zona, setZona] = useState('Norte CDMX y Edomex (Ecatepec, Tultitlán, Coacalco, Naucalpan)');
  const [contenido, setContenido] = useState('');
  const [generando, setGenerando] = useState(false);
  const [copied, setCopied] = useState(false);
  const [vpsOffline, setVpsOffline] = useState(false);

  const cargarFotos = useCallback(async () => {
    const data = await fetchVpsGet('/api/datos_seguros');
    setVpsOffline(Boolean(data.vpsOffline || data.ok === false));
    if (Array.isArray(data.fotos_negocio_pau) && data.fotos_negocio_pau.length > 0) {
      setFotos(data.fotos_negocio_pau);
      setSelectedFotoUrl((prev) => prev || data.fotos_negocio_pau![0].url);
    }
  }, []);

  useEffect(() => {
    cargarFotos();
  }, [cargarFotos]);

  const resolveImageSrc = (url: string) => {
    if (!url) return '';
    if (url.startsWith('data:') || url.startsWith('http')) return url;
    if (url.startsWith('/api/imagen_pau')) {
      const qIndex = url.indexOf('?');
      const params = qIndex >= 0 ? url.slice(qIndex + 1) : '';
      return `/api/vps/proxy?endpoint=/api/imagen_pau${params ? `&${params}` : ''}`;
    }
    return `/api/vps/proxy?endpoint=${encodeURIComponent(url)}`;
  };

  const handleUploadFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setUploading(true);
      const res = await fetchVpsPost('/api/subir_foto_pau', {
        nombre: file.name,
        base64,
      });
      setUploading(false);

      if (res.ok === false || res.vpsOffline) {
        // Preview local incluso si el VPS está offline
        setFotos((prev) => [{ nombre: file.name, tipo: 'local', url: base64 }, ...prev]);
        setSelectedFotoUrl(base64);
        toast.info('Vista previa cargada localmente (VPS sin conexión).');
        return;
      }

      toast.success('Foto subida al catálogo del estudio.');
      await cargarFotos();
    };
    reader.readAsDataURL(file);
  };

  const handleGenerarCampana = async () => {
    setGenerando(true);
    const res = await fetchVpsPost('/api/generar_marketing', { enfoque, zona });
    setGenerando(false);
    if (res.ok === false || res.vpsOffline) {
      toast.error(res.error || 'No se pudo generar la campaña en el VPS.');
      return;
    }
    setContenido((res.contenido as string) || '');
    toast.success('Campaña multicanal generada.');
  };

  const handleCopy = () => {
    if (!contenido) return;
    navigator.clipboard.writeText(contenido);
    setCopied(true);
    toast.success('Copys copiados al portapapeles.');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-zinc-800 pb-5">
        <div className="flex items-center gap-2 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-1">
          <Camera className="w-4 h-4" />
          Módulo 5 • Estudio &amp; Contenido
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">
          Estudio Fotográfico Realista &amp; Generador Multicanal
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Revelado CSS realista sobre fotos reales de negocio y generación de copys para Facebook, Instagram, TikTok y Estados WA.
        </p>
      </div>

      {vpsOffline && (
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>Modo sin conexión VPS: puedes probar el revelado CSS subiendo una foto local.</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tarjeta Izquierda: Estudio Fotográfico */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white">Estudio Fotográfico Realista</h2>
            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium cursor-pointer transition-colors">
              <Upload className="w-3.5 h-3.5" />
              {uploading ? 'Subiendo...' : 'Subir Foto'}
              <input
                type="file"
                accept="image/*"
                onChange={handleUploadFoto}
                className="hidden"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Foto del Catálogo
              </label>
              <select
                value={selectedFotoUrl}
                onChange={(e) => setSelectedFotoUrl(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                {fotos.length === 0 ? (
                  <option value="">Sin fotos cargadas</option>
                ) : (
                  fotos.map((f, i) => (
                    <option key={`${f.nombre}-${i}`} value={f.url}>
                      {f.nombre}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Revelado CSS
              </label>
              <select
                value={filtro}
                onChange={(e) => setFiltro(e.target.value as FiltroCss)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                {(Object.keys(FILTROS) as FiltroCss[]).map((key) => (
                  <option key={key} value={key}>
                    {FILTROS[key].label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Canvas Preview con Marca de Agua */}
          <div className="relative aspect-[4/3] w-full rounded-xl overflow-hidden bg-zinc-950 border border-zinc-800 flex items-center justify-center">
            {selectedFotoUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={resolveImageSrc(selectedFotoUrl)}
                  alt="Vista previa estudio realista"
                  style={{ filter: FILTROS[filtro].style }}
                  className="w-full h-full object-cover transition-all duration-300"
                />
                <div className="absolute bottom-3 left-3 right-3 px-3 py-2 rounded-lg bg-black/75 backdrop-blur-md border border-white/10 text-center">
                  <span className="text-[11px] sm:text-xs font-bold tracking-wider text-white">
                    ⚙️ MALLAS TLAXCALLI • ENVÍO GRATIS ($1,713 MXN)
                  </span>
                </div>
              </>
            ) : (
              <div className="text-center text-zinc-500 p-6">
                <ImageIcon className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-xs">Sube o selecciona una foto del negocio para aplicar revelado realista.</p>
              </div>
            )}
          </div>
        </div>

        {/* Tarjeta Derecha: Generador Multicanal */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <h2 className="text-base font-bold text-white">
              Generador Multicanal (FB, IG, TikTok, Estados WA)
            </h2>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Enfoque de Venta
              </label>
              <select
                value={enfoque}
                onChange={(e) => setEnfoque(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="Paquete Completo ($1,713 MXN) + Envío Gratis">
                  Paquete Completo ($1,713 MXN) + Envío Gratis
                </option>
                <option value="Acero Inoxidable Grado Alimenticio (Durabilidad)">
                  Acero Inoxidable Grado Alimenticio (Durabilidad)
                </option>
                <option value="Pago Contra Entrega Sin Riesgos (Confianza)">
                  Pago Contra Entrega Sin Riesgos (Confianza)
                </option>
                <option value="Refacciones y Baleros desde $26 MXN (Mecánicos)">
                  Refacciones y Baleros desde $26 MXN (Mecánicos)
                </option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Zona Objetivo
              </label>
              <select
                value={zona}
                onChange={(e) => setZona(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="Norte CDMX y Edomex (Ecatepec, Tultitlán, Coacalco, Naucalpan)">
                  Norte CDMX y Edomex (Ecatepec, Tultitlán, Coacalco, Naucalpan)
                </option>
                <option value="Todo México (Envíos Express)">
                  Todo México (Envíos Express)
                </option>
              </select>
            </div>

            <button
              onClick={handleGenerarCampana}
              disabled={generando}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              {generando ? 'Generando Campaña...' : '✨ Generar Campaña Completa'}
            </button>
          </div>

          <div className="space-y-2 flex-1 flex flex-col">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-zinc-400">
                Resultado Multicanal
              </label>
              {contenido && (
                <button
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copiado' : 'Copiar'}
                </button>
              )}
            </div>
            <textarea
              value={contenido}
              onChange={(e) => setContenido(e.target.value)}
              rows={10}
              placeholder="Aquí aparecerán los copys listos para Facebook, Instagram, TikTok y Estados de WhatsApp..."
              className="w-full flex-1 p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 leading-relaxed focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

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
  Navigation,
  Plus,
  Copy,
  Sparkles,
  Clock,
  Compass,
  Route,
  X,
  ExternalLink,
  Send,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  EstrategiaRutaType,
  fetchVpsGet,
  fetchVpsPost,
  PedidoVps,
} from '@/lib/vps/types';
import { useNicho } from '@/context/NichoContext';

const CENTROIDES_LOCAL_FALLBACK: Record<string, [number, number]> = {
  cuauhtemoc: [19.4326, -99.1332],
  centro: [19.4326, -99.1332],
  cdmx: [19.4326, -99.1332],
  'benito juarez': [19.3984, -99.1577],
  coyoacan: [19.3467, -99.1617],
  'miguel hidalgo': [19.4326, -99.2],
  azcapotzalco: [19.4869, -99.1859],
  'gustavo a. madero': [19.4873, -99.1236],
  iztapalapa: [19.3553, -99.0622],
  tlalpan: [19.2897, -99.1672],
  ecatepec: [19.6018, -99.0507],
  nezahualcoyotl: [19.4006, -99.0148],
  tlalnepantla: [19.5367, -99.1948],
  naucalpan: [19.4785, -99.2396],
  chalco: [19.2647, -98.8975],
  toluca: [19.2826, -99.6557],
  cuautitlan: [19.671, -99.1804],
  iztacalco: [19.3953, -99.0975],
};

function normalizarTextoLocal(txt: string): string {
  return (txt || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function geocodificarLocalFallback(direccion: string, municipio: string): [number, number] {
  const full = normalizarTextoLocal(`${municipio} ${direccion}`);
  for (const [k, coords] of Object.entries(CENTROIDES_LOCAL_FALLBACK)) {
    if (full.includes(k)) {
      return coords;
    }
  }
  return [19.4326, -99.1332];
}

function haversineLocalKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = 6371.0;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}

function extraerHoraLocal(horario: string): number {
  const txt = (horario || '').toLowerCase().trim();
  const m = txt.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?/);
  if (!m) return 12;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2] || '0', 10);
  const ampm = (m[3] || '').replace(/\./g, '');
  if (ampm === 'pm' && h < 12) h += 12;
  if (ampm === 'am' && h === 12) h = 0;
  return h + min / 60;
}

function optimizarRutaLocalFallback(
  puntoPartida: string,
  estrategia: EstrategiaRutaType,
  paradas: PedidoVps[]
): {
  paradas_ordenadas: PedidoVps[];
  distancia_total_km: number;
  google_maps_multi_url: string;
} {
  const origenTxt = puntoPartida.trim() || 'Centro CDMX, Cuauhtémoc';
  const [latOrig, lonOrig] = geocodificarLocalFallback(origenTxt, '');

  const pendientes = paradas.map((p) => {
    const [lat, lng] = geocodificarLocalFallback(p.direccion_gps, p.municipio);
    const distOrig = haversineLocalKm(latOrig, lonOrig, lat, lng);
    return {
      ...p,
      lat,
      lng,
      _distOrig: distOrig,
      _horaNum: extraerHoraLocal(p.horario_recepcion),
    };
  });

  const ordenadas: PedidoVps[] = [];
  let currLat = latOrig;
  let currLon = lonOrig;
  let distTotal = 0;

  if (estrategia === 'por_horario') {
    while (pendientes.length > 0) {
      pendientes.sort((a, b) => {
        if (Math.abs(a._horaNum - b._horaNum) > 0.25) {
          return a._horaNum - b._horaNum;
        }
        return (
          haversineLocalKm(currLat, currLon, a.lat!, a.lng!) -
          haversineLocalKm(currLat, currLon, b.lat!, b.lng!)
        );
      });
      const elegido = pendientes.shift()!;
      const tramo = haversineLocalKm(currLat, currLon, elegido.lat!, elegido.lng!);
      distTotal += tramo;
      currLat = elegido.lat!;
      currLon = elegido.lng!;
      ordenadas.push({
        ...elegido,
        orden_parada: ordenadas.length + 1,
        distancia_tramo_km: Number(tramo.toFixed(1)),
        distancia_origen_km: Number(elegido._distOrig.toFixed(1)),
        motivo_orden: `Prioridad por horario (${elegido.horario_recepcion}) • +${tramo.toFixed(1)} km`,
      });
    }
  } else if (estrategia === 'lejanos_primero') {
    if (pendientes.length > 0) {
      pendientes.sort((a, b) => b._distOrig - a._distOrig);
      const primero = pendientes.shift()!;
      const tramo = haversineLocalKm(currLat, currLon, primero.lat!, primero.lng!);
      distTotal += tramo;
      currLat = primero.lat!;
      currLon = primero.lng!;
      ordenadas.push({
        ...primero,
        orden_parada: 1,
        distancia_tramo_km: Number(tramo.toFixed(1)),
        distancia_origen_km: Number(primero._distOrig.toFixed(1)),
        motivo_orden: `Punto más lejano a ${primero._distOrig.toFixed(1)} km del origen (inicio retorno)`,
      });
    }
    while (pendientes.length > 0) {
      pendientes.sort((a, b) => {
        const scoreA = haversineLocalKm(currLat, currLon, a.lat!, a.lng!) * 0.7 + a._distOrig * 0.3;
        const scoreB = haversineLocalKm(currLat, currLon, b.lat!, b.lng!) * 0.7 + b._distOrig * 0.3;
        return scoreA - scoreB;
      });
      const elegido = pendientes.shift()!;
      const tramo = haversineLocalKm(currLat, currLon, elegido.lat!, elegido.lng!);
      distTotal += tramo;
      currLat = elegido.lat!;
      currLon = elegido.lng!;
      ordenadas.push({
        ...elegido,
        orden_parada: ordenadas.length + 1,
        distancia_tramo_km: Number(tramo.toFixed(1)),
        distancia_origen_km: Number(elegido._distOrig.toFixed(1)),
        motivo_orden: `Retorno hacia origen • Tramo +${tramo.toFixed(1)} km`,
      });
    }
  } else {
    while (pendientes.length > 0) {
      pendientes.sort(
        (a, b) =>
          haversineLocalKm(currLat, currLon, a.lat!, a.lng!) -
          haversineLocalKm(currLat, currLon, b.lat!, b.lng!)
      );
      const elegido = pendientes.shift()!;
      const tramo = haversineLocalKm(currLat, currLon, elegido.lat!, elegido.lng!);
      distTotal += tramo;
      currLat = elegido.lat!;
      currLon = elegido.lng!;
      const ord = ordenadas.length + 1;
      ordenadas.push({
        ...elegido,
        orden_parada: ord,
        distancia_tramo_km: Number(tramo.toFixed(1)),
        distancia_origen_km: Number(elegido._distOrig.toFixed(1)),
        motivo_orden:
          ord === 1
            ? `Más cercano al punto de partida (${tramo.toFixed(1)} km)`
            : `Siguiente más cercano • Tramo +${tramo.toFixed(1)} km`,
      });
    }
  }

  const segmentos = [
    encodeURIComponent(`${origenTxt}, Mexico`),
    ...ordenadas.slice(0, 9).map((p) =>
      encodeURIComponent(
        [p.direccion_gps, p.municipio, 'Mexico'].filter(Boolean).join(', ')
      )
    ),
  ];

  return {
    paradas_ordenadas: ordenadas,
    distancia_total_km: Number(distTotal.toFixed(1)),
    google_maps_multi_url: `https://www.google.com/maps/dir/${segmentos.join('/')}`,
  };
}

export default function LogisticaPage() {
  const { ownerEmail, isMallasOwner, tienePerfil, nicho, modeloNegocio, loadingNicho } = useNicho();
  const isServiciosB2B = !isMallasOwner && modeloNegocio === 'SERVICIOS_B2B';
  const clienteIdActual = nicho?.cliente_id || (isMallasOwner ? 'mallas_tlaxcalli' : 'default');

  const [pedidos, setPedidos] = useState<PedidoVps[]>([]);
  const [loading, setLoading] = useState(true);
  const [vpsOffline, setVpsOffline] = useState(false);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);

  // Planificador de Ruta Inteligente
  const [puntoPartida, setPuntoPartida] = useState<string>('Centro CDMX, Cuauhtémoc');
  const [estrategia, setEstrategia] = useState<EstrategiaRutaType>('cercanos_primero');
  const [paradasOrdenadas, setParadasOrdenadas] = useState<PedidoVps[]>([]);
  const [distanciaTotalKm, setDistanciaTotalKm] = useState<number>(0);
  const [googleMapsMultiUrl, setGoogleMapsMultiUrl] = useState<string>('');
  const [optimizandoRuta, setOptimizandoRuta] = useState<boolean>(false);

  // Simulación Demo en memoria (cuando no hay pedidos en BD)
  const [modoDemo, setModoDemo] = useState<boolean>(false);
  const [paradasDemo, setParadasDemo] = useState<PedidoVps[]>([]);

  // Modal Agregar Parada / Visita manual
  const [modalNuevaParada, setModalNuevaParada] = useState<boolean>(false);
  const [guardandoParada, setGuardandoParada] = useState<boolean>(false);
  const [formParada, setFormParada] = useState({
    cliente: '',
    telefono: '',
    direccion: '',
    municipio: 'Cuauhtémoc, CDMX',
    horario: '9:00 AM a 2:00 PM',
    metodo_pago: 'CONTRA_ENTREGA',
    monto_venta: isMallasOwner ? '1713' : '1200',
    tipo_pedido: '',
  });

  // Cargar Punto de Partida persistido por cliente_id
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedOrigin = window.localStorage.getItem(`blitzr_punto_partida_${clienteIdActual}`);
    if (savedOrigin && savedOrigin.trim()) {
      setPuntoPartida(savedOrigin);
    }
  }, [clienteIdActual]);

  const handlePuntoPartidaChange = (val: string) => {
    setPuntoPartida(val);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(`blitzr_punto_partida_${clienteIdActual}`, val);
    }
  };

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
      if (data.pedidos.length > 0) {
        setModoDemo(false);
      }
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

  // Lista base de paradas pendientes de entrega ("EN_RUTA_REPARTIDOR")
  const paradasPendientesBase = useMemo(() => {
    const fuente = modoDemo ? paradasDemo : pedidos;
    return fuente.filter((p) => p.estatus_entrega !== 'ENTREGADO_Y_PAGADO');
  }, [modoDemo, paradasDemo, pedidos]);

  // Ejecutar optimización de ruta cada vez que cambian las paradas pendientes o la estrategia
  const ejecutarOptimizacionRuta = useCallback(
    async (
      origenActual: string,
      estrategiaActual: EstrategiaRutaType,
      listaParadas: PedidoVps[]
    ) => {
      if (listaParadas.length === 0) {
        setParadasOrdenadas([]);
        setDistanciaTotalKm(0);
        setGoogleMapsMultiUrl('');
        return;
      }

      setOptimizandoRuta(true);
      try {
        const res = await fetchVpsPost('/api/optimizar_ruta', {
          punto_partida: origenActual,
          estrategia: estrategiaActual,
          paradas: listaParadas,
          owner_email: ownerEmail,
          cliente_id: clienteIdActual,
        });

        if (res && res.ok && Array.isArray(res.paradas_ordenadas)) {
          setParadasOrdenadas(res.paradas_ordenadas);
          setDistanciaTotalKm(Number(res.distancia_total_km || 0));
          setGoogleMapsMultiUrl(String(res.google_maps_multi_url || ''));
          setOptimizandoRuta(false);
          return;
        }
      } catch {
        // Fallback local determinista si el VPS no responde
      }

      const fallback = optimizarRutaLocalFallback(
        origenActual,
        estrategiaActual,
        listaParadas
      );
      setParadasOrdenadas(fallback.paradas_ordenadas);
      setDistanciaTotalKm(fallback.distancia_total_km);
      setGoogleMapsMultiUrl(fallback.google_maps_multi_url);
      setOptimizandoRuta(false);
    },
    [ownerEmail, clienteIdActual]
  );

  useEffect(() => {
    ejecutarOptimizacionRuta(puntoPartida, estrategia, paradasPendientesBase);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estrategia, paradasPendientesBase]);

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
    if (modoDemo) {
      setParadasDemo((prev) =>
        prev.map((p) => (p.id === id ? { ...p, estatus_entrega: 'ENTREGADO_Y_PAGADO' } : p))
      );
      toast.success('Parada demo marcada como entregada y pagada.');
      return;
    }

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
    const headerTxt = isServiciosB2B
      ? `🛠️ *ORDEN DE VISITA / INSTALACIÓN ${nombreMarca}*`
      : `🚚 *RUTA DE ENTREGA ${nombreMarca}*`;
    const ordenTxt = p.orden_parada ? `\nParada: #${p.orden_parada}` : '';
    const msg = `${headerTxt}${ordenTxt}\nFolio: ${p.folio}\nCliente: ${p.cliente_tortilleria}\nTel: ${p.telefono}\nMunicipio: ${p.municipio}\nSitio/Dirección: ${p.direccion_gps}\nHorario: ${p.horario_recepcion}\nCobrar (${p.metodo_pago}): $${p.monto_venta} MXN\nMaps: ${p.google_maps_url || 'N/A'}`;
    return `https://wa.me/?text=${encodeURIComponent(msg)}`;
  };

  const construirTextoItinerarioCompleto = () => {
    const etiquetaEstrategia =
      estrategia === 'cercanos_primero'
        ? 'Cercanos primero (avance por proximidad)'
        : estrategia === 'lejanos_primero'
        ? 'Lejanos primero (ruta pesada de ida y retorno a base)'
        : 'Prioridad por horario de recepción / cita';

    const lineasParadas = paradasOrdenadas.map((p, idx) => {
      const num = p.orden_parada || idx + 1;
      const esUltima = idx === paradasOrdenadas.length - 1;
      const tagParada =
        esUltima && paradasOrdenadas.length > 1
          ? `🏁 *PARADA ${num} (ÚLTIMA PARADA)*`
          : `📍 *PARADA ${num}*`;
      const distTxt =
        typeof p.distancia_tramo_km === 'number' ? ` (+${p.distancia_tramo_km} km)` : '';
      return `${tagParada}${distTxt}\n• Cliente: ${p.cliente_tortilleria} (${p.folio})\n• Tel: ${p.telefono}\n• Dirección: ${p.direccion_gps}, ${p.municipio}\n• Horario: ${p.horario_recepcion}\n• Cobrar (${p.metodo_pago}): $${Number(p.monto_venta || 0).toLocaleString('es-MX')} MXN\n• Maps: ${p.google_maps_url || 'N/A'}`;
    });

    const totalCobrar = paradasOrdenadas.reduce(
      (acc, p) => acc + Number(p.monto_venta || 0),
      0
    );

    return [
      `🚚 *HOJA DE RUTA OPTIMIZADA — ${nombreMarca}*`,
      `🏠 *Punto de Partida:* ${puntoPartida}`,
      `🧭 *Estrategia:* ${etiquetaEstrategia}`,
      `📏 *Recorrido estimado:* ~${distanciaTotalKm} km (${paradasOrdenadas.length} paradas)`,
      `💰 *Total a cobrar en ruta:* $${totalCobrar.toLocaleString('es-MX')} MXN`,
      googleMapsMultiUrl ? `🗺️ *Mapa Multi-Parada (1 clic):*\n${googleMapsMultiUrl}` : '',
      `────────────────────`,
      ...lineasParadas,
    ]
      .filter(Boolean)
      .join('\n\n');
  };

  const handleCopiarItinerarioCompleto = async () => {
    if (paradasOrdenadas.length === 0) return;
    const texto = construirTextoItinerarioCompleto();
    try {
      await navigator.clipboard.writeText(texto);
      toast.success('Itinerario completo copiado al portapapeles.');
    } catch {
      toast.error('No se pudo copiar automáticamente.');
    }
  };

  const handleActivarRutaDemo = () => {
    const pref = isMallasOwner ? 'TLX' : (nicho?.cliente_id || 'DEMO').slice(0, 4).toUpperCase();
    const paradasSimuladas: PedidoVps[] = [
      {
        id: 9001,
        folio: `${pref}-DEMO-001`,
        fecha_cierre: 'Hoy • Simulación',
        cliente_tortilleria: isServiciosB2B
          ? 'Corporativo Reforma Centro'
          : isMallasOwner
          ? 'Tortillería La Espiga del Centro'
          : 'Cliente Centro Histórico',
        telefono: '5551234501',
        direccion_gps: 'Av. Juárez 50, Col. Centro',
        municipio: 'Cuauhtémoc, CDMX',
        google_maps_url:
          'https://www.google.com/maps/search/?api=1&query=Av.+Juarez+50+Cuauhtemoc+CDMX',
        horario_recepcion: '11:30 AM a 2:00 PM',
        metodo_pago: 'CONTRA_ENTREGA',
        monto_venta: isMallasOwner ? 1713 : 1450,
        comision_agencia: 200,
        estatus_entrega: 'EN_RUTA_REPARTIDOR',
        es_demo: true,
      },
      {
        id: 9002,
        folio: `${pref}-DEMO-002`,
        fecha_cierre: 'Hoy • Simulación',
        cliente_tortilleria: isServiciosB2B
          ? 'Planta Industrial San Nicolás'
          : isMallasOwner
          ? 'Tortillería El Maizal de Tlalne'
          : 'Sucursal Norte Tlalnepantla',
        telefono: '5551234502',
        direccion_gps: 'Av. Gustavo Baz Prada 180, San Nicolás',
        municipio: 'Tlalnepantla, Edomex',
        google_maps_url:
          'https://www.google.com/maps/search/?api=1&query=Av.+Gustavo+Baz+Prada+180+Tlalnepantla',
        horario_recepcion: '9:00 AM a 11:00 AM',
        metodo_pago: 'TRANSFERENCIA_CONTRA_ENTREGA',
        monto_venta: isMallasOwner ? 1713 : 2100,
        comision_agencia: 200,
        estatus_entrega: 'EN_RUTA_REPARTIDOR',
        es_demo: true,
      },
      {
        id: 9003,
        folio: `${pref}-DEMO-003`,
        fecha_cierre: 'Hoy • Simulación',
        cliente_tortilleria: isServiciosB2B
          ? 'Bodega Logística Vía Morelos'
          : isMallasOwner
          ? 'Tortillería Santa Clara Ecatepec'
          : 'Pedido Especial Ecatepec',
        telefono: '5551234503',
        direccion_gps: 'Vía Morelos Km 18, Santa Clara',
        municipio: 'Ecatepec, Edomex',
        google_maps_url:
          'https://www.google.com/maps/search/?api=1&query=Via+Morelos+Santa+Clara+Ecatepec',
        horario_recepcion: '1:00 PM a 4:00 PM',
        metodo_pago: 'EFECTIVO_CONTRA_ENTREGA',
        monto_venta: isMallasOwner ? 1713 : 1850,
        comision_agencia: 200,
        estatus_entrega: 'EN_RUTA_REPARTIDOR',
        es_demo: true,
      },
      {
        id: 9004,
        folio: `${pref}-DEMO-004`,
        fecha_cierre: 'Hoy • Simulación',
        cliente_tortilleria: isServiciosB2B
          ? 'Centro de Distribución Oriente Chalco'
          : isMallasOwner
          ? 'Tortillería San Mateo Chalco'
          : 'Entrega Domicilio Chalco',
        telefono: '5551234504',
        direccion_gps: 'Av. Cuauhtémoc Poniente 45, Centro',
        municipio: 'Chalco, Edomex',
        google_maps_url:
          'https://www.google.com/maps/search/?api=1&query=Av.+Cuauhtemoc+Poniente+45+Chalco',
        horario_recepcion: '3:30 PM a 6:00 PM',
        metodo_pago: 'CONTRA_ENTREGA',
        monto_venta: isMallasOwner ? 1713 : 1600,
        comision_agencia: 200,
        estatus_entrega: 'EN_RUTA_REPARTIDOR',
        es_demo: true,
      },
    ];
    setParadasDemo(paradasSimuladas);
    setModoDemo(true);
    toast.success('Ruta Demo cargada con 4 paradas para probar el optimizador.');
  };

  const handleGuardarNuevaParada = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formParada.cliente.trim() || !formParada.direccion.trim()) {
      toast.error('Ingresa el nombre del cliente y la dirección de entrega.');
      return;
    }

    setGuardandoParada(true);
    const res = await fetchVpsPost('/api/registrar_pedido', {
      owner_email: ownerEmail,
      cliente_id: nicho?.cliente_id || (isMallasOwner ? 'mallas_tlaxcalli' : ''),
      cliente: formParada.cliente.trim(),
      telefono: formParada.telefono.trim() || 'S/N',
      direccion: formParada.direccion.trim(),
      municipio: formParada.municipio.trim() || 'CDMX / Zona Metropolitana',
      horario: formParada.horario.trim() || '9:00 AM a 4:00 PM',
      metodo_pago: formParada.metodo_pago,
      monto_venta: Number(formParada.monto_venta || 0),
      tipo_pedido:
        formParada.tipo_pedido.trim() ||
        (isMallasOwner
          ? '1 Paquete Completo Mallas Tlaxcalli ($1,713)'
          : nicho?.oferta_gancho || 'Entrega / Visita programada'),
      forzar_nuevo: true,
    });
    setGuardandoParada(false);

    if (res.ok === false || res.vpsOffline) {
      toast.error(res.error || 'No se pudo registrar la parada en el servidor.');
      return;
    }

    if (Array.isArray(res.pedidos)) {
      setPedidos(res.pedidos);
      setModoDemo(false);
    } else {
      await cargarDatos();
    }

    setModalNuevaParada(false);
    setFormParada((prev) => ({
      ...prev,
      cliente: '',
      telefono: '',
      direccion: '',
      tipo_pedido: '',
    }));
    toast.success('Parada agregada y ruta recalculada.');
  };

  const tablaPedidosMostrar = modoDemo ? paradasDemo : pedidos;

  return (
    <div className="space-y-6">
      {/* Header Principal */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <Truck className="w-4 h-4" />
            {isServiciosB2B
              ? 'Módulo 3 • Agenda de Visitas e Instalaciones Técnicas'
              : 'Módulo 3 • Logística y Comisiones'}
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {isServiciosB2B
              ? 'Agenda de Servicios y Levantamientos en Sitio'
              : 'Hoja de Ruta Inteligente para Repartidores'}
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            {isServiciosB2B
              ? 'Ordena tus visitas técnicas paso a paso desde tu punto de partida, abre el mapa multi-parada y confirma cobros.'
              : 'Ordena tus entregas paso a paso (Parada 1 → Parada 2 → Última), abre la ruta completa en Google Maps y envía el itinerario por WhatsApp.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {pedidos.length === 0 && !modoDemo && (
            <button
              onClick={handleActivarRutaDemo}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-purple-500/15 border border-purple-500/40 text-purple-300 hover:bg-purple-500/25 text-xs font-semibold transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              Simular Ruta Demo (4 paradas)
            </button>
          )}

          {modoDemo && (
            <button
              onClick={() => {
                setModoDemo(false);
                setParadasDemo([]);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 hover:bg-amber-500/25 text-xs font-semibold transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Salir de Ruta Demo
            </button>
          )}

          <button
            onClick={() => setModalNuevaParada(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            {isServiciosB2B ? 'Agregar Visita / Cita' : 'Agregar Parada / Entrega'}
          </button>

          <button
            onClick={cargarDatos}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-800 text-xs font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            {isServiciosB2B ? 'Actualizar Agenda' : 'Actualizar Ruta'}
          </button>
        </div>
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
          <span>Modo sin conexión VPS: el optimizador de ruta funciona con cálculo local de respaldo.</span>
        </div>
      )}

      {/* 4 KPI Cards (Contabilidad Intacta) */}
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

      {/* PANEL: PLANIFICADOR DE RUTA INTELIGENTE */}
      <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-5 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider mb-1">
              <Route className="w-4 h-4" />
              Planificador de Ruta Paso a Paso
              {modoDemo && (
                <span className="px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 text-[10px]">
                  MODO DEMO ACTIVO
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold text-white">
              ¿Desde dónde sales hoy y cómo quieres ordenar tus paradas?
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Calculamos la secuencia óptima <strong className="text-zinc-200">Parada 1 → Parada 2 → Última Parada</strong> a partir de las entregas confirmadas por Andrea IA o agregadas manualmente.
            </p>
          </div>

          {paradasOrdenadas.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {googleMapsMultiUrl && (
                <a
                  href={googleMapsMultiUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors shadow-lg shadow-blue-600/20"
                >
                  <Navigation className="w-4 h-4" />
                  🗺️ Abrir Ruta Completa en Google Maps ({paradasOrdenadas.length})
                  <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                </a>
              )}

              <button
                onClick={handleCopiarItinerarioCompleto}
                className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold transition-colors"
              >
                <Copy className="w-4 h-4" />
                📲 Copiar Itinerario Completo (WhatsApp)
              </button>

              <a
                href={`https://wa.me/?text=${encodeURIComponent(construirTextoItinerarioCompleto())}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition-colors"
              >
                <Send className="w-3.5 h-3.5 text-emerald-400" />
                Enviar a Chofer
              </a>
            </div>
          )}
        </div>

        {/* Controles: Punto de Partida + 3 Estrategias */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-2 border-t border-zinc-800/80">
          {/* Input Punto de Partida */}
          <div className="lg:col-span-5">
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              🏠 Punto de Partida (Casa, Bodega, Taller u Oficina)
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <MapPin className="w-4 h-4 text-cyan-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={puntoPartida}
                  onChange={(e) => handlePuntoPartidaChange(e.target.value)}
                  placeholder="Ej. Bodega Vallejo, Azcapotzalco, CDMX"
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
              <button
                type="button"
                onClick={() =>
                  ejecutarOptimizacionRuta(puntoPartida, estrategia, paradasPendientesBase)
                }
                disabled={optimizandoRuta || paradasPendientesBase.length === 0}
                className="px-3.5 py-2 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 text-xs font-bold transition-colors disabled:opacity-50 shrink-0"
              >
                {optimizandoRuta ? 'Calculando...' : 'Recalcular'}
              </button>
            </div>
          </div>

          {/* 3 Estrategias de Ordenamiento */}
          <div className="lg:col-span-7">
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              🧭 Estrategia de Ordenamiento de Paradas
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setEstrategia('cercanos_primero')}
                className={`text-left p-2.5 rounded-xl border transition-all ${
                  estrategia === 'cercanos_primero'
                    ? 'bg-cyan-500/15 border-cyan-500 text-white shadow-sm'
                    : 'bg-zinc-950/70 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <Compass className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  1. Cercanos primero
                </div>
                <p className="text-[11px] text-zinc-400 mt-0.5 leading-tight">
                  Empieza por el cliente más próximo a tu base y avanza por cercanía.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setEstrategia('lejanos_primero')}
                className={`text-left p-2.5 rounded-xl border transition-all ${
                  estrategia === 'lejanos_primero'
                    ? 'bg-blue-500/15 border-blue-500 text-white shadow-sm'
                    : 'bg-zinc-950/70 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <Truck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  2. Lejanos primero
                </div>
                <p className="text-[11px] text-zinc-400 mt-0.5 leading-tight">
                  Ideal ruta pesada: va al punto más retirado y regresa entregando hacia casa.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setEstrategia('por_horario')}
                className={`text-left p-2.5 rounded-xl border transition-all ${
                  estrategia === 'por_horario'
                    ? 'bg-purple-500/15 border-purple-500 text-white shadow-sm'
                    : 'bg-zinc-950/70 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <Clock className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  3. Por horario cita
                </div>
                <p className="text-[11px] text-zinc-400 mt-0.5 leading-tight">
                  Ordena por ventana horaria acordada con el cliente y desempata por cercanía.
                </p>
              </button>
            </div>
          </div>
        </div>

        {/* ITINERARIO PASO A PASO */}
        {paradasOrdenadas.length === 0 ? (
          <div className="rounded-xl bg-zinc-950/60 border border-dashed border-zinc-800 p-8 text-center space-y-3">
            <div className="text-sm text-zinc-300 font-medium">
              No hay entregas o visitas pendientes en ruta en este momento.
            </div>
            <p className="text-xs text-zinc-500 max-w-lg mx-auto">
              Cuando Andrea IA cierre un pedido por WhatsApp o registres una entrega desde el Módulo 2, aparecerá aquí ordenada automáticamente paso a paso.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => setModalNuevaParada(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar Parada Manualmente
              </button>
              <button
                type="button"
                onClick={handleActivarRutaDemo}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                Probar con 4 Paradas Demo
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400 px-1">
              <div>
                Secuencia calculada desde <strong className="text-white">{puntoPartida}</strong> •{' '}
                <strong className="text-cyan-400">{paradasOrdenadas.length} paradas activas</strong>
              </div>
              <div>
                Distancia estimada entre tramos:{' '}
                <strong className="text-emerald-400">~{distanciaTotalKm} km</strong>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {paradasOrdenadas.map((p, idx) => {
                const ordenNum = p.orden_parada || idx + 1;
                const esPrimera = idx === 0;
                const esUltima = idx === paradasOrdenadas.length - 1 && paradasOrdenadas.length > 1;

                return (
                  <div
                    key={`${p.id}-${ordenNum}`}
                    className={`rounded-xl border p-4 transition-all ${
                      esPrimera
                        ? 'bg-cyan-950/20 border-cyan-500/40'
                        : esUltima
                        ? 'bg-emerald-950/15 border-emerald-500/30'
                        : 'bg-zinc-950/70 border-zinc-800'
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                      {/* Izquierda: Número de Parada + Cliente + Dirección */}
                      <div className="flex items-start gap-3.5">
                        <div
                          className={`flex flex-col items-center justify-center min-w-[78px] px-2.5 py-2 rounded-xl font-bold text-center shrink-0 ${
                            esPrimera
                              ? 'bg-cyan-500 text-zinc-950'
                              : esUltima
                              ? 'bg-emerald-500 text-zinc-950'
                              : 'bg-zinc-800 text-white border border-zinc-700'
                          }`}
                        >
                          <span className="text-[10px] uppercase tracking-wider opacity-85">
                            {esUltima ? 'Última' : 'Parada'}
                          </span>
                          <span className="text-lg leading-none mt-0.5">#{ordenNum}</span>
                        </div>

                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-white text-base">
                              {p.cliente_tortilleria}
                            </span>
                            <span className="font-mono text-xs px-2 py-0.5 rounded bg-blue-500/15 border border-blue-500/30 text-blue-300">
                              {p.folio}
                            </span>
                            {typeof p.distancia_tramo_km === 'number' && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-cyan-300 font-medium">
                                +{p.distancia_tramo_km} km
                              </span>
                            )}
                          </div>

                          <div className="text-xs text-zinc-200 flex flex-wrap items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                            <span className="font-semibold">{p.municipio}:</span>
                            <span className="text-zinc-300">{p.direccion_gps}</span>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400 pt-0.5">
                            <span>📞 {p.telefono}</span>
                            <span>🕒 {p.horario_recepcion}</span>
                            {p.motivo_orden && (
                              <span className="text-cyan-400/90 font-medium">
                                • {p.motivo_orden}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Derecha: Cobro + Botones de Acción */}
                      <div className="flex flex-wrap items-center justify-between lg:justify-end gap-3 pt-2 lg:pt-0 border-t lg:border-t-0 border-zinc-800/70">
                        <div className="text-left lg:text-right mr-2">
                          <div className="text-xs text-zinc-400">{p.metodo_pago}</div>
                          <div className="text-base font-bold text-white">
                            ${Number(p.monto_venta || 0).toLocaleString('es-MX')} MXN
                          </div>
                        </div>

                        {p.google_maps_url && (
                          <a
                            href={p.google_maps_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-blue-300 text-xs font-semibold transition-colors"
                          >
                            <MapPin className="w-3.5 h-3.5" />
                            Maps
                          </a>
                        )}

                        <a
                          href={buildRutaChoferUrl(p)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition-colors"
                        >
                          <Truck className="w-3.5 h-3.5 text-amber-400" />
                          Ficha Chofer
                        </a>

                        <button
                          onClick={() => handleConfirmarPago(p.id)}
                          disabled={confirmingId === p.id}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {confirmingId === p.id ? 'Confirmando...' : 'Confirmar Entrega'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Tabla Histórica Completa de Pedidos y Comisiones */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            Registro General de Pedidos y Liquidación de Comisiones
          </h3>
          <span className="text-xs text-zinc-500">
            {tablaPedidosMostrar.length} registros
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950/60 text-[11px] uppercase tracking-wider text-zinc-400">
                <th className="py-3 px-4">Folio</th>
                <th className="py-3 px-4">{isServiciosB2B ? 'Empresa / Cliente' : 'Cliente / Tel'}</th>
                <th className="py-3 px-4">{isServiciosB2B ? 'Ubicación del Sitio / Maps' : 'Dirección / Maps'}</th>
                <th className="py-3 px-4">{isServiciosB2B ? 'Fecha / Horario Visita' : 'Horario'}</th>
                <th className="py-3 px-4">{isServiciosB2B ? 'Modalidad Cobro' : 'Método Pago'}</th>
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
              ) : tablaPedidosMostrar.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-500">
                    No hay pedidos registrados aún. Cierra una venta desde el Módulo 2 o agrega una parada manual arriba.
                  </td>
                </tr>
              ) : (
                tablaPedidosMostrar.map((p) => {
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

      {/* MODAL: AGREGAR PARADA / VISITA MANUALMENTE */}
      {modalNuevaParada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
              <div>
                <h3 className="text-base font-bold text-white">
                  {isServiciosB2B
                    ? 'Agendar Nueva Visita / Instalación en Ruta'
                    : 'Agregar Parada de Entrega a la Hoja de Ruta'}
                </h3>
                <p className="text-xs text-zinc-400">
                  Se guardará en tu tabla de logística y el optimizador la ordenará automáticamente.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalNuevaParada(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleGuardarNuevaParada} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Cliente o Negocio *
                  </label>
                  <input
                    type="text"
                    required
                    value={formParada.cliente}
                    onChange={(e) =>
                      setFormParada((prev) => ({ ...prev, cliente: e.target.value }))
                    }
                    placeholder={
                      isMallasOwner
                        ? 'Ej. Tortillería San Juan / María López'
                        : 'Ej. María López / Comercializadora del Centro'
                    }
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Teléfono / WhatsApp
                  </label>
                  <input
                    type="text"
                    value={formParada.telefono}
                    onChange={(e) =>
                      setFormParada((prev) => ({ ...prev, telefono: e.target.value }))
                    }
                    placeholder="Ej. 5512345678"
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Calle, Número y Colonia *
                  </label>
                  <input
                    type="text"
                    required
                    value={formParada.direccion}
                    onChange={(e) =>
                      setFormParada((prev) => ({ ...prev, direccion: e.target.value }))
                    }
                    placeholder="Ej. Av. Central 120, Col. Aragón"
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Municipio / Alcaldía *
                  </label>
                  <input
                    type="text"
                    required
                    value={formParada.municipio}
                    onChange={(e) =>
                      setFormParada((prev) => ({ ...prev, municipio: e.target.value }))
                    }
                    placeholder="Ej. Ecatepec, Edomex"
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Horario Recepción / Cita
                  </label>
                  <input
                    type="text"
                    value={formParada.horario}
                    onChange={(e) =>
                      setFormParada((prev) => ({ ...prev, horario: e.target.value }))
                    }
                    placeholder="Ej. 10:00 AM a 2:00 PM"
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Método de Cobro
                  </label>
                  <select
                    value={formParada.metodo_pago}
                    onChange={(e) =>
                      setFormParada((prev) => ({ ...prev, metodo_pago: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="CONTRA_ENTREGA">Contra Entrega</option>
                    <option value="TRANSFERENCIA_CONTRA_ENTREGA">Transferencia al Recibir</option>
                    <option value="EFECTIVO_CONTRA_ENTREGA">Efectivo al Recibir</option>
                    <option value="PAGADO_ANTICIPO">Anticipo / Ya Pagado</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Monto a Cobrar (MXN)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={formParada.monto_venta}
                    onChange={(e) =>
                      setFormParada((prev) => ({ ...prev, monto_venta: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Detalle del Pedido / Servicio (opcional)
                </label>
                <input
                  type="text"
                  value={formParada.tipo_pedido}
                  onChange={(e) =>
                    setFormParada((prev) => ({ ...prev, tipo_pedido: e.target.value }))
                  }
                  placeholder="Ej. 2 paquetes personalizados / Levantamiento técnico"
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setModalNuevaParada(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoParada}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold disabled:opacity-50"
                >
                  {guardandoParada ? 'Guardando...' : 'Guardar y Ordenar en Ruta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

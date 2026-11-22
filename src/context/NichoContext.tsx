'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  DiagnosticoModeloIA,
  fetchVpsGet,
  fetchVpsPost,
  ModeloNegocioType,
  NichoVps,
} from '@/lib/vps/types';

export const OWNER_EMAIL_MALLAS = 'ferrergbryanu10@gmail.com';

export const PROTECTED_MALLAS_NICHO: NichoVps = {
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
  total_prospectos: 303,
  enviados_wa: 11,
  modelo_negocio: 'DISTRIBUIDOR_B2B',
};

interface NichoContextValue {
  ownerEmail: string;
  isMallasOwner: boolean;
  tienePerfil: boolean;
  nicho: NichoVps | null;
  modeloNegocio: ModeloNegocioType;
  loadingNicho: boolean;
  refreshNicho: () => Promise<void>;
  syncNichoFromIdea: (payload: Record<string, unknown>) => Promise<NichoVps | null>;
  diagnosticarModelo: (payload: {
    descripcion_idea: string;
    nicho_categoria?: string;
    objetivo?: string;
  }) => Promise<DiagnosticoModeloIA | null>;
}

const NichoContext = createContext<NichoContextValue>({
  ownerEmail: '',
  isMallasOwner: false,
  tienePerfil: false,
  nicho: null,
  modeloNegocio: 'DISTRIBUIDOR_B2B',
  loadingNicho: true,
  refreshNicho: async () => {},
  syncNichoFromIdea: async () => null,
  diagnosticarModelo: async () => null,
});

export function NichoProvider({
  userEmail,
  children,
}: {
  userEmail: string;
  children: React.ReactNode;
}) {
  const ownerEmail = useMemo(() => (userEmail || '').toLowerCase().trim(), [userEmail]);
  const isMallasOwner = ownerEmail === OWNER_EMAIL_MALLAS;

  const [nicho, setNicho] = useState<NichoVps | null>(
    isMallasOwner ? PROTECTED_MALLAS_NICHO : null
  );
  const [tienePerfil, setTienePerfil] = useState<boolean>(isMallasOwner);
  const [loadingNicho, setLoadingNicho] = useState<boolean>(true);

  const refreshNicho = useCallback(async () => {
    if (!ownerEmail) {
      setNicho(null);
      setTienePerfil(false);
      setLoadingNicho(false);
      return;
    }

    setLoadingNicho(true);
    try {
      const res = await fetchVpsGet('/api/mi-nicho', { email: ownerEmail });
      if (isMallasOwner) {
        setTienePerfil(true);
        if (res && res.nicho) {
          setNicho(res.nicho as NichoVps);
        } else {
          setNicho(PROTECTED_MALLAS_NICHO);
        }
      } else {
        if (res && res.ok && res.tiene_perfil && res.nicho) {
          setNicho(res.nicho as NichoVps);
          setTienePerfil(true);
        } else {
          setNicho(null);
          setTienePerfil(false);
        }
      }
    } catch {
      if (isMallasOwner) {
        setNicho(PROTECTED_MALLAS_NICHO);
        setTienePerfil(true);
      } else {
        setNicho(null);
        setTienePerfil(false);
      }
    } finally {
      setLoadingNicho(false);
    }
  }, [ownerEmail, isMallasOwner]);

  useEffect(() => {
    refreshNicho();
  }, [refreshNicho]);

  const syncNichoFromIdea = useCallback(
    async (payload: Record<string, unknown>): Promise<NichoVps | null> => {
      if (!ownerEmail || isMallasOwner) {
        return isMallasOwner ? nicho || PROTECTED_MALLAS_NICHO : null;
      }

      try {
        const res = await fetchVpsPost('/api/mi-nicho', {
          owner_email: ownerEmail,
          ...payload,
        });
        if (res && res.ok && res.nicho) {
          const updated = res.nicho as NichoVps;
          setNicho(updated);
          setTienePerfil(true);
          return updated;
        }
      } catch (err) {
        console.warn('[NichoContext] Aviso al sincronizar nicho desde 01 • IDEA:', err);
      }
      return null;
    },
    [ownerEmail, isMallasOwner, nicho]
  );

  const diagnosticarModelo = useCallback(
    async (payload: {
      descripcion_idea: string;
      nicho_categoria?: string;
      objetivo?: string;
    }): Promise<DiagnosticoModeloIA | null> => {
      try {
        const res = await fetchVpsPost('/api/diagnosticar-modelo', payload);
        if (res && res.modelo_recomendado) {
          return res as DiagnosticoModeloIA;
        }
      } catch (err) {
        console.warn('[NichoContext] Aviso al diagnosticar modelo:', err);
      }
      return null;
    },
    []
  );

  const modeloNegocio: ModeloNegocioType = useMemo(() => {
    if (isMallasOwner) return 'DISTRIBUIDOR_B2B';
    const m = nicho?.modelo_negocio;
    if (m === 'SERVICIOS_B2B' || m === 'EMPRENDEDOR_B2C' || m === 'DISTRIBUIDOR_B2B') {
      return m;
    }
    return 'DISTRIBUIDOR_B2B';
  }, [isMallasOwner, nicho]);

  const value = useMemo(
    () => ({
      ownerEmail,
      isMallasOwner,
      tienePerfil,
      nicho,
      modeloNegocio,
      loadingNicho,
      refreshNicho,
      syncNichoFromIdea,
      diagnosticarModelo,
    }),
    [
      ownerEmail,
      isMallasOwner,
      tienePerfil,
      nicho,
      modeloNegocio,
      loadingNicho,
      refreshNicho,
      syncNichoFromIdea,
      diagnosticarModelo,
    ]
  );

  return <NichoContext.Provider value={value}>{children}</NichoContext.Provider>;
}

export function useNicho() {
  return useContext(NichoContext);
}

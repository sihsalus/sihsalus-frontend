import { openmrsFetch } from '@openmrs/esm-framework';
import useSWR from 'swr';

import { ModuleFuaRestURL } from '../constant';

export interface FuaHistorialEntry {
  id: number;
  estadoNombre: string;
  fecha: number; // epoch ms
  usuario: string;
  comentario?: string;
}

export function useFuaHistorial(fuaId: number | null | undefined) {
  const url = fuaId != null ? `${ModuleFuaRestURL}/historial/${fuaId}` : null;
  const { data, error, isLoading } = useSWR<{ data: Array<FuaHistorialEntry> }>(url, openmrsFetch);
  return {
    historial: data?.data ?? [],
    isLoading,
    error,
  };
}

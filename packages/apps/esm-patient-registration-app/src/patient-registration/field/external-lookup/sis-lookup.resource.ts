import { type FetchResponse, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import useSWRImmutable from 'swr/immutable';

// Portal oficial de consulta de asegurados SIS. No existe API pública del SIS
// para IPRESS: la verificación interina es manual (el usuario consulta en línea
// y registra el resultado en el mini-formulario).
export const sisOnlineVerificationUrl = 'https://cel.sis.gob.pe/SisConsultaEnLinea';

export interface SisInsuranceLookupResult {
  documentNumber: string;
  insuranceCode: string;
  active: boolean;
  checkedAt: string;
}

export interface SisProductAnswer {
  uuid: string;
  display: string;
}

interface ConceptAnswersResponse {
  answers?: Array<SisProductAnswer>;
}

const mockSisInsuranceLookup: Record<string, SisInsuranceLookupResult> = {
  '12345678': {
    documentNumber: '12345678',
    insuranceCode: 'SIS-12345678',
    active: true,
    checkedAt: '2026-06-10T09:30:00-05:00',
  },
  '87654321': {
    documentNumber: '87654321',
    insuranceCode: 'SIS-87654321',
    active: false,
    checkedAt: '2026-06-10T09:30:00-05:00',
  },
};

// Contrato del camino automático: hoy es un mock solo-desarrollo; cuando exista
// convenio/servicio SETISIS se reemplaza la implementación sin tocar la UI.
export async function lookupSisInsuranceByDni(dni: string): Promise<SisInsuranceLookupResult | null> {
  // Synthetic accreditation must never be written in deployed environments.
  if (globalThis.spaEnv !== 'development') {
    return null;
  }
  return mockSisInsuranceLookup[dni] ?? null;
}

export function useSisProductAnswers(conceptUuid: string | null) {
  const { data, error, isLoading } = useSWRImmutable<FetchResponse<ConceptAnswersResponse>>(
    conceptUuid ? `${restBaseUrl}/concept/${conceptUuid}?v=custom:(answers:(uuid,display))` : null,
    openmrsFetch,
  );

  return {
    answers: data?.data?.answers ?? [],
    error,
    isLoading,
  };
}

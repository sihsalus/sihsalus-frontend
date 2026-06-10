export interface SisInsuranceLookupResult {
  documentNumber: string;
  insuranceCode: string;
  active: boolean;
  checkedAt: string;
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

export async function lookupSisInsuranceByDni(dni: string): Promise<SisInsuranceLookupResult | null> {
  // Replace this mock with the identitylookup OMOD endpoint once it is exposed.
  return mockSisInsuranceLookup[dni] ?? null;
}

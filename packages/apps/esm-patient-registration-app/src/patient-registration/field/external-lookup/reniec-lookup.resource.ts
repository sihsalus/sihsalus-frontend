export interface ReniecIdentityLookupResult {
  documentNumber: string;
  givenName: string;
  middleName?: string;
  familyName: string;
  familyName2?: string;
  birthdate: string;
  gender: 'male' | 'female' | 'other' | 'unknown';
}

const mockReniecIdentityLookup: Record<string, ReniecIdentityLookupResult> = {
  '12345678': {
    documentNumber: '12345678',
    givenName: 'Juan',
    middleName: 'Carlos',
    familyName: 'Perez',
    familyName2: 'Garcia',
    birthdate: '1990-05-14',
    gender: 'male',
  },
  '87654321': {
    documentNumber: '87654321',
    givenName: 'Maria',
    middleName: 'Elena',
    familyName: 'Rojas',
    familyName2: 'Quispe',
    birthdate: '1988-11-03',
    gender: 'female',
  },
};

export async function lookupReniecIdentityByDni(dni: string): Promise<ReniecIdentityLookupResult | null> {
  // Replace this mock with the identitylookup OMOD endpoint once it is exposed.
  return mockReniecIdentityLookup[dni] ?? null;
}

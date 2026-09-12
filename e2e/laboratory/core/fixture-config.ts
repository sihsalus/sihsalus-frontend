/** Explicit SIHSALUS content fixtures shared by preflight and creation; no catalogue fallback. */
export const laboratoryOrderFixture = {
  conceptUuid: '18730e4e-0a5f-40cf-8c19-474276f5e9d7', // AST / TGO, Numeric, IU/L.
  orderTypeUuid: '52a447d3-a64a-11e3-9aeb-50e549534c5e',
  visitTypeUuid: 'b1f0e8a1-9c5d-4f0e-8892-81f3140fbc09', // Atención Ambulatoria.
  identifierSourceUuid: '8549f706-7e85-4c1d-9424-217d50a2988b',
  identifierTypeUuid: '05a29f94-c0ed-11e2-94be-8c13b969e334',
} as const;

/** Minimum core privileges; the coordinated account also needs its laboratory UI/OMOD permissions. */
export const laboratoryFixtureRequiredPrivileges = [
  'Get Users',
  'Get Providers',
  'Get Patients',
  'Get Patient Identifiers',
  'Get Identifier Types',
  'Get People',
  'Get Visits',
  'Get Encounters',
  'Get Orders',
  'Get Observations',
  'Add Patients',
  'Delete Patients',
  'Delete People',
  'Add Visits',
  'Delete Visits',
  'Add Encounters',
  'Edit Encounters',
  'Delete Encounters',
  'Add Orders',
  'Edit Orders',
  'Delete Orders',
  'Add Observations',
  'Edit Observations',
  'Delete Observations',
] as const;

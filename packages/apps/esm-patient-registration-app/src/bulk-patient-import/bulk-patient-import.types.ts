export const santaClotildeHeaders = [
  'ORDEN',
  'DNI',
  'SEXO',
  'F.N.',
  'A.PATERNO',
  'A.MATERNO',
  'NOMBRES',
  'PARENTESCO',
  'DOMICILIO',
] as const;

export type SantaClotildeHeader = (typeof santaClotildeHeaders)[number];

export type ImportStatus = 'pending' | 'valid' | 'warning' | 'error' | 'creating' | 'created' | 'failed' | 'skipped';

export interface ParsedPatientImportRow {
  id: string;
  rowNumber: number;
  raw: Record<SantaClotildeHeader, string>;
  normalized: {
    orden: string;
    dni: string;
    gender: 'M' | 'F' | 'O' | 'U' | '';
    birthdate: string;
    familyName: string;
    familyName2: string;
    givenName: string;
    middleName: string;
    parentesco: string;
    domicilio: string;
  };
  errors: Array<string>;
  warnings: Array<string>;
  status: ImportStatus;
  patientUuid?: string;
  importMessage?: string;
}

export interface ImportSummary {
  total: number;
  valid: number;
  warnings: number;
  errors: number;
  created: number;
  failed: number;
}

import type { FetchResponse, FHIRResource } from '@openmrs/esm-framework';

type ReferenceRangeValue = number | null | undefined;

export type FHIRSearchBundleResponse = FetchResponse<{
  entry: Array<FHIRResource>;
  link: Array<{ relation: string; url: string }>;
}>;

export interface ObsReferenceRanges {
  hiAbsolute: ReferenceRangeValue;
  hiCritical: ReferenceRangeValue;
  hiNormal: ReferenceRangeValue;
  lowNormal: ReferenceRangeValue;
  lowCritical: ReferenceRangeValue;
  lowAbsolute: ReferenceRangeValue;
}

export type ObservationInterpretation = 'critically_low' | 'critically_high' | 'high' | 'low' | 'normal';

export type MappedVitals = {
  code: string;
  interpretation: string;
  recordedDate: Date;
  value: number;
};

export interface PatientVitalsAndBiometrics {
  id: string;
  date: string;
  systolic?: number;
  diastolic?: number;
  bloodPressureRenderInterpretation?: ObservationInterpretation;
  pulse?: number;
  temperature?: number;
  spo2?: number;
  height?: number;
  weight?: number;
  headCircumference?: number; // headCircumferenceUuid (c4d39248-c896-433a-bc69-e24d04b7f0e5)
  chestCircumference?: number; // chestCircumferenceUuid (911eb398-e7de-4270-af63-e4c615ec22a9)

  stoolCount?: number; // Número de deposiciones por día
  stoolGrams?: number; // Peso de deposiciones en gramos
  urineCount?: number; // Número de micciones por día
  urineGrams?: number; // Volumen de orina en gramos/mL
  vomitCount?: number; // Número de episodios de vómito por día
  vomitGramsML?: number; // Volumen de vómito en gramos/mL

  bmi?: number | null;
  respiratoryRate?: number;
  muac?: number;
}

export interface VitalsResponse {
  entry: Array<{
    resource: FHIRResource['resource'];
  }>;
  id: string;
  meta: {
    lastUpdated: string;
  };
  link: Array<{
    relation: string;
    url: string;
  }>;
  resourceType: string;
  total: number;
  type: string;
}

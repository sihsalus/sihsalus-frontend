import type { FetchResponse, FHIRResource } from '@openmrs/esm-framework';

type ReferenceRangeValue = number | null | undefined;

export type FHIRSearchBundleResponse = FetchResponse<{
  entry: Array<FHIRResource>;
  link: Array<{ relation: string; url: string }>;
}>;

export interface ObsReferenceRanges {
  hiAbsolute?: ReferenceRangeValue;
  hiCritical?: ReferenceRangeValue;
  hiNormal?: ReferenceRangeValue;
  lowNormal?: ReferenceRangeValue;
  lowCritical?: ReferenceRangeValue;
  lowAbsolute?: ReferenceRangeValue;
}

export type ObservationInterpretation = 'critically_low' | 'critically_high' | 'high' | 'low' | 'normal';

export type FHIRInterpretation = 'Critically Low' | 'Critically High' | 'High' | 'Low' | 'Normal';

export type MappedVitals = {
  code: string;
  interpretation: ObservationInterpretation;
  recordedDate: string | Date;
  value: number;
  encounterId: string;
};

export interface PatientVitalsAndBiometrics {
  id: string;
  date: string;
  systolic?: number;
  diastolic?: number;
  bloodPressureRenderInterpretation?: ObservationInterpretation;
  systolicRenderInterpretation?: ObservationInterpretation;
  diastolicRenderInterpretation?: ObservationInterpretation;
  pulseRenderInterpretation?: ObservationInterpretation;
  temperatureRenderInterpretation?: ObservationInterpretation;
  spo2RenderInterpretation?: ObservationInterpretation;
  heightRenderInterpretation?: ObservationInterpretation;
  weightRenderInterpretation?: ObservationInterpretation;
  bmiRenderInterpretation?: ObservationInterpretation;
  respiratoryRateRenderInterpretation?: ObservationInterpretation;
  muacRenderInterpretation?: ObservationInterpretation;
  abdominalCircumferenceRenderInterpretation?: ObservationInterpretation;
  headCircumferenceRenderInterpretation?: ObservationInterpretation;
  chestCircumferenceRenderInterpretation?: ObservationInterpretation;
  glasgowEyeOpeningRenderInterpretation?: ObservationInterpretation;
  glasgowVerbalResponseRenderInterpretation?: ObservationInterpretation;
  glasgowMotorResponseRenderInterpretation?: ObservationInterpretation;
  glasgowTotalRenderInterpretation?: ObservationInterpretation;
  pulse?: number;
  temperature?: number;
  spo2?: number;
  height?: number;
  weight?: number;
  headCircumference?: number;
  chestCircumference?: number;
  bmi?: number | null;
  respiratoryRate?: number;
  muac?: number;
  abdominalCircumference?: number;
  glasgowEyeOpening?: string;
  glasgowVerbalResponse?: string;
  glasgowMotorResponse?: string;
  glasgowTotal?: number;
  note?: string;
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

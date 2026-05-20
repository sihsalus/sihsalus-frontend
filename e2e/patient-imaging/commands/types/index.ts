export interface Patient {
  uuid: string;
  identifiers: Identifier[];
  display: string;
  person: {
    uuid: string;
    display: string;
    gender: string;
    age: number;
    birthdate: string;
    birthdateEstimated: boolean;
    dead: boolean;
    deathDate?: any;
    causeOfDeath?: any;
    preferredAddress: {
      address1: string;
      cityVillage: string;
      country: string;
      postalCode: string;
      stateProvince: string;
      countyDistrict: string;
    };
    attributes: any[];
    voided: boolean;
    birthtime?: any;
    deathdateEstimated: boolean;
    resourceVersion: string;
  };
  attributes: { value: string; attributeType: { uuid: string; display: string } }[];
  voided: boolean;
}

export interface Address {
  preferred: boolean;
  address1: string;
  cityVillage: string;
  country: string;
  postalCode: string;
  stateProvince: string;
}

export interface Identifier {
  uuid: string;
  display: string;
}

export interface DicomStudy {
  id: number;
  studyInstanceUID: string;
  orthancStudyUID: string;
  orthancConfiguration: OrthancConfiguration;
  patientName: string;
  mrsPatientUuid: string;
  studyDate: string;
  studyDescription: string;
  gender?: string;
}

export interface Series {
  seriesInstanceUID: string;
  orthancSeriesUID: string;
  orthancConfiguration: OrthancConfiguration;
  seriesDescription: string;
  seriesNumber: string;
  seriesDate: string;
  seriesTime: string;
  modality: string;
}

export interface OrthancConfiguration {
  id: number;
  orthancBaseUrl: string;
  orthancProxyUrl?: string;
}

export interface Instance {
  sopInstanceUID: string;
  orthancInstanceUID: string;
  instanceNumber: string;
  imagePositionPatient: string;
  numberOfFrames: string;
  orthancConfiguration: OrthancConfiguration;
}

export interface CreateRequestProcedure {
  orthancConfiguration: OrthancConfiguration;
  patientUuid: string;
  accessionNumber: string;
  requestingPhysician: string;
  requestDescription: string;
  priority: string;
}

export interface RequestProcedure {
  id: number;
  status: string;
  orthancConfiguration: OrthancConfiguration;
  patientUuid: string;
  accessionNumber: string;
  studyInstanceUID?: string;
  requestingPhysician: string;
  requestDescription: string;
  priority: string;
}

export interface CreateRequestProcedureStep {
  requestId: number;
  modality: string;
  aetTitle: string;
  scheduledReferringPhysician: string;
  requestedProcedureDescription: string;
  stepStartDate: string;
  stepStartTime: string;
  stationName?: string;
  procedureStepLocation?: string;
}

export interface RequestProcedureStep {
  id: number;
  requestProcedureId: number;
  modality: string;
  aetTitle: string;
  scheduledReferringPhysician: string;
  requestedProcedureDescription: string;
  stepStartDate: string;
  stepStartTime: string;
  performedProcedureStepStatus: string;
  stationName?: string;
  procedureStepLocation?: string;
}

export enum StudyStatus {
  REGISTERED = 'registered',
  AVAILABLE = 'available',
  CANCELLED = 'cancelled',
  ENTERED_IN_ERROR = 'entered-in-error',
  UNKNOWN = 'unknown',
  INACTIVE = 'inactive',
}

export const modalityOptions = [
  { code: 'CR', label: 'CR (Computed Radiography)' },
  { code: 'CT', label: 'CT (Computed Tomography)' },
  { code: 'MR', label: 'MR (Magnetic Resonance Imaging)' },
  { code: 'US', label: 'US (Ultrasound)' },
  { code: 'XA', label: 'XA (X-ray Angiography)' },
  { code: 'DX', lable: 'DX (Digital Radiography)' },
  { code: 'MG', label: 'MG (Mammography)' },
  { code: 'PT', label: 'NM (Nuclear Medicine)' },
  { code: 'PT', label: 'PT (Positron Emission Tomography)' },
  { code: 'RF', label: 'RF (Radio Fluoroscopy)' },
  { code: 'SC', label: 'SC (Secondary Capture)' },
  { code: 'XC', label: 'XC (External-camera Photography)' },
  { code: 'OP', lable: 'OP (Ophthalmic Photography)' },
  { code: 'PR', label: 'PR (Presentation State)' },
  { code: 'SR', label: 'SR (Structured Report)' },
  { code: 'RT', label: 'RT (Radiotherapy)' },
];

export interface StudiesWithScores {
  studies: Array<DicomStudy>;
  scores: Map<string, number>;
}

export const priorityLevels = ['low', 'medium', 'high'];

import { toDICOMDateTime } from '../src/imaging/utils/help';

import type {
  DicomStudy,
  Instance,
  OrthancConfiguration,
  RequestProcedure,
  RequestProcedureStep,
  Series,
} from '../src/types';

export const testStudy: Array<DicomStudy> = [
  {
    id: 0,
    studyInstanceUID: '2.16.840.1.113669.632.20.1211.10000098591',
    orthancStudyUID: 'abc123def456',
    mrsPatientUuid: 'f2439e62-8f0d-4a4f-85a1-cad42b0dfb62',
    // mrsPatient: {
    //     uuid: 'f2439e62-8f0d-4a4f-85a1-cad42b0dfb62', // from OpenmrsResourceStrict
    //     display: 'John Doe',                          // from OpenmrsResourceStrict
    //     identifiers: [
    //       {
    //           identifier: '1001A',
    //           identifierType: {
    //               uuid: 'abc-def-123',
    //               display: 'National ID',
    //           },
    //           preferred: true,
    //           voided: false,
    //           uuid: '1000HM2'
    //       },
    //     ],
    //     person: {
    //       uuid: '789e1234-e89b-42f1-b2a2-123456789abc',
    //       display: 'John Doe',
    //       gender: 'M',
    //       birthdate: '1985-05-15',
    //       birthdateEstimated: false,
    //       dead: false,
    //       age: 39,
    //       names: [
    //         {
    //             givenName: 'John',
    //             familyName: 'Doe',
    //             uuid: ''
    //         },
    //       ],
    //       addresses: [
    //         {
    //             address1: '123 Main St',
    //             cityVillage: 'Springfield',
    //             country: 'USA',
    //             uuid: ''
    //         },
    //       ],
    //     },
    //     voided: false,
    //   },
    orthancConfiguration: {
      id: 1,
      orthancProxyUrl: '',
      orthancBaseUrl: 'http://localhost:8042',
    },
    patientName: 'John Doe',
    studyDate: '2025-04-07',
    // studyTime: "14:30:00",
    studyDescription: 'CT Chest without contrast',
    gender: 'Male',
  },
];

export const testSeries: Array<Series> = [
  {
    // id: 1,
    seriesInstanceUID: '1.2.840.113704.1.111.5692.1127828999.2',
    orthancSeriesUID: 'df8a96b2-bfa2e9b1-6e7b7f4c-35c4a7bd-0b1a9911',
    orthancConfiguration: {
      id: 1,
      orthancProxyUrl: '',
      orthancBaseUrl: 'http://localhost:8042',
    },
    seriesDescription: 'CT Abdomen',
    seriesNumber: '2276',
    seriesDate: '2025-04-08',
    seriesTime: '13:45:00',
    modality: 'CT',
  },
  {
    // id: 2,
    seriesInstanceUID: '1.2.840.113704.1.111.5692.1127829280.6',
    orthancSeriesUID: 'df8a96b2-bfa2e9b1-6e7b7f4c-35c4a7bd-0b1a9911',
    orthancConfiguration: {
      id: 1,
      orthancProxyUrl: '',
      orthancBaseUrl: 'http://localhost:8042',
    },
    seriesDescription: 'CT Abdomen',
    seriesNumber: '2277',
    seriesDate: '2025-04-08',
    seriesTime: '13:45:00',
    modality: 'CT',
  },
];

export const testRequestProcedureList: Array<RequestProcedure> = [
  {
    id: 1,
    status: 'In progress',
    orthancConfiguration: {
      id: 1,
      orthancProxyUrl: '',
      orthancBaseUrl: 'http://localhost:8042',
    },
    patientUuid: 'f2439e62-8f0d-4a4f-85a1-cad42b0dfb62',
    accessionNumber: 'ACC12345678',
    studyInstanceUID: '2.16.840.1.113669.632.20.1211.10000098591',
    requestingPhysician: 'Dr. John Smith',
    requestDescription: 'MRI Brain with contrast',
    priority: 'High',
  },
];

export const testRequestProcedure: Array<RequestProcedure> = [
  {
    id: 1,
    status: 'scheduled',
    orthancConfiguration: {
      id: 1,
      orthancProxyUrl: '',
      orthancBaseUrl: 'http://localhost:8042',
    },
    patientUuid: 'f2439e62-8f0d-4a4f-85a1-cad42b0dfb62',
    accessionNumber: 'ACC12345678',
    studyInstanceUID: '2.16.840.1.113669.632.20.1211.10000098591',
    requestingPhysician: 'Dr. John Smith',
    requestDescription: 'MRI Brain with contrast',
    priority: 'High',
  },
];

export const testConfigurations: Array<OrthancConfiguration> = [
  {
    id: 1,
    orthancBaseUrl: 'http://localhost:8042',
    orthancProxyUrl: '',
  },
  {
    id: 2,
    orthancBaseUrl: 'http://localhost:8062',
    orthancProxyUrl: '',
  },
];

export const testInstances: Array<Instance> = [
  {
    // id: 1,
    sopInstanceUID: '1.2.840.113704.1.111.6168.1127829431.11401',
    orthancInstanceUID: 'f3a5c83e-b3f5-4a5d-8f0f-5a0a8f4f5b7c',
    instanceNumber: '1',
    imagePositionPatient: '-112-17.333334-540',
    numberOfFrames: '',
    orthancConfiguration: {
      id: 1,
      orthancProxyUrl: '',
      orthancBaseUrl: 'http://localhost:8042',
    },
  },
  {
    // id: 2,
    sopInstanceUID: '1.2.840.113704.1.111.6168.1127829433.11402',
    orthancInstanceUID: 'e2b3d39e-6bfc-4ef4-a96a-daa176d6d010',
    instanceNumber: '2',
    imagePositionPatient: '-112-17.333334-540.700012',
    numberOfFrames: '',
    orthancConfiguration: {
      id: 1,
      orthancProxyUrl: '',
      orthancBaseUrl: 'http://localhost:8042',
    },
  },
  {
    // id: 3,
    sopInstanceUID: '1.2.840.113704.1.111.6168.1127829433.11403',
    orthancInstanceUID: 'd1c7e28a-2e42-432e-9c6a-b58700a1c9e2',
    instanceNumber: '3',
    imagePositionPatient: '-112-17.333334-541.400024',
    numberOfFrames: '',
    orthancConfiguration: {
      id: 1,
      orthancProxyUrl: '',
      orthancBaseUrl: 'http://localhost:8042',
    },
  },
  {
    // id: 4,
    sopInstanceUID: '1.2.840.113704.1.111.6168.1127829434.11404',
    orthancInstanceUID: 'd1c7e28a-2e42-432e-9c6a-b58700a1c9e2',
    instanceNumber: '4',
    imagePositionPatient: '-112-17.333334-542.099976',
    numberOfFrames: '',
    orthancConfiguration: {
      id: 1,
      orthancProxyUrl: '',
      orthancBaseUrl: 'http://localhost:8042',
    },
  },
  {
    // id: 5,
    sopInstanceUID: '1.2.840.113704.1.111.6168.1127829434.11405',
    orthancInstanceUID: 'd1c7e28a-2e42-432e-9c6a-b58700a1c9e2',
    instanceNumber: '5',
    imagePositionPatient: '-112-17.333334-542.799988',
    numberOfFrames: '',
    orthancConfiguration: {
      id: 1,
      orthancProxyUrl: '',
      orthancBaseUrl: 'http://localhost:8042',
    },
  },
  {
    // id: 6,
    sopInstanceUID: '1.2.840.113704.1.111.6168.1127829434.11406',
    orthancInstanceUID: 'd1c7e28a-2e42-432e-9c6a-b58700a1c9e2',
    instanceNumber: '6',
    imagePositionPatient: '-112-17.333334-543.5',
    numberOfFrames: '',
    orthancConfiguration: {
      id: 1,
      orthancProxyUrl: '',
      orthancBaseUrl: 'http://localhost:8042',
    },
  },
  {
    // id: 7,
    sopInstanceUID: '1.2.840.113704.1.111.6168.1127829434.11407',
    orthancInstanceUID: 'd1c7e28a-2e42-432e-9c6a-b58700a1c9e2',
    instanceNumber: '7',
    imagePositionPatient: '-112-17.333334-544.200012',
    numberOfFrames: '',
    orthancConfiguration: {
      id: 1,
      orthancProxyUrl: '',
      orthancBaseUrl: 'http://localhost:8042',
    },
  },
];

export const testProcedureSteps: Array<RequestProcedureStep> = [
  {
    id: 1,
    requestProcedureId: 0,
    modality: 'CT',
    aetTitle: 'AET_CT1',
    scheduledReferringPhysician: 'Dr. Alice Morgan',
    requestedProcedureDescription: 'CT scan of the chest to evaluate nodules.',
    stepStartDate: toDICOMDateTime(new Date()),
    stepStartTime: '08:30',
    performedProcedureStepStatus: 'scheduled',
    stationName: 'CT_STATION_01',
    procedureStepLocation: 'Radiology Room 1',
  },
  {
    id: 2,
    requestProcedureId: 0,
    modality: 'MR',
    aetTitle: 'AET_MR2',
    scheduledReferringPhysician: 'Dr. Brian Lee',
    requestedProcedureDescription: 'MRI of the brain for headache evaluation.',
    stepStartDate: toDICOMDateTime(new Date()),
    stepStartTime: '09:15',
    performedProcedureStepStatus: 'IN_PROGRESS',
    stationName: 'MRI_STATION_01',
    procedureStepLocation: 'MRI Suite A',
  },
  {
    id: 3,
    requestProcedureId: 0,
    modality: 'US',
    aetTitle: 'AET_US3',
    scheduledReferringPhysician: 'Dr. Claire Zhang',
    requestedProcedureDescription: 'Abdominal ultrasound to check liver status.',
    stepStartDate: toDICOMDateTime(new Date()),
    stepStartTime: '10:00',
    performedProcedureStepStatus: 'COMPLETED',
    stationName: 'US_STATION_01',
    procedureStepLocation: 'Ultrasound Room 2',
  },
  {
    id: 4,
    requestProcedureId: 0,
    modality: 'CR',
    aetTitle: 'AET_CR4',
    scheduledReferringPhysician: 'Dr. Daniel Kim',
    requestedProcedureDescription: 'X-ray of left knee due to injury.',
    stepStartDate: toDICOMDateTime(new Date()),
    stepStartTime: '10:45',
    performedProcedureStepStatus: 'COMPLETED',
    stationName: 'XRY_STATION_01',
    procedureStepLocation: 'X-Ray Room B',
  },
];

export const testMrsPatient = {
  mrsPatient: {
    uuid: 'f2439e62-8f0d-4a4f-85a1-cad42b0dfb62', // from OpenmrsResourceStrict
    display: 'John Doe', // from OpenmrsResourceStrict
    identifiers: [
      {
        identifier: '1001A',
        identifierType: {
          uuid: 'abc-def-123',
          display: 'National ID',
        },
        preferred: true,
        voided: false,
        uuid: '1000HM2',
      },
    ],
    person: {
      uuid: '789e1234-e89b-42f1-b2a2-123456789abc',
      display: 'John Doe',
      gender: 'M',
      birthdate: '1985-05-15',
      birthdateEstimated: false,
      dead: false,
      age: 39,
      names: [
        {
          givenName: 'John',
          familyName: 'Doe',
          uuid: '',
        },
      ],
      addresses: [
        {
          address1: '123 Main St',
          cityVillage: 'Springfield',
          country: 'USA',
          uuid: '',
        },
      ],
    },
    voided: false,
  },
};

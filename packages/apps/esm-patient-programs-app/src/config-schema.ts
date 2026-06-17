import { Type } from '@openmrs/esm-framework';

export const configSchema = {
  hideAddProgramButton: {
    _type: Type.Boolean,
    _default: false,
  },
  showProgramStatusField: {
    _type: Type.Boolean,
    _description:
      'Whether to show the Program status field in the Record program enrollment and Edit program enrollment forms. If set to true, the `Program status` field is displayed in the Programs datatable',
    _default: false,
  },
  programEligibilityRules: {
    _type: Type.Array,
    _description:
      'Rules used to hide programs from the enrollment selector when the patient does not match demographic eligibility. Programs without a rule remain visible.',
    _default: [
      {
        label: 'Tuberculosis',
        programUuid: 'f43fa551-d559-4268-856b-7e16b37ab712',
      },
      {
        label: 'VIH/SIDA',
        programUuid: '1eb6833d-fc44-4d2c-b243-ddab949479b3',
      },
      {
        label: 'Control de Niño Sano',
        programUuid: 'b9db5c39-2855-4c61-9f25-9a7ec2d564bc',
        maxAgeYears: 11,
      },
      {
        label: 'Programa de Vacunación Infantil',
        programUuid: '5c6b44f5-be98-48b6-bd58-de2b5db86a12',
        maxAgeYears: 11,
      },
      {
        label: 'Madre Gestante',
        programUuid: '3cb4ffd6-1b67-4c52-8398-4bf9844a415e',
        minAgeYears: 10,
        maxAgeYears: 59,
        genders: ['female'],
      },
      {
        label: 'Inmunización para Embarazadas',
        programUuid: '41d6f9c4-7b3e-4fbd-9e8b-1f9c0a3b9e7d',
        minAgeYears: 10,
        maxAgeYears: 59,
        genders: ['female'],
      },
      {
        label: 'Adulto Mayor',
        programUuid: '6b4399cb-1758-4af2-953f-efada7ddecd2',
        minAgeYears: 60,
      },
    ],
    _elements: {
      _type: Type.Object,
      label: {
        _type: Type.String,
        _optional: true,
      },
      programUuid: {
        _type: Type.UUID,
      },
      minAgeYears: {
        _type: Type.Number,
        _optional: true,
      },
      maxAgeYears: {
        _type: Type.Number,
        _optional: true,
      },
      genders: {
        _type: Type.Array,
        _optional: true,
        _elements: {
          _type: Type.String,
        },
      },
    },
  },
  programNavigationTargets: {
    _type: Type.Array,
    _description:
      'Patient chart destinations shown as "Go to" links in the program enrollment tables. The chartPath value is appended to /patient/:patientUuid/chart/.',
    _default: [
      {
        label: 'Control de Niño Sano',
        programUuid: 'b9db5c39-2855-4c61-9f25-9a7ec2d564bc',
        chartPath: 'well-child-care-dashboard',
      },
      {
        label: 'Programa de Vacunación Infantil',
        programUuid: '5c6b44f5-be98-48b6-bd58-de2b5db86a12',
        chartPath: 'child-immunization-schedule-dashboard',
      },
      {
        label: 'Madre Gestante',
        programUuid: '3cb4ffd6-1b67-4c52-8398-4bf9844a415e',
        chartPath: 'prenatal-care-dashboard',
      },
      {
        label: 'Planificación Familiar',
        programUuid: '720a0a1e-6cd1-426e-968c-7488bb39e9a3',
        chartPath: 'family-planning-dashboard',
      },
    ],
    _elements: {
      _type: Type.Object,
      label: {
        _type: Type.String,
        _optional: true,
      },
      programUuid: {
        _type: Type.UUID,
      },
      chartPath: {
        _type: Type.String,
      },
    },
  },
};

export interface ConfigObject {
  hideAddProgramButton: boolean;
  showProgramStatusField: boolean;
  programEligibilityRules: Array<{
    label?: string;
    programUuid: string;
    minAgeYears?: number;
    maxAgeYears?: number;
    genders?: Array<string>;
  }>;
  programNavigationTargets: Array<{
    label?: string;
    programUuid: string;
    chartPath: string;
  }>;
}

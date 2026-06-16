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
}

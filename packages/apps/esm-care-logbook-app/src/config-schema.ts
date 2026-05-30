import { Type } from '@openmrs/esm-framework';

export const configSchema = {
  admissionReportPageSize: {
    _type: Type.Number,
    _default: 50,
    _description: 'Number of recent care encounters shown in the UPSS care report.',
  },
};

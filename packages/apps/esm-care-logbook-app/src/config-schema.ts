import { Type } from '@openmrs/esm-framework';

export const configSchema = {
  admissionReportPageSize: {
    _type: Type.Number,
    _default: 50,
    _description:
      'REST batch size (1–200) for the care logbook. All pages in the selected period are loaded; this is not a report limit.',
  },
};

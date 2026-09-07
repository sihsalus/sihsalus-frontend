import { Type, validator } from '@openmrs/esm-framework';

export const attachmentsConfigSchema = {
  enableLabOrderPdfAttachments: {
    _type: Type.Boolean,
    _description:
      'Enable supplemental PDF attachments for laboratory orders after the compatible backend and role contract are deployed.',
    _default: false,
  },
  maxFileSize: {
    _type: Type.Number,
    _description: 'Maximum allowed upload file size (in MB)',
    _default: 1,
    _validators: [validator((v: unknown) => typeof v === 'number' && v > 0, 'Must be greater than zero')],
  },
};

export interface AttachmentsConfig {
  enableLabOrderPdfAttachments: boolean;
  maxFileSize: number;
}

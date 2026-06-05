import { Type } from '@openmrs/esm-framework';

export interface TemplateConfig {
  enabled: boolean;
  title: string;
}

export const configSchema = {
  enabled: {
    _type: Type.Boolean,
    _default: true,
    _description: 'Controls whether the template app renders its default content.',
  },
  title: {
    _type: Type.String,
    _default: 'Template app',
    _description: 'Title shown on the template app landing page.',
  },
};

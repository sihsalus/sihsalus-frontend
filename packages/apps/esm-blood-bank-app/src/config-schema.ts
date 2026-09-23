import { Type } from '@openmrs/esm-framework';

export interface BloodBankConfig {
  enabled: boolean;
  useMockData: boolean;
}

export const configSchema = {
  enabled: {
    _type: Type.Boolean,
    _default: true,
    _description: 'Habilita el microfrontend de Banco de Sangre.',
  },
  useMockData: {
    _type: Type.Boolean,
    _default: true,
    _description: 'Usa datos locales mientras la API de Banco de Sangre no esté disponible.',
  },
};

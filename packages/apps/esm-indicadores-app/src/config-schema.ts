import { Type } from '@openmrs/esm-framework';

export const configSchema = {
  indicatorsApiPath: {
    _type: Type.String,
    _default: '/ws/module/indicators/api',
    _description: 'DEPRECATED: Replaced by reportesSqlApiPath. This key is no longer consumed by the app.',
  },
  reportesSqlApiPath: {
    _type: Type.String,
    _default: '/services/reportes-sql',
    _description:
      'Base path for the reportes-sql backend service. ' +
      'Use a relative path (e.g. /services/reportes-sql): openmrsFetch prepends the OpenMRS base, ' +
      'the request stays same-origin, and the OpenMRS session cookie is sent. ' +
      'Keep it relative — an absolute URL bypasses the gateway and, being cross-origin, ' +
      'would not carry the session cookie.',
  },
};

export type ConfigObject = {
  indicatorsApiPath: string;
  reportesSqlApiPath: string;
};

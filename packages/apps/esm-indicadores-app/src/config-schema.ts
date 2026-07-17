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
      'Use a relative path (e.g. /services/reportes-sql) in production — openmrsFetch prepends the OpenMRS base. ' +
      'For local development against a standalone reportes-sql backend, set this to an absolute URL ' +
      '(e.g. http://127.0.0.1:8000) — openmrsFetch passes absolute URLs through unchanged, ' +
      'so no dev-server proxy is needed.',
  },
  enableDemoData: {
    _type: Type.Boolean,
    _default: false,
    _description:
      'Enables local example data when reportes-sql is unavailable. Keep disabled outside explicit demos; ' +
      'write operations always require the real backend even when this option is enabled.',
  },
};

export type Config = {
  indicatorsApiPath: string;
  reportesSqlApiPath: string;
  enableDemoData: boolean;
};

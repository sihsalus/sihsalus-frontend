import { Type, validator } from '@openmrs/esm-framework';

export const defaultLegacyConceptCompatibilityMap: Record<string, string> = {
  '5219AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA': '71b58cff-879b-4358-98d5-2165434d4324',
  '160531AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA': '162169AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  '159615AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA': 'c4010006-0000-4000-8000-000000000006',
  '1271AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA': '162169AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  '1651AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA': '162169AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  '1282AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA': '162169AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  '1272AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA': '162169AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
};

export const configSchema = {
  /** @deprecated use customDataSources instead */
  dataSources: {
    monthlySchedule: {
      _type: Type.Boolean,
      _default: false,
      _description:
        'Whether to use monthly scheduled appointment data source in form-entry engine. Requires `appointmentsResourceUrl`.',
    },
  },
  customDataSources: {
    _type: Type.Array,
    _default: [],
    _elements: {
      name: {
        _type: Type.String,
        _default: 'customDataSource',
        _description: 'The name of the data source. This is how the data source is referenced inside the form.',
        _validators: [validator((val) => val !== '', 'Must have a value')],
      },
      moduleName: {
        _type: Type.String,
        _default: '',
        _description:
          'The specifier for the module, e.g., "@myOrg/myGreatDataSource". This module should be defined in your import map and will be loaded for all forms.',
        _validators: [validator((val) => val !== '', 'Must have a value')],
      },
      moduleExport: {
        _type: Type.String,
        _default: 'default',
        _description:
          'The property of the module to be exposed as the data source. This is the name of the exported JS object. For example, setting this to "ageFactory" will use the attribute named "ageFactory". The default value, "default", will point to the default export, if your JS module has one.',
      },
    },
  },
  appointmentsResourceUrl: {
    _type: Type.String,
    _default: '/etl-latest/etl/get-monthly-schedule',
    _description:
      'Custom URL to load resources required for appointment monthly schedule feature (under `dataSources`).',
  },
  customEncounterDatetime: {
    _type: Type.Boolean,
    _default: false,
    _description:
      'Whether to default the encounterDate to visitStartDatetime if the visitStartDatetime is before current Date.',
  },
  legacyConceptCompatibilityMap: {
    _type: Type.Object,
    _default: defaultLegacyConceptCompatibilityMap,
    _description:
      'Maps legacy form concept UUIDs to concept UUIDs available in the active backend dictionary before rendering/submitting forms.',
  },
};

export interface ConfigObject {
  legacyConceptCompatibilityMap: Record<string, string>;
}

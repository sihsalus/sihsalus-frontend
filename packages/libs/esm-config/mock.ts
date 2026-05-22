import { createGlobalStore } from '@openmrs/esm-state/mock';
import { getDefaultsFromConfigSchema } from '@openmrs/esm-utils';
import { vi } from 'vitest';
import { type ConfigSchema } from './src/types';

export { validator, validators } from './src/index';

export const configInternalStore = createGlobalStore('config-internal', {});

export const implementerToolsConfigStore = createGlobalStore('implementer-tools-config', {});

export const temporaryConfigStore = createGlobalStore('temporary-config', {});

export enum Type {
  Array = 'Array',
  Boolean = 'Boolean',
  ConceptUuid = 'ConceptUuid',
  Number = 'Number',
  Object = 'Object',
  String = 'String',
  UUID = 'UUID',
}

export let configSchema: ConfigSchema = {}; // NOSONAR

export const getConfig = vi.fn(() =>
  Promise.resolve(getDefaultsFromConfigSchema(configSchema as unknown as Record<PropertyKey, unknown>)),
);

export function defineConfigSchema(_moduleName: string, schema: ConfigSchema) {
  configSchema = schema;
}

export function defineExtensionConfigSchema(_extensionName: string, schema: ConfigSchema) {
  configSchema = schema;
}

export const clearConfigErrors = vi.fn();

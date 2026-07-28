import { useEffect } from 'react';
import { MonthlyScheduleDataSource } from '../data-sources/monthly-schedule.datasource';
import { type DataSource, registerCustomDataSource } from '../form-engine-lib-runtime';
import type { FormEntryReactConfig, OpenmrsResource } from '../types';

interface ModuleFederationContainer {
  get(module: string): Promise<() => Record<string, unknown>>;
}

type DataSourceModuleExport = DataSource<OpenmrsResource> | undefined;
const registeredDataSources = new Set<string>();

declare global {
  interface Window {
    [key: string]: unknown;
  }
}

/**
 * Converts a module name (e.g., "@myOrg/myGreatDataSource") to a window global slug.
 * Matches the Angular app's logic for finding modules via webpack module federation.
 */
function slugify(name: string): string {
  return name.replace(/[/@-]/g, '_');
}

/**
 * Loads custom data sources from window globals (webpack module federation)
 * and registers them with the FormEngine's data source registry.
 *
 * Each custom data source is defined in the config as:
 * { name, moduleName, moduleExport }
 *
 * The module is expected to be loaded via the import map and accessible
 * as window[slugify(moduleName)].
 */
export function useCustomDataSources(config: FormEntryReactConfig) {
  useEffect(() => {
    if (config.dataSources?.monthlySchedule) {
      if (!config.appointmentsResourceUrl) {
        console.warn(
          'Custom data source "monthlySchedule": `appointmentsResourceUrl` must be configured when `dataSources.monthlySchedule` is enabled.',
        );
      } else {
        registerDataSourceOnce('monthlySchedule', () =>
          Promise.resolve({
            default: new MonthlyScheduleDataSource(config.appointmentsResourceUrl),
          }),
        );
      }
    }

    const loadDataSources = async (): Promise<void> => {
      for (const { name, moduleName, moduleExport } of config.customDataSources) {
        try {
          const slug = slugify(moduleName);
          const moduleEntry = window[slug];

          if (!isModuleFederationContainer(moduleEntry)) {
            console.warn(
              `Custom data source "${name}": module "${moduleName}" (window.${slug}) not found or does not have a "get" method.`,
            );
            continue;
          }

          const factory = await moduleEntry.get('./start');
          const module = factory();
          const dataSource = getDataSourceExport(module, moduleExport);

          if (!dataSource) {
            console.warn(`Custom data source "${name}": export "${moduleExport}" not found in module "${moduleName}".`);
            continue;
          }

          registerDataSourceOnce(name, () => Promise.resolve({ default: dataSource }));
        } catch (error) {
          console.warn(`Failed to load custom data source "${name}" from module "${moduleName}":`, error);
        }
      }
    };

    if (!config.customDataSources?.length) {
      return;
    }

    void loadDataSources();
  }, [config.appointmentsResourceUrl, config.customDataSources, config.dataSources?.monthlySchedule]);
}

function isModuleFederationContainer(value: unknown): value is ModuleFederationContainer {
  return typeof value === 'object' && value !== null && 'get' in value && typeof value.get === 'function';
}

function isDataSource(value: unknown): value is DataSource<OpenmrsResource> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'fetchData' in value &&
    typeof value.fetchData === 'function' &&
    'fetchSingleItem' in value &&
    typeof value.fetchSingleItem === 'function' &&
    'toUuidAndDisplay' in value &&
    typeof value.toUuidAndDisplay === 'function'
  );
}

function getDataSourceExport(module: Record<string, unknown>, moduleExport: string): DataSourceModuleExport {
  const namedExport = module[moduleExport];
  if (isDataSource(namedExport)) {
    return namedExport;
  }

  const defaultExport = module.default;
  if (isDataSource(defaultExport)) {
    return defaultExport;
  }

  return undefined;
}

function registerDataSourceOnce(name: string, load: () => Promise<{ default: DataSource<OpenmrsResource> }>): void {
  if (registeredDataSources.has(name)) {
    return;
  }

  registerCustomDataSource({ name, load });
  registeredDataSources.add(name);
}

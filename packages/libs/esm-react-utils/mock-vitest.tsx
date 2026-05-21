import { openmrsFetch } from '@openmrs/esm-api/mock';
import { configSchema } from '@openmrs/esm-config/mock';
import { getExtensionInternalStore } from '@openmrs/esm-extensions/mock';
import { createGlobalStore } from '@openmrs/esm-state/mock';
import React from 'react';
import { useFhirFetchAll as realUseFhirFetchAll } from './src/useFhirFetchAll';
import { useFhirInfinite as realUseFhirInfinite } from './src/useFhirInfinite';
import { useFhirPagination as realUseFhirPagination } from './src/useFhirPagination';
import { isDesktop as realIsDesktop } from './src/useLayoutType';
import { useOpenmrsFetchAll as realUseOpenmrsFetchAll } from './src/useOpenmrsFetchAll';
import { useOpenmrsInfinite as realUseOpenmrsInfinite } from './src/useOpenmrsInfinite';
import { useOpenmrsPagination as realUseOpenmrsrPagination } from './src/useOpenmrsPagination';
import { usePagination as realUsePagination } from './src/usePagination';
import { usePaginationInfo as realUsePaginationInfo } from './src/usePaginationInfo';
import { useVisitContextStore as realUseVisitContextStore } from './src/useVisitContextStore';

export { ConfigurableLink } from './src/ConfigurableLink';
export { createUseStore, useStore, useStoreWithActions } from './src/useStore';

import * as utils from '@openmrs/esm-utils';
import { vi } from 'vitest';

export const ComponentContext = React.createContext(null);

export const openmrsComponentDecorator = vi.fn().mockImplementation(() => (component: any) => component);

export const useAttachments = vi.fn(() => ({
  isLoading: true,
  data: [],
  error: null,
  mutate: vi.fn(),
  isValidating: true,
}));

export const useConfig = vi.fn().mockImplementation((options?: { externalModuleName?: string }) => {
  if (options?.externalModuleName) {
    console.warn(`Mock useConfig called with externalModuleName: ${options.externalModuleName}`);
  }
  return utils.getDefaultsFromConfigSchema(configSchema as unknown as Record<PropertyKey, unknown>);
});

export const useCurrentPatient = vi.fn(() => []);

export const usePatient = vi.fn(() => ({
  isLoading: true,
  patient: null,
  patientUuid: null,
  error: null,
}));

export const useSession = vi.fn(() => ({
  authenticated: false,
  sessionId: '',
}));

export const useLayoutType = vi.fn(() => 'desktop');

export const useRenderableExtensions = vi.fn(() => []);

export const useAssignedExtensions = vi.fn(() => []);

export const useExtensionSlotMeta = vi.fn(() => ({}));

export const useConnectedExtensions = vi.fn(() => []);

export const UserHasAccess = vi.fn().mockImplementation((props: any) => {
  return props.children;
});

export const useExtensionInternalStore = createGlobalStore('extensionInternal', getExtensionInternalStore());

export const useExtensionStore = vi.fn();

export const ExtensionSlot = vi.fn().mockImplementation(({ children }) => <>{children}</>);

export const Extension = vi.fn().mockImplementation((_props: any) => <slot />);

export const useFeatureFlag = vi.fn().mockReturnValue(true);

export const usePagination = vi.fn(realUsePagination);
export const usePaginationInfo = vi.fn(realUsePaginationInfo);

export const useOpenmrsPagination = vi.fn(realUseOpenmrsrPagination);
export const useOpenmrsInfinite = vi.fn(realUseOpenmrsInfinite);
export const useOpenmrsFetchAll = vi.fn(realUseOpenmrsFetchAll);
export const useFhirPagination = vi.fn(realUseFhirPagination);
export const useFhirInfinite = vi.fn(realUseFhirInfinite);
export const useFhirFetchAll = vi.fn(realUseFhirFetchAll);

export const useVisit = vi.fn().mockReturnValue({
  error: null,
  mutate: vi.fn(),
  isValidating: true,
  currentVisit: null,
  activeVisit: null,
  currentVisitIsRetrospective: false,
});

export const useVisitContextStore = vi.fn(realUseVisitContextStore);

export const useVisitTypes = vi.fn(() => []);

export const useAbortController = vi.fn(() => {
  let aborted = false;
  return {
    abort: () => {
      aborted = true;
    },
    signal: {
      aborted,
    },
  } as AbortController;
});

export const useOpenmrsSWR = vi.fn((key: string | Array<any>) => {
  return { data: openmrsFetch(key.toString()) };
});

export const useDebounce = vi.fn().mockImplementation((value) => value);

export const useOnClickOutside = vi.fn(function useOnClickOutside() {
  return React.useRef();
});

export const useOnVisible = vi.fn(function useOnVisible() {
  return React.useRef();
});

export const useBodyScrollLock = vi.fn();

export const isDesktop = vi.fn(realIsDesktop);

export const useLocations = vi.fn().mockReturnValue([]);

export const toOmrsIsoString = vi.fn().mockImplementation((date: Date) => date.toISOString());

export const toDateObjectStrict = vi.fn().mockImplementation((date: string) => new Date(date));

export const getLocale = vi.fn().mockReturnValue('en');

export const useAppContext = vi.fn();

export const useAssignedExtensionIds = vi.fn();

export const useConnectivity = vi.fn();

export const useDefineAppContext = vi.fn();

export const useExtensionSlot = vi.fn();

export const useForceUpdate = vi.fn();

export const useLeftNav = vi.fn();

export const useLeftNavStore = vi.fn();

// TODO: Remove this in favour of usePrimaryIdentifierCode below
export const usePrimaryIdentifierResource = vi.fn();

export const usePrimaryIdentifierCode = vi.fn();

export const useEmrConfiguration = vi.fn().mockReturnValue({
  emrConfiguration: undefined,
  isLoadingEmrConfiguration: false,
  mutateEmrConfiguration: vi.fn(),
  errorFetchingEmrConfiguration: undefined,
});

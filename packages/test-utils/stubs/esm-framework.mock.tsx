import React from 'react';
import { vi } from 'vitest';

export type FetchResponse<T = unknown> = {
  data?: T;
  status?: number;
  ok?: boolean;
};

export const openmrsFetch = vi.fn();
export const refetchCurrentUser = vi.fn();
export const clearCurrentUser = vi.fn();
export const setSessionLocation = vi.fn();
export const setUserProperties = vi.fn();
export const setUserLanguage = vi.fn();
export const restBaseUrl = '/ws/rest/v1';
export const fhirBaseUrl = '/ws/fhir2/R4';
export const useDebounce = vi.fn((value: unknown) => value);
export const getSessionStore = vi.fn(() => ({
  getState: vi.fn(() => ({ loaded: true, session: { authenticated: false } })),
  setState: vi.fn(),
  getInitialState: vi.fn(),
  subscribe: vi.fn(),
  destroy: vi.fn(),
}));
export const navigate = vi.fn();
export const clearHistory = vi.fn();
export const showSnackbar = vi.fn();
export const showToast = vi.fn();
export const showModal = vi.fn();
export const showNotification = vi.fn();
export const getRegisteredWorkspace2Names = vi.fn(() => []);
export const getCoreTranslation = vi.fn((key: string, defaultValue?: string) => defaultValue ?? key);
export const interpolateUrl = vi.fn((url: string) => url);
export const getSyncLifecycle = vi.fn();
export const getExtensionInternalStore = vi.fn(() => ({
  getState: vi.fn(() => ({ slots: {} })),
  setState: vi.fn(),
  subscribe: vi.fn(() => vi.fn()),
}));
export const isVersionSatisfied = vi.fn(() => true);
export const translateFrom = vi.fn((value: unknown) => value);

export const useConfig = vi.fn(() => ({
  provider: { type: 'basic' },
  chooseLocation: { enabled: true, useLoginLocationTag: true },
  links: { loginSuccess: '/home' },
  showPasswordOnSeparateScreen: true,
}));

export const useConnectivity = vi.fn(() => true);
export const useSession = vi.fn(() => ({ authenticated: false, user: null, sessionLocation: null }));
export const useStore = vi.fn((store) => (typeof store?.getState === 'function' ? store.getState() : {}));
export const useAssignedExtensions = vi.fn(() => []);

export const createGlobalStore = vi.fn(<T,>(_name: string, initialState: T) => {
  let state = initialState;
  const listeners = new Set<(state: T) => void>();

  return {
    getState: () => state,
    setState: (update: Partial<T> | ((prev: T) => T)) => {
      state = typeof update === 'function' ? update(state) : ({ ...state, ...update } as T);
      listeners.forEach((listener) => {
        listener(state);
      });
    },
    subscribe: (listener: (state: T) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
});

export const Type = {
  String: 'string',
  Number: 'number',
  Boolean: 'boolean',
  Object: 'object',
  Array: 'array',
  UUID: 'uuid',
  ConceptUuid: 'concept-uuid',
};

export const ArrowRightIcon = () => <span />;
export const AddIcon = () => <span />;
export const ChevronDownIcon = () => <span />;
export const ChevronUpIcon = () => <span />;
export const CloseIcon = () => <span />;
export const DownloadIcon = () => <span />;
export const EditIcon = () => <span />;
export const LocationIcon = () => <span />;
export const PasswordIcon = () => <span />;
export const ResetIcon = () => <span />;
export const SaveIcon = () => <span />;
export const ToolsIcon = () => <span />;
export const TrashCanIcon = () => <span />;

export const UserHasAccess = ({ children }: { children?: React.ReactNode }) => <>{children}</>;

export const LocationPicker = ({ onChange }: { onChange?: (uuid: string) => void }) => (
  <div>
    <button type="button" role="radio" aria-checked="false" onClick={() => onChange?.('uuid_1')}>
      location_1
    </button>
    <button type="button" role="radio" aria-checked="false" onClick={() => onChange?.('uuid_2')}>
      location_2
    </button>
  </div>
);

export const useLayoutType = vi.fn(() => 'desktop');
export const useFeatureFlag = vi.fn(() => true);
export const usePagination = vi.fn((items: unknown[] = []) => ({ results: items, currentPage: 1, goTo: vi.fn() }));

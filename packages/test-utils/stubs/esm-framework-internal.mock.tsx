import { vi } from 'vitest';

import {
  clearHistory,
  DownloadIcon,
  getExtensionInternalStore,
  TrashCanIcon,
  Type,
  useStore,
} from './esm-framework.mock';

type MockStore<T> = {
  getState: () => T;
  setState: (update: Partial<T> | T | ((prev: T) => T)) => void;
};

type MockAction<T> = (state: T, ...args: any[]) => Partial<T>;
type MockActions<T> = Record<string, MockAction<T>>;

function createMockStore<T>(initialState: T) {
  let state = initialState;
  const subscribers = new Set<(state: T) => void>();

  return {
    getState: vi.fn(() => state),
    setState: vi.fn((update: Partial<T> | T | ((prev: T) => T)) => {
      state =
        typeof update === 'function'
          ? (update as (prev: T) => T)(state)
          : typeof update === 'object' && update !== null
            ? ({ ...state, ...update } as T)
            : state;
      subscribers.forEach((subscriber) => {
        subscriber(state);
      });
    }),
    subscribe: vi.fn((subscriber: (state: T) => void) => {
      subscribers.add(subscriber);
      return () => subscribers.delete(subscriber);
    }),
  };
}

export { clearHistory, DownloadIcon, getExtensionInternalStore, TrashCanIcon, Type, useStore };

export const implementerToolsConfigStore = createMockStore({ config: {} as Record<string, unknown> });
export const temporaryConfigStore = createMockStore({ config: {} as Record<string, unknown> });
export const clearConfigErrors = vi.fn();

export const useStoreWithActions = vi.fn(
  <T extends Record<string, unknown>, A extends MockActions<T>>(store: MockStore<T>, actions: A) => {
    const state = useStore(store) as T;
    const boundActions = Object.fromEntries(
      Object.entries(actions).map(([key, action]) => [
        key,
        (...args: unknown[]) => {
          const typedAction = action as MockAction<T>;
          store.setState((prevState: T) => ({ ...prevState, ...typedAction(prevState, ...args) }));
        },
      ]),
    ) as {
      [K in keyof A]: (...args: A[K] extends (state: T, ...args: infer Args) => any ? Args : never) => void;
    };

    return {
      ...state,
      ...boundActions,
    };
  },
);

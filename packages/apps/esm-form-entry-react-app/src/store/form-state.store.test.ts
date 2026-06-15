import type { FormState } from '../types';

import { getFormState, setFormState } from './form-state.store';

vi.mock('@openmrs/esm-framework', async () => {
  type TestStoreState = Record<string, FormState>;
  type Subscriber = (state: TestStoreState) => void;
  type TestStore = {
    getState: () => TestStoreState;
    setState: (partial: TestStoreState) => void;
    subscribe: (fn: Subscriber) => () => void;
  };

  const stores: Record<string, TestStore> = {};
  return {
    ...(await vi.importActual('@openmrs/esm-framework')),
    createGlobalStore: vi.fn((name, initialState) => {
      let state = { ...initialState } as TestStoreState;
      const subscribers: Array<Subscriber> = [];
      stores[name] = {
        getState: () => state,
        setState: (partial) => {
          state = { ...state, ...partial };
          subscribers.forEach((fn) => {
            fn(state);
          });
        },
        subscribe: (fn) => {
          subscribers.push(fn);
          return () => {
            const idx = subscribers.indexOf(fn);
            if (idx >= 0) subscribers.splice(idx, 1);
          };
        },
      };
      return stores[name];
    }),
    getGlobalStore: vi.fn((name) => stores[name]),
  };
});

describe('form-state.store', () => {
  it('defaults to initial state', () => {
    expect(getFormState('unknown-form')).toBe('initial');
  });

  it('sets and gets form state', () => {
    setFormState('form-1', 'loading');
    expect(getFormState('form-1')).toBe('loading');

    setFormState('form-1', 'ready');
    expect(getFormState('form-1')).toBe('ready');
  });

  it('tracks multiple forms independently', () => {
    setFormState('form-a', 'submitting');
    setFormState('form-b', 'submitted');
    expect(getFormState('form-a')).toBe('submitting');
    expect(getFormState('form-b')).toBe('submitted');
  });
});

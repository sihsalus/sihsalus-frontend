import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { createElement, useEffect } from 'react';

import { type FormSchema } from '../types';
import { useFormJson } from './useFormJson';

const mockTransformers = vi.hoisted(() => vi.fn());
const mockAddResourceBundle = vi.fn();

vi.mock('../api', () => ({
  fetchClobData: vi.fn(),
  fetchOpenMRSForm: vi.fn(),
}));
vi.mock('../registry/registry', () => ({
  getRegisteredFormSchemaTransformers: mockTransformers,
}));
vi.mock('../utils/forms-loader', () => ({
  applyFormIntent: (_intent: string, schema: FormSchema) => schema,
}));

const schemaA = {
  uuid: 'synthetic-form-a',
  name: 'Synthetic form A',
  processor: 'EncounterFormProcessor',
  pages: [],
  referencedForms: [],
} as FormSchema;
const schemaB = {
  ...schemaA,
  uuid: 'synthetic-form-b',
  name: 'Synthetic form B',
};

describe('useFormJson session transitions', () => {
  beforeEach(() => {
    mockTransformers.mockReset().mockResolvedValue([]);
    mockAddResourceBundle.mockReset();
    vi.stubGlobal('i18next', {
      language: 'en',
      addResourceBundle: mockAddResourceBundle,
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('recovers from a failed schema when a different valid form is opened', async () => {
    const { result, rerender } = renderHook(
      ({ schema }: { schema: unknown }) => useFormJson(undefined, schema, undefined, '*'),
      { initialProps: { schema: {} } },
    );
    await waitFor(() => expect(result.current.formError).toBeInstanceOf(Error));

    rerender({ schema: schemaB });

    await waitFor(() => expect(result.current.formJson?.uuid).toBe(schemaB.uuid));
    expect(result.current.formError).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
  });

  it('does not expose form A while form B is still loading', async () => {
    const renders: Array<{ uuid?: string; isLoading: boolean }> = [];
    const { result, rerender } = renderHook(
      ({ schema }) => {
        const state = useFormJson(undefined, schema, undefined, '*');
        renders.push({
          uuid: state.formJson?.uuid,
          isLoading: state.isLoading,
        });
        return state;
      },
      { initialProps: { schema: schemaA } },
    );
    await waitFor(() => expect(result.current.formJson?.uuid).toBe(schemaA.uuid));
    let resolveTransformers: (value: []) => void;
    mockTransformers.mockReturnValueOnce(
      new Promise<[]>((resolve) => {
        resolveTransformers = resolve;
      }),
    );

    const beforeSwitch = renders.length;
    rerender({ schema: schemaB });

    expect(renders[beforeSwitch]).toEqual({ uuid: undefined, isLoading: true });
    expect(result.current.formJson).toBeNull();
    expect(result.current.isLoading).toBe(true);
    await act(async () => {
      resolveTransformers([]);
    });
    await waitFor(() => expect(result.current.formJson?.uuid).toBe(schemaB.uuid));
  });

  it('keeps a late failure from a closed form out of the next session', async () => {
    let rejectTransformers: (reason: Error) => void;
    mockTransformers.mockReturnValueOnce(
      new Promise((_, reject) => {
        rejectTransformers = reject;
      }),
    );
    const { result, rerender } = renderHook(({ schema }) => useFormJson(undefined, schema, undefined, '*'), {
      initialProps: { schema: schemaA },
    });
    rerender({ schema: schemaB });
    await waitFor(() => expect(result.current.formJson?.uuid).toBe(schemaB.uuid));

    await act(async () => {
      rejectTransformers(new Error('Synthetic late failure'));
    });

    expect(result.current.formJson?.uuid).toBe(schemaB.uuid);
    expect(result.current.formError).toBeUndefined();
  });

  it('recovers when the same form succeeds on a later load attempt', async () => {
    mockTransformers.mockRejectedValueOnce(new Error('Synthetic temporary failure'));
    const { result, rerender } = renderHook(({ schema }) => useFormJson(undefined, schema, undefined, '*'), {
      initialProps: { schema: schemaA },
    });
    await waitFor(() => expect(result.current.formError).toBeInstanceOf(Error));

    rerender({ schema: { ...schemaA } });

    await waitFor(() => expect(result.current.formJson?.uuid).toBe(schemaA.uuid));
    expect(result.current.formError).toBeUndefined();
  });

  it('ignores late form A data and translations after form B has loaded', async () => {
    let resolveTransformers: (value: []) => void;
    mockTransformers.mockReturnValueOnce(
      new Promise<[]>((resolve) => {
        resolveTransformers = resolve;
      }),
    );
    const { result, rerender } = renderHook(
      ({ schema }: { schema: FormSchema }) => useFormJson(undefined, schema, undefined, '*'),
      {
        initialProps: {
          schema: {
            ...schemaA,
            translations: { fixtureLabel: 'Synthetic closed form' },
          },
        },
      },
    );
    rerender({ schema: schemaB });
    await waitFor(() => expect(result.current.formJson?.uuid).toBe(schemaB.uuid));

    await act(async () => {
      resolveTransformers([]);
    });

    expect(result.current.formJson?.uuid).toBe(schemaB.uuid);
    expect(mockAddResourceBundle).not.toHaveBeenCalled();
  });

  it('does not install translations after the form unmounts', async () => {
    let resolveTransformers: (value: []) => void;
    mockTransformers.mockReturnValueOnce(
      new Promise<[]>((resolve) => {
        resolveTransformers = resolve;
      }),
    );
    const { unmount } = renderHook(() =>
      useFormJson(undefined, { ...schemaA, translations: { fixtureLabel: 'Synthetic closed form' } }, undefined, '*'),
    );
    unmount();

    await act(async () => {
      resolveTransformers([]);
    });

    expect(mockAddResourceBundle).not.toHaveBeenCalled();
  });

  it('keeps the mounted session for the same UUID and applies the updated schema after loading', async () => {
    const { result, rerender } = renderHook(({ schema }) => useFormJson(undefined, schema, undefined, '*'), {
      initialProps: { schema: schemaA },
    });
    await waitFor(() => expect(result.current.formJson?.uuid).toBe(schemaA.uuid));
    const loadedSchema = result.current.formJson;
    let resolveTransformers: (value: []) => void;
    mockTransformers.mockReturnValueOnce(
      new Promise<[]>((resolve) => {
        resolveTransformers = resolve;
      }),
    );

    rerender({ schema: { ...schemaA, name: 'Synthetic updated schema' } });

    expect(result.current.formJson).toBe(loadedSchema);
    expect(result.current.isLoading).toBe(false);
    await act(async () => {
      resolveTransformers([]);
    });
    await waitFor(() => expect(result.current.formJson?.name).toBe('Synthetic updated schema'));
  });

  it('preserves a mounted dirty child when equivalent schema and prefill objects are copied', async () => {
    const mounted = vi.fn();
    const unmounted = vi.fn();
    function DirtyChild() {
      useEffect(() => {
        mounted();
        return unmounted;
      }, []);
      return createElement('input', { 'aria-label': 'Synthetic answer', defaultValue: '' });
    }
    function Harness({ schema, prefills }: { schema: FormSchema; prefills: Record<string, string> }) {
      const state = useFormJson(undefined, schema, undefined, '*', prefills);
      return state.formJson && !state.isLoading && !state.formError ? createElement(DirtyChild) : null;
    }
    const { rerender } = render(createElement(Harness, { schema: schemaA, prefills: {} }));
    const input = await screen.findByRole('textbox', { name: 'Synthetic answer' });
    fireEvent.change(input, { target: { value: 'Synthetic unsaved answer' } });
    let resolveTransformers: (value: []) => void;
    mockTransformers.mockReturnValueOnce(
      new Promise<[]>((resolve) => {
        resolveTransformers = resolve;
      }),
    );

    rerender(createElement(Harness, { schema: { ...schemaA }, prefills: {} }));

    expect(screen.getByRole('textbox', { name: 'Synthetic answer' })).toBe(input);
    expect(input).toHaveValue('Synthetic unsaved answer');
    await act(async () => {
      resolveTransformers([]);
    });
    expect(screen.getByRole('textbox', { name: 'Synthetic answer' })).toBe(input);
    expect(input).toHaveValue('Synthetic unsaved answer');
    expect(mounted).toHaveBeenCalledTimes(1);
    expect(unmounted).not.toHaveBeenCalled();
  });

  it.each(['encounter', 'intent'])('invalidates the prior session when its %s changes', async (change) => {
    const { result, rerender } = renderHook(
      ({ encounter, intent }) => useFormJson(undefined, schemaA, encounter, intent),
      { initialProps: { encounter: 'synthetic-encounter-a', intent: '*' } },
    );
    await waitFor(() => expect(result.current.formJson?.encounter).toBe('synthetic-encounter-a'));
    let resolveTransformers: (value: []) => void;
    mockTransformers.mockReturnValueOnce(
      new Promise<[]>((resolve) => {
        resolveTransformers = resolve;
      }),
    );

    rerender({
      encounter: change === 'encounter' ? 'synthetic-encounter-b' : 'synthetic-encounter-a',
      intent: change === 'intent' ? 'synthetic-new-intent' : '*',
    });

    expect(result.current.formJson).toBeNull();
    expect(result.current.isLoading).toBe(true);
    await act(async () => {
      resolveTransformers([]);
    });
  });

  it('does not treat two invalid schemas without UUIDs as the same session', async () => {
    const { result, rerender } = renderHook(({ schema }) => useFormJson(undefined, schema, undefined, '*'), {
      initialProps: { schema: { name: 'Synthetic invalid A' } },
    });
    await waitFor(() => expect(result.current.formError).toBeInstanceOf(Error));
    let resolveTransformers: (value: []) => void;
    mockTransformers.mockReturnValueOnce(
      new Promise<[]>((resolve) => {
        resolveTransformers = resolve;
      }),
    );

    rerender({ schema: { name: 'Synthetic invalid B' } });

    expect(result.current.formError).toBeUndefined();
    expect(result.current.isLoading).toBe(true);
    expect(result.current.formJson).toBeNull();
    await act(async () => {
      resolveTransformers([]);
    });
    await waitFor(() => expect(result.current.formError).toBeInstanceOf(Error));
  });

  it('rejects mutually exclusive arguments without loading, then recovers when corrected', async () => {
    const { result, rerender } = renderHook(
      ({ formUuid }: { formUuid: string | undefined }) => useFormJson(formUuid, schemaA, undefined, '*'),
      { initialProps: { formUuid: schemaA.uuid } },
    );
    expect(result.current.formError).toBeInstanceOf(Error);
    expect(result.current.formJson).toBeNull();
    expect(mockTransformers).not.toHaveBeenCalled();

    rerender({ formUuid: undefined });

    await waitFor(() => expect(result.current.formJson?.uuid).toBe(schemaA.uuid));
    expect(result.current.formError).toBeUndefined();
  });

  it('discards an old valid schema and does not expose a subsequent backend error', async () => {
    const { result, rerender } = renderHook(({ schema }) => useFormJson(undefined, schema, undefined, '*'), {
      initialProps: { schema: schemaA },
    });
    await waitFor(() => expect(result.current.formJson?.uuid).toBe(schemaA.uuid));
    mockTransformers.mockRejectedValueOnce(new Error('SYNTHETIC_PRIVATE_BACKEND_DETAIL'));

    rerender({ schema: { ...schemaA } });

    await waitFor(() => expect(result.current.formError).toBeInstanceOf(Error));
    expect(result.current.formJson).toBeNull();
    expect(result.current.formError?.message).toBe('Error loading form JSON');
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('SYNTHETIC_PRIVATE_BACKEND_DETAIL');
  });
});

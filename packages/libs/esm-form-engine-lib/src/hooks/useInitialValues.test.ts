import { renderHook, waitFor } from '@testing-library/react';
import { ControlAdapter } from '../adapters/control-adapter';
import type { FormProcessor } from '../processors/form-processor';
import type { FormProcessorContextProps } from '../types';
import useInitialValues from './useInitialValues';

it('finishes an empty form once instead of keeping its loading indicator indefinitely', async () => {
  const getInitialValues = vi.fn().mockResolvedValue({});
  const processor = { getInitialValues } as unknown as FormProcessor;
  const context = { formFields: [], formFieldAdapters: {} } as FormProcessorContextProps;
  const { result, rerender } = renderHook(() => useInitialValues(processor, false, context));

  await waitFor(() => expect(result.current.isLoadingInitialValues).toBe(false));
  expect(result.current.initialValues).toEqual({});
  rerender();
  expect(getInitialValues).toHaveBeenCalledOnce();
});

it('waits for dependencies and adapters before initializing nonempty fields', async () => {
  const getInitialValues = vi.fn().mockResolvedValue({ sample: 'Existing default' });
  const processor = { getInitialValues } as unknown as FormProcessor;
  const context = {
    formFields: [{ id: 'sample', type: 'control', questionOptions: { rendering: 'text' } }],
    formFieldAdapters: {},
  } as FormProcessorContextProps;
  const { result, rerender } = renderHook(({ loading, context }) => useInitialValues(processor, loading, context), {
    initialProps: { loading: true, context },
  });
  expect(getInitialValues).not.toHaveBeenCalled();
  rerender({ loading: false, context });
  expect(getInitialValues).not.toHaveBeenCalled();
  expect(result.current.isLoadingInitialValues).toBe(true);
  rerender({
    loading: false,
    context: { ...context, formFieldAdapters: { control: ControlAdapter } },
  });
  await waitFor(() => expect(result.current.initialValues.sample).toBe('Existing default'));
  expect(result.current.isLoadingInitialValues).toBe(false);
  expect(getInitialValues).toHaveBeenCalledOnce();
});

it('reports a rejected initialization and stops loading without retrying indefinitely', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const error = new Error('Synthetic initialization failure');
    const getInitialValues = vi.fn().mockRejectedValue(error);
    const processor = { getInitialValues } as unknown as FormProcessor;
    const context = { formFields: [], formFieldAdapters: {} } as FormProcessorContextProps;
    const { result, rerender } = renderHook(() => useInitialValues(processor, false, context));
    await waitFor(() => expect(result.current.error).toBe(error));
    expect(result.current.isLoadingInitialValues).toBe(false);
    rerender();
    expect(getInitialValues).toHaveBeenCalledOnce();
  } finally {
    vi.restoreAllMocks();
  }
});

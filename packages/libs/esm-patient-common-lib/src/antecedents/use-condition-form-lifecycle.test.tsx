import { act, renderHook } from '@testing-library/react';
import { type PropsWithChildren, StrictMode } from 'react';
import { type Condition } from './conditions.types';
import { mapConditionProperties } from './conditions-model';
import { useConditionFormLifecycle } from './use-condition-form-lifecycle';

function originalCondition(patientUuid = 'synthetic-patient'): Condition {
  return mapConditionProperties({
    uuid: 'synthetic-condition',
    patient: { uuid: patientUuid },
    condition: { coded: { uuid: 'synthetic-concept', display: 'Synthetic antecedent' }, nonCoded: null },
    clinicalStatus: 'ACTIVE',
    onsetDate: null,
    endDate: null,
    additionalDetail: null,
    voided: false,
  });
}

function options() {
  return {
    patientUuid: 'synthetic-patient',
    isEditing: false,
    matchingCondition: undefined as Condition | undefined,
    defaultValues: { clinicalStatus: 'active' },
    reset: vi.fn(),
    onStart: vi.fn(),
    onError: vi.fn(),
  };
}

describe('condition form lifecycle', () => {
  it('initializes only a matching loaded record and preserves local edits across revalidation', () => {
    const initial = { ...options(), isEditing: true };
    const { result, rerender } = renderHook(useConditionFormLifecycle, { initialProps: initial });
    expect(initial.reset).not.toHaveBeenCalled();

    rerender({ ...initial, matchingCondition: originalCondition('synthetic-other-patient') });
    expect(initial.reset).not.toHaveBeenCalled();

    const snapshot = originalCondition();
    rerender({ ...initial, matchingCondition: snapshot });
    expect(initial.reset).toHaveBeenCalledExactlyOnceWith(initial.defaultValues);
    expect(result.current.originalCondition).toBe(snapshot);

    const refreshed = mapConditionProperties({ ...snapshot.source, clinicalStatus: 'INACTIVE' });
    rerender({
      ...initial,
      matchingCondition: refreshed,
      defaultValues: { clinicalStatus: 'inactive' },
    });
    expect(initial.reset).toHaveBeenCalledTimes(1);
    expect(result.current.originalCondition).toBe(snapshot);
    expect(result.current.originalCondition?.source.clinicalStatus).toBe('ACTIVE');
  });

  it('blocks simultaneous submissions and permits retry after an unsuccessful submission', async () => {
    const props = options();
    let finish!: (saved: boolean) => void;
    const submit = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          finish = resolve;
        }),
    );
    const { result } = renderHook(() => useConditionFormLifecycle(props));
    result.current.widgetRef.current = { submit };

    let pending!: Promise<void>;
    act(() => {
      pending = result.current.submitCondition();
      void result.current.submitCondition();
    });
    expect(submit).toHaveBeenCalledTimes(1);
    expect(result.current.isSubmittingForm).toBe(true);

    await act(async () => {
      finish(false);
      await pending;
    });
    expect(result.current.isSubmittingForm).toBe(false);
    expect(result.current.isSaved).toBe(false);

    submit.mockResolvedValueOnce(true);
    await act(async () => {
      await result.current.submitCondition();
    });
    await act(async () => {
      await result.current.submitCondition();
    });
    expect(submit).toHaveBeenCalledTimes(2);
    expect(result.current.isSubmittingForm).toBe(false);
    expect(result.current.isSaved).toBe(true);
  });

  it('keeps an uncertain write locked without claiming it was saved or leaving a spinner', async () => {
    const props = options();
    const submit = vi.fn().mockResolvedValue('uncertain');
    const { result } = renderHook(() => useConditionFormLifecycle(props));
    result.current.widgetRef.current = { submit };

    await act(async () => {
      await result.current.submitCondition();
    });
    expect(result.current.isUncertain).toBe(true);
    expect(result.current.isSaved).toBe(false);
    expect(result.current.isSubmittingForm).toBe(false);

    await act(async () => {
      await result.current.submitCondition();
    });
    expect(submit).toHaveBeenCalledTimes(1);
    expect(props.onError).not.toHaveBeenCalled();
  });

  it('reports failure without exposing the thrown error and releases the submission lock', async () => {
    const props = options();
    const submit = vi.fn().mockRejectedValue(new Error('Synthetic transport detail'));
    const { result } = renderHook(() => useConditionFormLifecycle(props));
    result.current.widgetRef.current = { submit };

    await act(async () => {
      await result.current.submitCondition();
    });

    expect(props.onError).toHaveBeenCalledExactlyOnceWith();
    expect(result.current.isSubmittingForm).toBe(false);
  });

  it('does not report a late failure after its patient form has unmounted', async () => {
    const props = options();
    let reject!: (error: Error) => void;
    const submit = vi.fn(
      () =>
        new Promise<boolean>((_resolve, rejectPromise) => {
          reject = rejectPromise;
        }),
    );
    const { result, unmount } = renderHook(() => useConditionFormLifecycle(props));
    result.current.widgetRef.current = { submit };
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.submitCondition();
    });

    unmount();
    await act(async () => {
      reject(new Error('Synthetic late error'));
      await pending;
    });

    expect(props.onError).not.toHaveBeenCalled();
  });

  it('blocks editing a record that is unavailable or belongs to another patient', async () => {
    const props = { ...options(), isEditing: true };
    const submit = vi.fn().mockResolvedValue(true);
    const { result, rerender } = renderHook(useConditionFormLifecycle, { initialProps: props });
    result.current.widgetRef.current = { submit };

    await act(async () => {
      await result.current.submitCondition();
    });
    rerender({ ...props, matchingCondition: originalCondition('synthetic-other-patient') });
    await act(async () => {
      await result.current.submitCondition();
    });

    expect(submit).not.toHaveBeenCalled();
    expect(props.onStart).not.toHaveBeenCalled();
  });

  it('remains usable when StrictMode replays effects', async () => {
    const props = options();
    const submit = vi.fn().mockResolvedValue(false);
    const wrapper = ({ children }: PropsWithChildren) => <StrictMode>{children}</StrictMode>;
    const { result } = renderHook(() => useConditionFormLifecycle(props), { wrapper });
    result.current.widgetRef.current = { submit };

    await act(async () => {
      await result.current.submitCondition();
    });

    expect(submit).toHaveBeenCalledTimes(1);
    expect(result.current.isSubmittingForm).toBe(false);
  });
});

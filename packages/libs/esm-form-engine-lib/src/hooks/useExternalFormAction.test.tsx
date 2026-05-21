import { renderHook } from '@testing-library/react';

import { reportError } from '../utils/error-utils';

import { useExternalFormAction } from './useExternalFormAction';

vi.mock('react-i18next', () => ({
  useTranslation: (): { t: (_key: string, defaultValue: string) => string } => ({
    t: (_key: string, defaultValue: string): string => defaultValue,
  }),
}));

vi.mock('../utils/error-utils', () => ({
  reportError: vi.fn(),
}));

const mockReportError = vi.mocked(reportError);

describe('useExternalFormAction', () => {
  const setIsSubmitting = vi.fn();
  const setIsValidating = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts submission when a matching submit action is dispatched', () => {
    renderHook(() =>
      useExternalFormAction({
        patientUuid: 'patient-uuid',
        formUuid: 'form-uuid',
        setIsSubmitting,
        setIsValidating,
      }),
    );

    window.dispatchEvent(
      new CustomEvent('ampath-form-action', {
        detail: {
          formUuid: 'form-uuid',
          patientUuid: 'patient-uuid',
          action: 'onSubmit',
        },
      }),
    );

    expect(setIsSubmitting).toHaveBeenCalledWith(true);
    expect(setIsValidating).not.toHaveBeenCalled();
  });

  it('reports an error when the event detail payload is missing', () => {
    renderHook(() =>
      useExternalFormAction({
        patientUuid: 'patient-uuid',
        formUuid: 'form-uuid',
        setIsSubmitting,
        setIsValidating,
      }),
    );

    window.dispatchEvent(new CustomEvent('ampath-form-action'));

    expect(mockReportError).toHaveBeenCalledTimes(1);
    const [error, title] = mockReportError.mock.calls[0];
    expect(error).toEqual(new Error('The form action event is missing detail payload.'));
    expect(title).toBe('Form action failed');
    expect(setIsSubmitting).not.toHaveBeenCalled();
    expect(setIsValidating).not.toHaveBeenCalled();
  });
});

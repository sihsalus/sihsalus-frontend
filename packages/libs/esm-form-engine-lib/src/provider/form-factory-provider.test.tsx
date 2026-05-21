import { render } from '@testing-library/react';
import React, { useEffect } from 'react';

import { FormFactoryProvider, useFormFactory } from './form-factory-provider';

vi.mock('react-i18next', () => ({
  useTranslation: (): { t: (_key: string, defaultValue: string) => string } => ({
    t: (_key: string, defaultValue: string): string => defaultValue,
  }),
}));

vi.mock('@openmrs/esm-framework', () => ({
  showSnackbar: vi.fn(),
  useLayoutType: vi.fn(() => 'desktop'),
}));

vi.mock('../hooks/useExternalFormAction', () => ({
  useExternalFormAction: vi.fn(),
}));

vi.mock('../hooks/usePostSubmissionActions', () => ({
  usePostSubmissionActions: vi.fn(() => null),
}));

vi.mock('./form-factory-helper', () => ({
  processPostSubmissionActions: vi.fn(),
  validateForm: vi.fn(() => true),
}));

type RegisteredFormProps = {
  processSubmission: vi.Mock;
};

const RegisteredForm = ({ processSubmission }: RegisteredFormProps): React.JSX.Element => {
  const { registerForm } = useFormFactory();

  useEffect(() => {
    registerForm('root-form', false, {
      processor: {
        processSubmission,
      },
    } as never);
  }, [processSubmission, registerForm]);

  return null;
};

const baseProps = {
  patient: { id: 'patient-uuid' } as fhir.Patient,
  patientUUID: 'patient-uuid',
  sessionMode: 'enter' as const,
  sessionDate: new Date('2024-01-01T00:00:00.000Z'),
  formJson: { uuid: 'form-uuid', pages: [] } as never,
  workspaceLayout: 'maximized' as const,
  location: { uuid: 'location-uuid' } as never,
  provider: { uuid: 'provider-uuid' } as never,
  visit: { uuid: 'visit-uuid' } as never,
  isFormExpanded: true,
  hideFormCollapseToggle: vi.fn(),
  setIsFormDirty: vi.fn(),
};

describe('FormFactoryProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not abort or restart an active submission when rerendered', (): void => {
    const controllers: Array<AbortController> = [];
    const processSubmission = vi.fn((_formContext: unknown, abortController: AbortController): Promise<never> => {
      controllers.push(abortController);
      return new Promise(() => {});
    });

    const initialSubmitHandler = vi.fn();
    const nextSubmitHandler = vi.fn();
    const setIsSubmitting = vi.fn();

    const { rerender, unmount } = render(
      <FormFactoryProvider
        {...baseProps}
        formSubmissionProps={{
          isSubmitting: true,
          setIsSubmitting,
          onSubmit: initialSubmitHandler,
          onError: vi.fn(),
          handleClose: vi.fn(),
        }}
      >
        <RegisteredForm processSubmission={processSubmission} />
      </FormFactoryProvider>,
    );

    expect(processSubmission).toHaveBeenCalledTimes(1);
    expect(controllers).toHaveLength(1);
    expect(controllers[0].signal.aborted).toBe(false);

    rerender(
      <FormFactoryProvider
        {...baseProps}
        formSubmissionProps={{
          isSubmitting: true,
          setIsSubmitting,
          onSubmit: nextSubmitHandler,
          onError: vi.fn(),
          handleClose: vi.fn(),
        }}
      >
        <RegisteredForm processSubmission={processSubmission} />
      </FormFactoryProvider>,
    );

    expect(processSubmission).toHaveBeenCalledTimes(1);
    expect(controllers[0].signal.aborted).toBe(false);

    unmount();

    expect(controllers[0].signal.aborted).toBe(true);
  });
});

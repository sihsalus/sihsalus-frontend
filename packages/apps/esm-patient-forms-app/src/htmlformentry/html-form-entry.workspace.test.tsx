import { usePatient, Workspace2 } from '@openmrs/esm-framework';
import { useVisitOrOfflineVisit } from '@openmrs/esm-patient-common-lib';
import { render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';

import { useFormAccess } from '../hooks/use-form-access';
import HtmlFormEntry from './html-form-entry.workspace';

const mockUseFormAccess = vi.mocked(useFormAccess);
const mockUsePatient = vi.mocked(usePatient);
const mockUseVisitOrOfflineVisit = vi.mocked(useVisitOrOfflineVisit);

vi.mock('../hooks/use-form-access', () => ({ useFormAccess: vi.fn() }));
vi.mock('./html-form-entry-wrapper.component', () => ({
  default: ({ src }: { src: string }) => <div data-testid="html-form-entry" data-src={src} />,
}));
vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  usePatient: vi.fn(),
  Workspace2: vi.fn(({ children }) => <div>{children}</div>),
}));
vi.mock('@openmrs/esm-patient-common-lib', async () => ({
  ...(await vi.importActual('@openmrs/esm-patient-common-lib')),
  useVisitOrOfflineVisit: vi.fn(),
}));

const htmlForm = {
  formUuid: 'form-uuid',
  formName: 'Legacy HTML form',
  formUiResource: 'legacy-resource.xml',
  formUiPage: 'enterHtmlFormWithStandardUi' as const,
  formEditUiPage: 'editHtmlFormWithStandardUi' as const,
};

const props = {
  closeWorkspace: vi.fn(),
  groupProps: { patientUuid: 'patient-uuid' },
  workspaceProps: { formInfo: { htmlForm, visitUuid: 'visit-uuid' } },
} as unknown as ComponentProps<typeof HtmlFormEntry>;

describe('HtmlFormEntry workspace access', () => {
  beforeEach(() => {
    mockUsePatient.mockReturnValue({ patient: { id: 'patient-uuid' } } as ReturnType<typeof usePatient>);
    mockUseVisitOrOfflineVisit.mockReturnValue({ currentVisit: null } as ReturnType<typeof useVisitOrOfflineVisit>);
    vi.mocked(Workspace2).mockImplementation(({ children }) => <div>{children}</div>);
  });

  it('does not mount the iframe when the form privilege is denied', () => {
    mockUseFormAccess.mockReturnValue({
      canEdit: false,
      canView: false,
      error: undefined,
      form: undefined,
      isLoading: false,
    });

    render(<HtmlFormEntry {...props} />);

    expect(screen.getByText('Clinical form unavailable')).toBeInTheDocument();
    expect(screen.queryByTestId('html-form-entry')).not.toBeInTheDocument();
    expect(mockUseFormAccess).toHaveBeenCalledWith('form-uuid');
  });

  it('mounts the iframe only after the form privilege is authorized', () => {
    mockUseFormAccess.mockReturnValue({
      canEdit: true,
      canView: true,
      error: undefined,
      form: { uuid: 'form-uuid' } as never,
      isLoading: false,
    });

    render(<HtmlFormEntry {...props} />);

    expect(screen.getByTestId('html-form-entry')).toHaveAttribute(
      'data-src',
      expect.stringContaining('patientId=patient-uuid'),
    );
  });

  it('does not mount an existing HTML encounter without its view privilege', () => {
    mockUseFormAccess.mockReturnValue({
      canEdit: true,
      canView: false,
      error: undefined,
      form: { uuid: 'form-uuid' } as never,
      isLoading: false,
    });
    const editProps = {
      ...props,
      workspaceProps: {
        formInfo: { htmlForm, visitUuid: 'visit-uuid', encounterUuid: 'restricted-encounter-uuid' },
      },
    } as unknown as ComponentProps<typeof HtmlFormEntry>;

    render(<HtmlFormEntry {...editProps} />);

    expect(screen.getByText('Clinical form unavailable')).toBeInTheDocument();
    expect(screen.queryByTestId('html-form-entry')).not.toBeInTheDocument();
  });
});

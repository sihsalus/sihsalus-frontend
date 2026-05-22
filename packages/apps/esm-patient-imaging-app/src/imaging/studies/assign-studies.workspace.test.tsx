import { type CloseWorkspaceOptions, showSnackbar, useLayoutType } from '@openmrs/esm-framework';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import * as api from '../../api';
import { type DicomStudy } from '../../types';
import AssignStudiesWorkspace from './assign-studies.workspace';

type ErrorStateProps = { error?: { message?: string }; headerTitle?: string };
type NameOnlyProps = { name: string };
type ChildrenOnlyProps = { children: React.ReactNode };
type StudiesTableDataProps = { data?: { studies?: Array<unknown> } | null };
type EmptyStateProps = { displayText?: string; headerTitle?: string };
type AssignStudiesTableMockProps = {
  assignStudyFunction: (study: DicomStudy, isAssign: boolean) => Promise<void>;
};

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  useLayoutType: vi.fn(() => 'desktop'),
  launchWorkspace: vi.fn(),
  showSnackbar: vi.fn(),
  usePagination: vi.fn((items, pageSize) => ({
    results: items?.slice(0, pageSize) || [],
    goTo: vi.fn(),
    currentPage: 1,
  })),
  ErrorState: ({ error, headerTitle }: ErrorStateProps) => (
    <div role="alert">
      {headerTitle}: {error?.message}
    </div>
  ),
  ExtensionSlot: ({ name }: NameOnlyProps) => <div data-testid={`extension-slot-${name}`} />,
  ResponsiveWrapper: ({ children }: ChildrenOnlyProps) => <div data-testid="responsive-wrapper">{children}</div>,
  AddIcon: () => <span>AddIcon</span>,
}));

vi.mock('../../api');

let capturedAssignStudyFunction: ((study: DicomStudy, isAssign: boolean) => Promise<void>) | undefined;

vi.mock('../components/assign-studies-table.component', () => ({
  default: (props: AssignStudiesTableMockProps & StudiesTableDataProps) => {
    capturedAssignStudyFunction = props.assignStudyFunction;
    return <div data-testid="assign-studies-table">Studies: {props.data?.studies?.length}</div>;
  },
}));

vi.mock('@openmrs/esm-patient-common-lib', () => ({
  EmptyState: ({ displayText, headerTitle }: EmptyStateProps) => (
    <div>
      {headerTitle}: {displayText}
    </div>
  ),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, defaultValue: string) => defaultValue,
  }),
}));

describe('AssignStudiesWorkspace', () => {
  const patientUuid = 'patientUID-123';
  const configuration = { id: 1, orthancBaseUrl: 'http://orthanc.local' };

  const mockStudyData = {
    id: 1,
    studyInstanceUID: 'studyUID1',
    orthancStudyUID: 'orthancUID1',
    mrsPatientUuid: patientUuid,
    orthancConfiguration: {
      id: 1,
      orthancBaseUrl: 'http://localhost:8042',
    },
    patientName: 'John Doe',
    studyDate: '2025-04-07',
    studyDescription: 'CT Chest without contrast',
    gender: 'Male',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useLayoutType as vi.Mock).mockReturnValue('small-desktop');
    (api.useStudiesByPatient as vi.Mock).mockReturnValue({
      mutate: vi.fn(),
    });

    (api.useStudiesByConfig as vi.Mock).mockReturnValue({
      data: { studies: [mockStudyData] },
      error: null,
      isLoading: false,
      isValidating: false,
    });
  });

  it('renders loading state when studies are loading', () => {
    (api.useStudiesByConfig as vi.Mock).mockReturnValue({
      data: null,
      error: null,
      isLoading: true,
      isValidating: false,
    });

    render(
      <AssignStudiesWorkspace
        patientUuid={patientUuid}
        configuration={configuration}
        closeWorkspace={vi.fn()}
        promptBeforeClosing={function (_testFcn: () => boolean): void {
          throw new Error('Function not implemented.');
        }}
        closeWorkspaceWithSavedChanges={function (_closeWorkspaceOptions?: CloseWorkspaceOptions): void {
          throw new Error('Function not implemented.');
        }}
        setTitle={function (_title: string, _titleNode?: React.ReactNode): void {
          throw new Error('Function not implemented.');
        }}
      />,
    );

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders error state when API returns error', () => {
    (api.useStudiesByConfig as vi.Mock).mockReturnValue({
      data: null,
      error: new Error('API error'),
      isLoading: false,
      isValidating: false,
    });

    render(
      <AssignStudiesWorkspace
        patientUuid={patientUuid}
        configuration={configuration}
        closeWorkspace={vi.fn()}
        promptBeforeClosing={function (_testFcn: () => boolean): void {
          throw new Error('Function not implemented.');
        }}
        closeWorkspaceWithSavedChanges={function (_closeWorkspaceOptions?: CloseWorkspaceOptions): void {
          throw new Error('Function not implemented.');
        }}
        setTitle={function (_title: string, _titleNode?: React.ReactNode): void {
          throw new Error('Function not implemented.');
        }}
      />,
    );
    expect(screen.getByText(/API error/i)).toBeInTheDocument();
  });

  it('renders AssignStudiesTable when studies are available', () => {
    render(
      <AssignStudiesWorkspace
        patientUuid={patientUuid}
        configuration={configuration}
        closeWorkspace={vi.fn()}
        promptBeforeClosing={() => true}
        closeWorkspaceWithSavedChanges={() => {}}
        setTitle={() => {}}
      />,
    );

    expect(screen.getByTestId('assign-studies-table')).toBeInTheDocument();
  });

  it('calls closeworkspace when close button is clicked', () => {
    const closeMock = vi.fn();

    render(
      <AssignStudiesWorkspace
        patientUuid={patientUuid}
        configuration={configuration}
        closeWorkspace={closeMock}
        promptBeforeClosing={() => true}
        closeWorkspaceWithSavedChanges={() => {}}
        setTitle={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(closeMock).toHaveBeenCalled();
  });

  it('calls showSnackbar when assignStudyFunction succeeds', async () => {
    const mockMutate = vi.fn();
    (api.useStudiesByPatient as vi.Mock).mockReturnValue({ mutate: mockMutate });
    (api.assignStudy as vi.Mock).mockResolvedValue({});

    render(
      <AssignStudiesWorkspace
        patientUuid={patientUuid}
        configuration={configuration}
        promptBeforeClosing={() => true}
        closeWorkspaceWithSavedChanges={() => {}}
        setTitle={() => {}}
        closeWorkspace={vi.fn()}
      />,
    );

    await waitFor(() => expect(capturedAssignStudyFunction).toBeDefined());

    await capturedAssignStudyFunction(mockStudyData, true);

    expect(api.assignStudy).toHaveBeenCalledWith(mockStudyData.id, patientUuid, true, expect.any(AbortController));
    expect(mockMutate).toHaveBeenCalled();
    expect(showSnackbar).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' }));
  });
});

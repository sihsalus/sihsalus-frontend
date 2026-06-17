import {
  type FetchResponse,
  getDefaultsFromConfigSchema,
  showSnackbar,
  useConfig,
  useSession,
} from '@openmrs/esm-framework';
import { type PatientWorkspace2DefinitionProps } from '@openmrs/esm-patient-common-lib';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockCareProgramsResponse, mockEnrolledProgramsResponse, mockPatient, mockSession } from 'test-utils';
import { type ConfigObject, configSchema } from '../config-schema';
import { mutatePatientProgramEnrollments } from './program-enrollment-cache';
import {
  createProgramEnrollment,
  updateProgramEnrollment,
  useAvailablePrograms,
  useEnrollments,
} from './programs.resource';
import ProgramsForm, { type ProgramsFormProps } from './programs-form.workspace';

const mockUseAvailablePrograms = vi.mocked(useAvailablePrograms);
const mockUseEnrollments = vi.mocked(useEnrollments);
const mockCreateProgramEnrollment = vi.mocked(createProgramEnrollment);
const mockUpdateProgramEnrollment = vi.mocked(updateProgramEnrollment);
const mockMutatePatientProgramEnrollments = vi.mocked(mutatePatientProgramEnrollments);
const mockShowSnackbar = vi.mocked(showSnackbar);
const mockUseSession = vi.mocked(useSession);
const mockCloseWorkspace = vi.fn();
const mockUseConfig = vi.mocked(useConfig<ConfigObject>);

const testProps: PatientWorkspace2DefinitionProps<ProgramsFormProps, {}> = {
  closeWorkspace: mockCloseWorkspace,
  groupProps: {
    patientUuid: mockPatient.id,
    patient: mockPatient as unknown as fhir.Patient,
    visitContext: null,
    mutateVisitContext: null,
  },
  workspaceName: '',
  launchChildWorkspace: vi.fn(),
  workspaceProps: {},
  windowProps: {},
  windowName: '',
  isRootWorkspace: false,
  showActionMenu: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUseSession.mockReturnValue(mockSession.data);
  mockUseConfig.mockReturnValue(getDefaultsFromConfigSchema(configSchema));
  mockUseAvailablePrograms.mockReturnValue({
    data: mockCareProgramsResponse,
    eligiblePrograms: mockCareProgramsResponse,
    error: null,
    isLoading: false,
  });
  mockUseEnrollments.mockReturnValue({
    data: mockEnrolledProgramsResponse,
    error: null,
    isLoading: false,
    isValidating: false,
    activeEnrollments: [],
    mutateEnrollments: vi.fn(),
  });
  mockCreateProgramEnrollment.mockResolvedValue({
    status: 201,
    statusText: 'Created',
  } as unknown as FetchResponse);
});

vi.mock('./programs.resource', () => ({
  createProgramEnrollment: vi.fn(),
  updateProgramEnrollment: vi.fn(),
  useAvailablePrograms: vi.fn(),
  useEnrollments: vi.fn(),
  findLastState: vi.fn(),
}));

vi.mock('./program-enrollment-cache', () => ({
  mutatePatientProgramEnrollments: vi.fn(),
}));

describe('ProgramsForm', () => {
  it('renders a success toast notification upon successfully recording a program enrollment', async () => {
    const user = userEvent.setup();

    const oncologyScreeningProgramUuid = '11b129ca-a5e7-4025-84bf-b92a173e20de';
    const sessionLocation = mockSession.data.sessionLocation;

    renderProgramsForm();

    const programNameInput = screen.getByRole('combobox', {
      name: /program name/i,
    });
    const enrollmentDateInput = screen.getByRole('textbox', {
      name: /date enrolled/i,
    });
    const enrollButton = screen.getByRole('button', {
      name: /save and close/i,
    });

    await user.click(enrollButton);
    expect(screen.getByText(/program is required/i)).toBeInTheDocument();

    fireEvent.change(enrollmentDateInput, { target: { value: '2020-05-05' } });
    await user.selectOptions(programNameInput, [oncologyScreeningProgramUuid]);
    expect(screen.getByDisplayValue(sessionLocation.display)).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();

    await user.click(enrollButton);

    expect(mockCreateProgramEnrollment).toHaveBeenCalledTimes(1);
    expect(mockCreateProgramEnrollment).toHaveBeenCalledWith(
      expect.objectContaining({
        dateCompleted: null,
        location: sessionLocation.uuid,
        patient: mockPatient.id,
        program: oncologyScreeningProgramUuid,
        states: [],
      }),
      expect.any(AbortController),
    );
    expect(mockCreateProgramEnrollment.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        dateEnrolled: expect.stringMatching(/^2020-05-05T/),
      }),
    );
    expect(mockMutatePatientProgramEnrollments).toHaveBeenCalledWith(mockPatient.id);

    expect(mockCloseWorkspace).toHaveBeenCalledTimes(1);
    expect(mockShowSnackbar).toHaveBeenCalledTimes(1);
    expect(mockShowSnackbar).toHaveBeenCalledWith({
      subtitle: 'It is now visible in the Programs table',
      kind: 'success',
      title: 'Program enrollment saved',
    });
  });

  it('updates a program enrollment', async () => {
    const user = userEvent.setup();

    renderProgramsForm(mockEnrolledProgramsResponse[0].uuid);

    const enrollButton = screen.getByRole('button', {
      name: /save and close/i,
    });

    const completionDateInput = screen.getByRole('textbox', {
      name: /date completed/i,
    });

    mockUpdateProgramEnrollment.mockResolvedValue({
      status: 200,
      statusText: 'OK',
    } as unknown as FetchResponse);

    await user.click(completionDateInput);
    await user.paste('2020-05-05');
    await user.tab();
    await user.click(enrollButton);

    expect(mockUpdateProgramEnrollment).toHaveBeenCalledTimes(1);
    expect(mockUpdateProgramEnrollment).toHaveBeenCalledWith(
      mockEnrolledProgramsResponse[0].uuid,
      expect.objectContaining({
        location: mockEnrolledProgramsResponse[0].location.uuid,
        patient: mockPatient.id,
        program: mockEnrolledProgramsResponse[0].program.uuid,
        states: [],
      }),
      expect.any(AbortController),
    );
    expect(mockUpdateProgramEnrollment.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        dateCompleted: expect.stringMatching(/^2020-05-05T/),
        dateEnrolled: expect.stringMatching(/^2020-01-1[5-6]T/),
      }),
    );
    expect(mockMutatePatientProgramEnrollments).toHaveBeenCalledWith(mockPatient.id);

    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        subtitle: 'Changes to the program are now visible in the Programs table',
        kind: 'success',
        title: 'Program enrollment updated',
      }),
    );
  });

  it('preserves the existing enrollment location when editing', async () => {
    const user = userEvent.setup();

    renderProgramsForm(mockEnrolledProgramsResponse[0].uuid);

    const enrollButton = screen.getByRole('button', {
      name: /save and close/i,
    });

    mockUpdateProgramEnrollment.mockResolvedValue({
      status: 200,
      statusText: 'OK',
    } as unknown as FetchResponse);

    expect(screen.getByDisplayValue(mockEnrolledProgramsResponse[0].location.display)).toBeInTheDocument();
    expect(screen.queryByDisplayValue(mockSession.data.sessionLocation.display)).not.toBeInTheDocument();

    await user.click(enrollButton);

    expect(mockUpdateProgramEnrollment).toHaveBeenCalledWith(
      mockEnrolledProgramsResponse[0].uuid,
      expect.objectContaining({
        location: mockEnrolledProgramsResponse[0].location.uuid,
      }),
      expect.any(AbortController),
    );
  });

  it('renders the programs status field if the config property is set to true', async () => {
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(configSchema),
      showProgramStatusField: true,
    });

    renderProgramsForm();

    expect(screen.getByLabelText(/program status/i)).toBeInTheDocument();
  });

  it('shows a clear disabled state when no configured program is eligible for the patient', async () => {
    mockUseAvailablePrograms.mockReturnValue({
      data: mockCareProgramsResponse,
      eligiblePrograms: [],
      error: null,
      isLoading: false,
    });

    renderProgramsForm();

    expect(screen.getByText(/no eligible programs available/i)).toBeInTheDocument();
    expect(screen.getByText(/there are no more programs left to enroll this patient in/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save and close/i })).toBeDisabled();
  });
});

function renderProgramsForm(programEnrollmentUuidToEdit?: string) {
  const props = {
    ...testProps,
    workspaceProps: { programEnrollmentId: programEnrollmentUuidToEdit },
  };
  render(<ProgramsForm {...props} />);
}

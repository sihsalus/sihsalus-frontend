import {
  getDefaultsFromConfigSchema,
  showSnackbar,
  useConfig,
  userHasAccess,
  useSession,
} from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { emrConfigurationMock, mockInpatientRequestAlice, mockPatientAlice } from '__mocks__';
import { configSchema, type WardConfigObject } from '../../config-schema';
import useEmrConfiguration from '../../hooks/useEmrConfiguration';
import { type WardPatient, type WardPatientWorkspaceDefinition } from '../../types';
import { createPatientNote, usePatientNotes } from './notes.resource';
import WardPatientNotesWorkspace from './notes.workspace';

const mockWardPatientAlice: WardPatient = {
  visit: mockInpatientRequestAlice.visit,
  patient: mockPatientAlice,
  bed: null,
  inpatientAdmission: null,
  inpatientRequest: mockInpatientRequestAlice,
};

const testProps: WardPatientWorkspaceDefinition = {
  groupProps: {
    wardPatient: mockWardPatientAlice,
  },
  closeWorkspace: vi.fn(),
  launchChildWorkspace: vi.fn(),
  workspaceProps: undefined,
  windowProps: undefined,
  workspaceName: '',
  windowName: '',
  isRootWorkspace: false,
  showActionMenu: false,
};

const mockCreatePatientNote = createPatientNote as vi.Mock;
const mockedShowSnackbar = vi.mocked(showSnackbar);

vi.mock('./notes.resource', () => ({
  createPatientNote: vi.fn(),
  usePatientNotes: vi.fn(),
}));

vi.mock('../../hooks/useEmrConfiguration', () => ({ default: vi.fn() }));

const mockedUseEmrConfiguration = vi.mocked(useEmrConfiguration);
const mockedUsePatientNotes = vi.mocked(usePatientNotes);
const mockUseConfig = vi.mocked(useConfig<WardConfigObject>);
const mockUseSession = vi.mocked(useSession);
const mockUserHasAccess = vi.mocked(userHasAccess);

mockedUseEmrConfiguration.mockReturnValue({
  emrConfiguration: emrConfigurationMock,
  mutateEmrConfiguration: vi.fn(),
  isLoadingEmrConfiguration: false,
  errorFetchingEmrConfiguration: null,
});

describe('<WardPatientNotesWorkspace>', () => {
  mockUseConfig.mockReturnValue(getDefaultsFromConfigSchema<WardConfigObject>(configSchema));
  mockedUsePatientNotes.mockReturnValue({
    patientNotes: [],
    errorFetchingPatientNotes: undefined,
    isLoadingPatientNotes: false,
    mutatePatientNotes: vi.fn(),
  });
  mockUseSession.mockReturnValue({
    user: { uuid: 'user-1' },
    currentProvider: { uuid: 'provider-1' },
    sessionLocation: { uuid: 'location-1' },
  } as ReturnType<typeof useSession>);
  mockUserHasAccess.mockReturnValue(true);

  test('renders the visit notes form with all the relevant fields and values', () => {
    renderWardPatientNotesForm();

    expect(screen.getByRole('textbox', { name: /Write your notes/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save/i })).toBeInTheDocument();
  });

  test('renders a success snackbar upon successfully recording a visit note', async () => {
    const user = userEvent.setup();
    const successPayload = {
      encounterProviders: expect.arrayContaining([
        {
          encounterRole: emrConfigurationMock?.clinicianEncounterRole?.uuid,
          provider: 'provider-1',
        },
      ]),
      encounterType: emrConfigurationMock?.inpatientNoteEncounterType?.uuid,
      location: 'location-1',
      obs: expect.arrayContaining([
        {
          concept: {
            display: '',
            uuid: '162169AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
          },
          value: 'Sample clinical note',
        },
      ]),
      patient: mockPatientAlice.uuid,
      visit: mockWardPatientAlice.visit.uuid,
    };

    mockCreatePatientNote.mockResolvedValue({
      status: 201,
      body: 'Condition created',
    });

    renderWardPatientNotesForm();

    const note = screen.getByRole('textbox', { name: /Write your notes/i });
    await user.clear(note);
    await user.type(note, 'Sample clinical note');
    expect(note).toHaveValue('Sample clinical note');

    const submitButton = screen.getByRole('button', { name: /Save/i });
    await user.click(submitButton);

    expect(mockCreatePatientNote).toHaveBeenCalledTimes(1);
    expect(mockCreatePatientNote).toHaveBeenCalledWith(
      expect.objectContaining(successPayload),
      expect.any(AbortController),
    );
  });

  test('renders an error snackbar if there was a problem recording a visit note', async () => {
    const user = userEvent.setup();
    const error = {
      message: 'Internal Server Error',
      response: {
        status: 500,
        statusText: 'Internal Server Error',
      },
    };

    mockCreatePatientNote.mockRejectedValueOnce(error);
    renderWardPatientNotesForm();

    const note = screen.getByRole('textbox', { name: /Write your notes/i });
    await user.clear(note);
    await user.type(note, 'Sample clinical note');
    expect(note).toHaveValue('Sample clinical note');

    const submitButton = screen.getByRole('button', { name: /Save/i });

    await user.click(submitButton);

    expect(mockedShowSnackbar).toHaveBeenCalledWith({
      isLowContrast: false,
      kind: 'error',
      subtitle: 'Internal Server Error',
      title: 'Error saving patient note',
    });
  });
});

function renderWardPatientNotesForm() {
  render(<WardPatientNotesWorkspace {...testProps} />);
}

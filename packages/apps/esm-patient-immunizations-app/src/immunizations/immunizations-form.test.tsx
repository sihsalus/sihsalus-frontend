import {
  getDefaultsFromConfigSchema,
  showSnackbar,
  toDateObjectStrict,
  toOmrsIsoString,
  useConfig,
  useSession,
} from '@openmrs/esm-framework';
import { type PatientWorkspace2DefinitionProps } from '@openmrs/esm-patient-common-lib';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import dayjs from 'dayjs';
import { mockCurrentVisit, mockFhirPatient, mockPatient, mockSessionDataResponse } from 'test-utils';
import type { Mock } from 'vitest';
import { configSchema, type ImmunizationConfigObject } from '../config-schema';
import { useImmunizations } from '../hooks/useImmunizations';
import { resolveAmpathImmunizationForm } from './ampath-form-immunization-config';
import { FHIR_NEXT_DOSE_DATE_EXTENSION_URL } from './immunization-mapper';
import {
  getImmunizationSaveErrorDetails,
  savePatientImmunization,
  savePatientImmunizationViaAmpathForm,
} from './immunizations.resource';
import ImmunizationsForm from './immunizations-form.workspace';
import { immunizationFormSub } from './utils';

const mockCloseWorkspace = vi.fn();
const mockGetImmunizationSaveErrorDetails = getImmunizationSaveErrorDetails as Mock;
const mockSavePatientImmunization = savePatientImmunization as Mock;
const mockSavePatientImmunizationViaAmpathForm = savePatientImmunizationViaAmpathForm as Mock;
const mockMutate = vi.fn();
const mockUseConfig = vi.mocked<() => ImmunizationConfigObject>(useConfig);
const mockUseSession = vi.mocked(useSession);
const mockToOmrsIsoString = vi.mocked(toOmrsIsoString);
const mockToDateObjectStrict = vi.mocked(toDateObjectStrict);
const mockResolveAmpathImmunizationForm = vi.mocked(resolveAmpathImmunizationForm);
const defaultImmunizationConfig = getDefaultsFromConfigSchema(configSchema) as ImmunizationConfigObject;

vi.mock('../hooks/useImmunizationsConceptSet', () => ({
  useImmunizationsConceptSet: vi.fn(() => ({
    immunizationsConceptSet: {
      uuid: '984AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      display: 'Immunizations',
      answers: [
        {
          uuid: '886AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
          display: 'Bacillus Calmette–Guérin vaccine',
        },
        {
          uuid: '783AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
          display: 'Polio vaccination, oral',
        },
        {
          uuid: '781AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
          display: 'Diphtheria tetanus and pertussis vaccination',
        },
        {
          uuid: '782AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
          display: 'Hepatitis B vaccination',
        },
        {
          uuid: '5261AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
          display: 'Hemophilus influenza B vaccine',
        },
      ],
    },
    isLoading: false,
  })),
}));

vi.mock('../hooks/useImmunizations', () => ({
  useImmunizations: vi.fn(() => ({
    data: [],
    isLoading: false,
    mutate: mockMutate,
  })),
}));

vi.mock('./ampath-form-immunization-config', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./ampath-form-immunization-config')>()),
  resolveAmpathImmunizationForm: vi.fn(),
}));

vi.mock('./immunizations.resource', () => ({
  getImmunizationSaveErrorDetails: vi.fn(() => ({ type: 'unknown' })),
  savePatientImmunization: vi.fn(),
  savePatientImmunizationViaAmpathForm: vi.fn(),
}));

const testProps: PatientWorkspace2DefinitionProps<Record<string, never>, Record<string, never>> = {
  closeWorkspace: mockCloseWorkspace,
  groupProps: {
    patientUuid: mockPatient.uuid,
    patient: { ...mockFhirPatient, id: mockPatient.uuid },
    visitContext: mockCurrentVisit,
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

mockUseSession.mockReturnValue(mockSessionDataResponse.data);

describe('Immunizations Form', () => {
  const isoFormat = 'YYYY-MM-DDTHH:mm:ss.SSSZZ';
  const mockVaccinationDate = new Date('2024-01-03');
  const toStoredDateTime = (calendarDate: string) => dayjs(calendarDate).startOf('day').toDate().toISOString();
  const toDisplayedDate = (calendarDate: string) => dayjs(calendarDate).format('DD/MM/YYYY');

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue(mockSessionDataResponse.data);
    vi.mocked(useImmunizations).mockReturnValue({
      data: [],
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: mockMutate,
    });
    mockUseConfig.mockReturnValue(createTestImmunizationConfig({ ampathEnabled: false }));
    mockGetImmunizationSaveErrorDetails.mockReturnValue({ type: 'unknown' });
    mockSavePatientImmunizationViaAmpathForm.mockResolvedValue({});
    mockResolveAmpathImmunizationForm.mockResolvedValue({
      uuid: '06b94846-f1db-3851-8448-2a97dba81478',
      name: 'INMU-001-REGISTRO DE VACUNACIÓN',
      version: '1.1.0',
      published: true,
      retired: false,
      resources: [],
    });
    mockToOmrsIsoString.mockReturnValue(mockVaccinationDate.toISOString());
    mockToDateObjectStrict.mockImplementation((dateString) => dayjs(dateString, isoFormat).toDate());
  });

  it('marks the required inputs without marking optional batch details or dose', async () => {
    render(<ImmunizationsForm {...testProps} />);
    expect(await screen.findByText('Vaccination date *')).toBeVisible();
    expect(screen.getByText('Immunization *')).toBeVisible();
    expect(screen.getByText('Estado de aplicación *')).toBeVisible();
    expect(screen.getByText('Contexto MINSA *')).toBeVisible();
    expect(screen.getByText('Fields marked with * are required.')).toBeVisible();
    expect(screen.getByLabelText(/Manufacturer/i)).not.toHaveAttribute('required');
    expect(screen.getByLabelText(/Lot Number/i)).not.toHaveAttribute('required');
    await selectOption(screen.getByRole('combobox', { name: /Immunization/i }), 'Hepatitis B vaccination');
    expect(screen.queryByText('Dose number within series *')).not.toBeInTheDocument();
  });

  it('marks the reason as required only for a vaccination that was not administered', async () => {
    const user = userEvent.setup();
    render(<ImmunizationsForm {...testProps} />);
    expect(screen.queryByLabelText(/Motivo de no aplicación/i)).not.toBeInTheDocument();
    await selectOption(screen.getByRole('combobox', { name: /Immunization/i }), 'Hepatitis B vaccination');
    await selectOption(screen.getByRole('combobox', { name: /Estado de aplicación/i }), 'No aplicada / diferida');
    expect(screen.getByLabelText(/Motivo de no aplicación o diferimiento \*/i)).toBeRequired();
    await user.click(screen.getByRole('button', { name: /Save/i }));
    expect(await screen.findByText('Please provide the reason for non-administration or deferral')).toBeVisible();
    expect(mockSavePatientImmunization).not.toHaveBeenCalled();
  });

  it('blocks saving when the vaccination history failed instead of assuming an empty history', async () => {
    vi.mocked(useImmunizations).mockReturnValue({
      data: [],
      error: new Error('private backend details'),
      isLoading: false,
      isValidating: false,
      mutate: mockMutate,
    });
    render(<ImmunizationsForm {...testProps} />);
    expect(await screen.findByText('Vaccination history unavailable')).toBeVisible();
    expect(screen.getByRole('button', { name: /Save/i })).toBeDisabled();
    expect(screen.queryByText('private backend details')).not.toBeInTheDocument();
    expect(mockSavePatientImmunization).not.toHaveBeenCalled();
  });

  it('preserves inputs and shows safe feedback when FHIR rejects the encounter provider', async () => {
    const user = userEvent.setup();
    mockUseConfig.mockReturnValue(createTestImmunizationConfig({ ampathEnabled: true }));
    mockGetImmunizationSaveErrorDetails.mockReturnValue({
      type: 'validation',
      diagnostics: 'private provider and encounter details',
    });
    mockSavePatientImmunization.mockRejectedValue({ status: 422 });
    render(<ImmunizationsForm {...testProps} />);
    await selectOption(screen.getByRole('combobox', { name: /Immunization/i }), 'Hepatitis B vaccination');
    await user.click(screen.getByRole('button', { name: /Save/i }));
    await waitFor(() =>
      expect(showSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'error',
          subtitle: 'The vaccination could not be confirmed as saved. Review the history before trying again.',
        }),
      ),
    );
    expect(mockCloseWorkspace).not.toHaveBeenCalled();
    expect(mockSavePatientImmunizationViaAmpathForm).not.toHaveBeenCalled();
    expect(screen.getByRole('combobox', { name: /Immunization/i })).toHaveTextContent('Hepatitis B vaccination');
  });

  it('should render ImmunizationsForm component', async () => {
    render(<ImmunizationsForm {...testProps} />);

    await screen.findByLabelText(/vaccination date/i);

    expect(screen.getByRole('combobox', { name: /Immunization/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /note/i })).toBeInTheDocument();
    expect(screen.getByText(/Vaccine Batch Information/i)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Manufacturer/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Lot Number/i })).toBeInTheDocument();

    expect(screen.getByLabelText(/expiration date/i)).toBeInTheDocument();
  });

  it('should render dose field appropriately', async () => {
    function verifyDoseFieldType(type: 'sequence-coded' | 'number', shouldExist: boolean) {
      const field =
        type === 'sequence-coded'
          ? screen.queryByRole('combobox', { name: /Sequence/i })
          : screen.queryByRole('spinbutton', { name: /Dose number within series/i });
      if (shouldExist) {
        expect(field).toBeInTheDocument();
      } else {
        expect(field).not.toBeInTheDocument();
      }
    }
    render(<ImmunizationsForm {...testProps} />);

    verifyDoseFieldType('sequence-coded', false);
    verifyDoseFieldType('number', false);

    const vaccinesDropdown = screen.getByRole('combobox', { name: /Immunization/i });

    // select a vaccine without configured sequences
    await selectOption(vaccinesDropdown, 'Hepatitis B vaccination');

    verifyDoseFieldType('number', true);
    verifyDoseFieldType('sequence-coded', false);

    // select a vaccine with configured sequences
    await selectOption(vaccinesDropdown, 'Polio vaccination, oral');

    verifyDoseFieldType('number', false);
    verifyDoseFieldType('sequence-coded', true);
  });

  it('should save immunization data on submit', async () => {
    const user = userEvent.setup();

    render(<ImmunizationsForm {...testProps} />);

    const formValues = {
      vaccineUuid: '886AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      doseNumber: 1,
      manufacturer: 'Pfizer',
      note: 'Given as part of routine schedule.',
    };

    mockSavePatientImmunization.mockResolvedValue({
      status: 201,
      ok: true,
      data: {
        id: '24c3efb0-2583-4c80-a79e-1f75Ma03c0a1',
      },
    });

    // fill up the form
    const vaccineField = screen.getByRole('combobox', { name: /Immunization/i });
    await selectOption(vaccineField, 'Hepatitis B vaccination');
    const doseField = screen.getByRole('spinbutton', { name: /Dose number within series/i });
    await user.clear(doseField);
    await user.type(doseField, formValues.doseNumber.toString());
    const NoteField = screen.getByRole('textbox', { name: /note/i });
    await user.clear(NoteField);
    await user.type(NoteField, formValues.note);
    const manufacturer = screen.getByRole('textbox', { name: /Manufacturer/i });
    await user.type(manufacturer, formValues.manufacturer);
    const saveButton = screen.getByRole('button', { name: /Save/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockSavePatientImmunization).toHaveBeenCalledTimes(1);
      expect(mockSavePatientImmunization).toHaveBeenCalledWith(
        expect.objectContaining({
          encounter: { reference: 'Encounter/17f512b4-d264-4113-a6fe-160cb38cb46e', type: 'Encounter' },
          expirationDate: undefined,
          extension: [],
          note: [{ text: formValues.note }],
          id: undefined,
          location: { reference: `Location/${mockCurrentVisit.location.uuid}`, type: 'Location' },
          manufacturer: { display: 'Pfizer' },
          occurrenceDateTime: dayjs(new Date()).startOf('day').toDate().toISOString(),
          patient: { reference: 'Patient/8673ee4f-e2ab-4077-ba55-4980f408773e', type: 'Patient' },
          performer: [
            { actor: { reference: 'Practitioner/b1a8b05e-3542-4037-bbd3-998ee9c4057z', type: 'Practitioner' } },
          ],
          protocolApplied: [{ doseNumberPositiveInt: 1 }],
          resourceType: 'Immunization',
          status: 'completed',
          vaccineCode: {
            coding: [{ code: '782AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', display: 'Hepatitis B vaccination' }],
          },
        }),
        undefined,
        expect.anything(),
      );
      expect(showSnackbar).toHaveBeenCalledTimes(1);
      expect(showSnackbar).toHaveBeenCalledWith({
        isLowContrast: true,
        kind: 'success',
        title: 'Vaccination saved successfully',
      });
    });
  });

  it('should prefer FHIR when AMPATH encounter persistence is enabled', async () => {
    const user = userEvent.setup();
    const config = createTestImmunizationConfig({ ampathEnabled: true });

    mockUseConfig.mockReturnValue(config);
    mockSavePatientImmunization.mockResolvedValue({
      status: 201,
      ok: true,
      data: {
        id: 'fhir-immunization-id',
      },
    });

    render(<ImmunizationsForm {...testProps} />);

    await selectOption(screen.getByRole('combobox', { name: /Immunization/i }), 'Hepatitis B vaccination');

    const doseField = screen.getByRole('spinbutton', { name: /Dose number within series/i });
    await user.clear(doseField);
    await user.type(doseField, '1');

    await user.click(screen.getByRole('button', { name: /Save/i }));

    await waitFor(() => {
      expect(mockSavePatientImmunization).toHaveBeenCalledTimes(1);
      expect(mockSavePatientImmunizationViaAmpathForm).not.toHaveBeenCalled();
    });
  });

  it('should fall back to AMPATH encounter persistence when FHIR setup is not available', async () => {
    const user = userEvent.setup();
    const config = createTestImmunizationConfig({ ampathEnabled: true });

    mockUseConfig.mockReturnValue(config);
    mockSavePatientImmunization.mockRejectedValue({ status: 501 });
    mockGetImmunizationSaveErrorDetails.mockReturnValueOnce({ type: 'fhir-setup' });
    mockSavePatientImmunizationViaAmpathForm.mockResolvedValue({
      status: 201,
      ok: true,
      data: {
        uuid: 'ampath-immunization-encounter',
      },
    });

    render(<ImmunizationsForm {...testProps} />);

    await selectOption(screen.getByRole('combobox', { name: /Immunization/i }), 'Hepatitis B vaccination');

    const doseField = screen.getByRole('spinbutton', { name: /Dose number within series/i });
    await user.clear(doseField);
    await user.type(doseField, '1');

    await user.type(screen.getByRole('textbox', { name: /Manufacturer/i }), 'Pfizer');
    await user.type(screen.getByRole('textbox', { name: /note/i }), 'Routine dose');
    await user.click(screen.getByRole('button', { name: /Save/i }));

    const { concepts } = config.ampathFormPersistence;
    await waitFor(() => {
      expect(mockSavePatientImmunization).toHaveBeenCalledTimes(1);
      expect(mockSavePatientImmunizationViaAmpathForm).toHaveBeenCalledWith(
        expect.objectContaining({
          patient: mockPatient.uuid,
          encounterType: config.ampathFormPersistence.encounterTypeUuid,
          form: '06b94846-f1db-3851-8448-2a97dba81478',
          visit: mockCurrentVisit.uuid,
          location: mockCurrentVisit.location.uuid,
          obs: expect.arrayContaining([
            { concept: concepts.vaccineUuid, value: '782AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' },
            { concept: concepts.doseNumber, value: 1 },
            { concept: concepts.manufacturer, value: 'Pfizer' },
            { concept: concepts.note, value: 'Routine dose' },
          ]),
        }),
        undefined,
        expect.anything(),
        Object.values(config.ampathFormPersistence.concepts),
      );
    });
  });

  it('keeps an unavailable Form from triggering any fallback write', async () => {
    const user = userEvent.setup();
    mockUseConfig.mockReturnValue(createTestImmunizationConfig({ ampathEnabled: true }));
    mockSavePatientImmunization.mockRejectedValue({ status: 501 });
    mockGetImmunizationSaveErrorDetails.mockReturnValueOnce({ type: 'fhir-setup' });
    mockResolveAmpathImmunizationForm.mockRejectedValueOnce(new Error('No unique published Form'));
    render(<ImmunizationsForm {...testProps} />);
    await selectOption(screen.getByRole('combobox', { name: /Immunization/i }), 'Hepatitis B vaccination');
    await user.click(screen.getByRole('button', { name: /Save/i }));
    await waitFor(() => expect(mockResolveAmpathImmunizationForm).toHaveBeenCalled());
    expect(mockSavePatientImmunizationViaAmpathForm).not.toHaveBeenCalled();
    expect(mockCloseWorkspace).not.toHaveBeenCalled();
    expect(screen.getByRole('combobox', { name: /Immunization/i })).toHaveTextContent('Hepatitis B vaccination');
  });

  it.each([
    ['2025-02-27', true],
    ['2025-02-28', false],
  ])('uses calendar months for the age warning on %s', async (vaccinationDate, warns) => {
    const config = createTestImmunizationConfig({ ampathEnabled: false });
    config.sequenceDefinitions = [
      {
        vaccineConceptUuid: '886AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        sequences: [{ sequenceNumber: 1, sequenceLabel: 'Dose-1', minAgeInMonths: 2 }],
      },
    ];
    mockUseConfig.mockReturnValue(config);
    immunizationFormSub.next({
      vaccineUuid: '886AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      vaccinationDate,
      doseNumber: 1,
      note: '',
      expirationDate: '',
      lotNumber: '',
      nextDoseDate: '',
      manufacturer: '',
    });
    render(
      <ImmunizationsForm
        {...testProps}
        groupProps={{
          ...testProps.groupProps,
          patient: { ...mockFhirPatient, id: mockPatient.uuid, birthDate: '2024-12-31' },
        }}
      />,
    );
    await waitFor(() => expect(Boolean(screen.queryByText(/antes de la edad recomendada/))).toBe(warns));
  });

  it('keeps the Form and provider unchanged when updating a historical REST encounter', async () => {
    const user = userEvent.setup();
    immunizationFormSub.next({
      persistenceSource: 'ampath-form',
      vaccineUuid: '782AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      immunizationId: 'historical-encounter',
      status: 'completed',
      vaccinationDate: '2025-01-02',
      doseNumber: 1,
      note: '',
      expirationDate: '',
      lotNumber: '',
      nextDoseDate: '',
      manufacturer: '',
      visitId: 'historical-visit',
      locationId: 'historical-location',
    });
    render(<ImmunizationsForm {...testProps} />);
    await user.type(screen.getByRole('textbox', { name: /note/i }), 'Synthetic correction');
    await user.click(screen.getByRole('button', { name: /Save/i }));
    await waitFor(() => expect(mockSavePatientImmunizationViaAmpathForm).toHaveBeenCalled());
    const payload = mockSavePatientImmunizationViaAmpathForm.mock.calls[0][0];
    expect(payload).not.toHaveProperty('visit');
    expect(payload).not.toHaveProperty('location');
    expect(payload).not.toHaveProperty('encounterDatetime');
    expect(payload).not.toHaveProperty('form');
    expect(payload).not.toHaveProperty('encounterProviders');
    expect(mockResolveAmpathImmunizationForm).not.toHaveBeenCalled();
    expect(mockSavePatientImmunization).not.toHaveBeenCalled();
  });

  it('requires an identified provider before creating an immunization', async () => {
    const user = userEvent.setup();
    mockUseSession.mockReturnValue({ ...mockSessionDataResponse.data, currentProvider: null });
    render(<ImmunizationsForm {...testProps} />);
    await selectOption(screen.getByRole('combobox', { name: /Immunization/i }), 'Hepatitis B vaccination');
    await user.click(screen.getByRole('button', { name: /Save/i }));
    await waitFor(() =>
      expect(showSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({
          subtitle: 'A linked clinical provider is required to record an immunization.',
        }),
      ),
    );
    expect(mockSavePatientImmunization).not.toHaveBeenCalled();
    expect(mockSavePatientImmunizationViaAmpathForm).not.toHaveBeenCalled();
    mockUseSession.mockReturnValue(mockSessionDataResponse.data);
  });

  it.each(['completed', 'not-done', 'unverified', undefined] as const)(
    'keeps a recorded dose selectable and warns only for administration (%s)',
    async (status) => {
      const config = createTestImmunizationConfig({ ampathEnabled: true });
      config.sequenceDefinitions = [
        {
          vaccineConceptUuid: '886AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
          sequences: [{ sequenceNumber: 1, sequenceLabel: 'Dose-1' }],
        },
      ];
      mockUseConfig.mockReturnValue(config);
      vi.mocked(useImmunizations).mockReturnValue({
        data: [
          {
            vaccineUuid: '886AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
            vaccineName: 'BCG',
            existingDoses: [
              {
                immunizationObsUuid: 'prior-dose',
                doseNumber: 1,
                status,
                expirationDate: '',
                note: [],
                nextDoseDate: '',
                lotNumber: '',
                manufacturer: '',
                occurrenceDateTime: '2025-01-02',
              },
            ],
          },
        ],
        error: undefined,
        isLoading: false,
        isValidating: false,
        mutate: mockMutate,
      });
      render(<ImmunizationsForm {...testProps} />);
      await selectOption(screen.getByRole('combobox', { name: /Immunization/i }), 'Bacillus Calmette–Guérin vaccine');
      expect(screen.getByRole('combobox', { name: /Sequence/i })).toBeEnabled();
      expect(Boolean(screen.queryByText(/already been recorded for this vaccine/))).toBe(status === 'completed');
    },
  );

  it.each([
    { persistenceSource: 'fhir', status: 'unverified' },
    { persistenceSource: 'ampath-form', status: 'unverified' },
    { persistenceSource: 'fhir', status: undefined },
  ] as const)(
    'requires an explicit administration status before updating a $persistenceSource record with status $status',
    async ({ persistenceSource, status }) => {
      const user = userEvent.setup();
      const config = createTestImmunizationConfig({ ampathEnabled: true });
      mockUseConfig.mockReturnValue(config);
      mockSavePatientImmunization.mockResolvedValue({});
      immunizationFormSub.next({
        persistenceSource,
        vaccineUuid: '782AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        immunizationId: 'unverified-record',
        status,
        vaccinationDate: '2024-01-03',
        doseNumber: 1,
        note: '',
        expirationDate: '',
        lotNumber: '',
        nextDoseDate: '',
        manufacturer: '',
        visitId: 'historical-visit',
        locationId: 'historical-location',
      });

      render(<ImmunizationsForm {...testProps} />);

      const statusDropdown = screen.getByRole('combobox', { name: /Estado de aplicación/i });
      await waitFor(() => expect(statusDropdown).toHaveTextContent(/select status|seleccione estado/i));
      expect(statusDropdown).not.toHaveTextContent('Aplicada');
      const saveButton = screen.getByRole('button', { name: /Save/i });
      await user.click(saveButton);

      expect(await screen.findByText('Select an administration status before saving')).toBeVisible();
      expect(mockSavePatientImmunization).not.toHaveBeenCalled();
      expect(mockSavePatientImmunizationViaAmpathForm).not.toHaveBeenCalled();
      expect(mockCloseWorkspace).not.toHaveBeenCalled();

      await selectOption(statusDropdown, 'Aplicada');
      await user.click(saveButton);

      if (persistenceSource === 'ampath-form') {
        await waitFor(() => expect(mockSavePatientImmunizationViaAmpathForm).toHaveBeenCalledTimes(1));
        expect(mockSavePatientImmunizationViaAmpathForm.mock.calls[0][0].obs).toContainEqual({
          concept: config.ampathFormPersistence.concepts.status,
          value: 'completed',
        });
        expect(mockSavePatientImmunization).not.toHaveBeenCalled();
      } else {
        await waitFor(() => expect(mockSavePatientImmunization).toHaveBeenCalledTimes(1));
        expect(mockSavePatientImmunization.mock.calls[0][0].status).toBe('completed');
        expect(mockSavePatientImmunizationViaAmpathForm).not.toHaveBeenCalled();
      }
    },
  );

  it('should support editing immunizations', async () => {
    const user = userEvent.setup();
    // setup and render the form
    const immunizationToEdit = {
      vaccineUuid: '886AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      immunizationId: '0a6ca2bb-a317-49d8-bd6b-dabb658840d2',
      status: 'completed' as const,
      vaccinationDate: toStoredDateTime('2024-01-03'),
      doseNumber: 2,
      expirationDate: '2024-05-19',
      nextDoseDate: toStoredDateTime('2024-01-03'),
      note: 'Given as part of routine schedule.',
      lotNumber: 'A123456',
      manufacturer: 'Merck & Co., Inc.',
      visitId: 'ce589c9c-2f30-42ec-b289-a153f812ea5e',
      locationId: 'historical-location-uuid',
    };
    immunizationFormSub.next(immunizationToEdit);
    mockSavePatientImmunization.mockResolvedValue({
      status: 201,
      ok: true,
      data: {
        id: immunizationToEdit.immunizationId,
      },
    });

    render(<ImmunizationsForm {...testProps} />);

    const vaccinationDateField = screen.getByRole('textbox', { name: /vaccination date/i });
    const vaccineField = screen.getByRole('combobox', { name: /Immunization/i });
    const doseField = screen.getByRole('spinbutton', { name: /Dose number within series/i });
    const lotField = screen.getByRole('textbox', { name: /Lot number/i });
    const manufacturerField = screen.getByRole('textbox', { name: /Manufacturer/i });
    const expirationDateField = screen.getByRole('textbox', { name: /Expiration date/i });
    const saveButton = screen.getByRole('button', { name: /Save/i });

    // verify the form values
    expect(vaccinationDateField).toHaveDisplayValue(toDisplayedDate('2024-01-03'));

    expect(vaccineField).toBeDisabled();
    expect(vaccineField).toHaveAttribute('title', 'Bacillus Calmette–Guérin vaccine');
    expect(doseField).toHaveValue(2);
    expect(lotField).toHaveValue('A123456');
    expect(manufacturerField).toHaveValue('Merck & Co., Inc.');
    expect(expirationDateField).toHaveValue(toDisplayedDate('2024-05-19'));

    // Check next dose date field
    const nextDoseDateField = screen.getByRole('textbox', { name: /Next dose date/i });
    expect(nextDoseDateField).toHaveValue(toDisplayedDate('2024-01-03'));

    // edit the form
    await user.clear(doseField);
    await user.type(doseField, '2');
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockSavePatientImmunization).toHaveBeenCalledTimes(1);
      expect(mockSavePatientImmunization).toHaveBeenCalledWith(
        expect.objectContaining({
          encounter: { reference: 'Encounter/ce589c9c-2f30-42ec-b289-a153f812ea5e', type: 'Encounter' },
          id: '0a6ca2bb-a317-49d8-bd6b-dabb658840d2',
          expirationDate: '2024-05-19',
          extension: [
            {
              url: FHIR_NEXT_DOSE_DATE_EXTENSION_URL,
              valueDateTime: toStoredDateTime('2024-01-03'),
            },
          ],
          note: [{ text: immunizationToEdit.note }],
          location: { reference: 'Location/historical-location-uuid', type: 'Location' },
          lotNumber: 'A123456',
          manufacturer: { display: 'Merck & Co., Inc.' },
          occurrenceDateTime: toStoredDateTime('2024-01-03'),
          patient: { reference: 'Patient/8673ee4f-e2ab-4077-ba55-4980f408773e', type: 'Patient' },
          performer: [
            { actor: { reference: 'Practitioner/b1a8b05e-3542-4037-bbd3-998ee9c4057z', type: 'Practitioner' } },
          ],
          protocolApplied: [{ doseNumberPositiveInt: 2 }],
          resourceType: 'Immunization',
          status: 'completed',
          vaccineCode: {
            coding: [{ code: '886AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', display: 'Bacillus Calmette–Guérin vaccine' }],
          },
        }),
        '0a6ca2bb-a317-49d8-bd6b-dabb658840d2',
        expect.anything(),
      );
      expect(showSnackbar).toHaveBeenCalledTimes(1);
      expect(showSnackbar).toHaveBeenCalledWith({
        isLowContrast: true,
        kind: 'success',
        title: 'Vaccination saved successfully',
      });
    });
  });

  it('should save new immunization with expiration date in correct format', async () => {
    const user = userEvent.setup();

    // Pre-populate form with expiration date using the form subscription (same pattern as edit tests)
    const immunizationWithExpiration = {
      vaccineUuid: '782AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      vaccinationDate: toStoredDateTime('2024-06-15'),
      doseNumber: 1,
      expirationDate: '2025-12-31',
      manufacturer: 'Pfizer',
      lotNumber: 'LOT123',
      note: '',
      nextDoseDate: null,
    };

    immunizationFormSub.next(immunizationWithExpiration);

    mockSavePatientImmunization.mockResolvedValue({
      status: 201,
      ok: true,
      data: {
        id: 'new-immunization-id',
      },
    });

    render(<ImmunizationsForm {...testProps} />);

    // Verify the form is populated
    const expirationDateField = screen.getByRole('textbox', { name: /Expiration date/i });
    expect(expirationDateField).toHaveValue(toDisplayedDate('2025-12-31'));

    // Submit without making changes
    const saveButton = screen.getByRole('button', { name: /Save/i });
    await user.click(saveButton);

    // Verify that expirationDate is formatted as YYYY-MM-DD without timezone
    await waitFor(() => {
      expect(mockSavePatientImmunization).toHaveBeenCalledWith(
        expect.objectContaining({
          expirationDate: '2025-12-31', // Date-only format, not ISO string with time/timezone
          lotNumber: 'LOT123',
          manufacturer: { display: 'Pfizer' },
        }),
        undefined,
        expect.anything(),
      );
    });
  });

  it('should format expiration date as date-only string without timezone', async () => {
    const user = userEvent.setup();

    // Regression test for O3-4970:
    // FHIR expirationDate is a date-only field. When editing, the form should hydrate that field without
    // introducing timezone shifts and should submit it back as YYYY-MM-DD, not an ISO datetime.

    // Setup immunization with expiration date
    const immunizationWithExpiration = {
      vaccineUuid: '782AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      immunizationId: 'test-immunization-with-expiration',
      status: 'completed' as const,
      vaccinationDate: toStoredDateTime('2024-12-25'),
      doseNumber: 1,
      expirationDate: '2025-12-31',
      manufacturer: 'Test Manufacturer',
      lotNumber: 'LOT123',
      note: 'Test note',
      nextDoseDate: null,
    };

    immunizationFormSub.next(immunizationWithExpiration);

    mockSavePatientImmunization.mockResolvedValue({
      status: 201,
      ok: true,
      data: {
        id: immunizationWithExpiration.immunizationId,
      },
    });

    render(<ImmunizationsForm {...testProps} />);

    // Verify the expiration date is displayed correctly
    const expirationDateField = screen.getByRole('textbox', { name: /Expiration date/i });
    expect(expirationDateField).toHaveValue(toDisplayedDate('2025-12-31'));

    // Submit the form without changes to verify the date format is preserved
    const saveButton = screen.getByRole('button', { name: /Save/i });
    await user.click(saveButton);

    // Verify that expirationDate is formatted as YYYY-MM-DD without timezone (not ISO string)
    await waitFor(() => {
      expect(mockSavePatientImmunization).toHaveBeenCalledWith(
        expect.objectContaining({
          expirationDate: '2025-12-31', // Date-only format, not ISO string with time/timezone
        }),
        immunizationWithExpiration.immunizationId,
        expect.anything(),
      );
    });
  });

  it('should preserve date format when submitting immunization with different expiration date', async () => {
    const user = userEvent.setup();

    // Load existing immunization with a different expiration date
    const immunizationToEdit = {
      vaccineUuid: '782AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      immunizationId: 'existing-immunization-id',
      status: 'completed' as const,
      vaccinationDate: toStoredDateTime('2024-06-15'),
      doseNumber: 1,
      expirationDate: '2026-06-15',
      manufacturer: 'Moderna',
      lotNumber: 'ABC123',
      note: 'Initial note',
      nextDoseDate: null,
    };

    immunizationFormSub.next(immunizationToEdit);

    mockSavePatientImmunization.mockResolvedValue({
      status: 201,
      ok: true,
      data: {
        id: immunizationToEdit.immunizationId,
      },
    });

    render(<ImmunizationsForm {...testProps} />);

    // Verify expiration date is displayed
    const expirationDateField = screen.getByRole('textbox', { name: /Expiration date/i });
    expect(expirationDateField).toHaveValue(toDisplayedDate('2026-06-15'));

    // Submit the form
    const saveButton = screen.getByRole('button', { name: /Save/i });
    await user.click(saveButton);

    // Verify the date is sent in correct format (YYYY-MM-DD, not ISO string)
    await waitFor(() => {
      expect(mockSavePatientImmunization).toHaveBeenCalledWith(
        expect.objectContaining({
          expirationDate: '2026-06-15', // Date-only format, not ISO string with time/timezone
        }),
        immunizationToEdit.immunizationId,
        expect.anything(),
      );
    });
  });
});

async function selectOption(dropdown: HTMLElement, optionLabel: string) {
  const user = userEvent.setup();
  await user.click(dropdown);
  await user.click(screen.getByText(optionLabel));
}

function createTestImmunizationConfig({ ampathEnabled }: { ampathEnabled: boolean }): ImmunizationConfigObject {
  return {
    ...defaultImmunizationConfig,
    ampathFormPersistence: {
      ...defaultImmunizationConfig.ampathFormPersistence,
      enabled: ampathEnabled,
    },
    immunizationConceptSet: '984AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    sequenceDefinitions: [
      {
        vaccineConceptUuid: '783AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        sequences: [
          { sequenceLabel: 'Dose-1', sequenceNumber: 1 },
          { sequenceLabel: 'Dose-2', sequenceNumber: 2 },
          { sequenceLabel: 'Dose-3', sequenceNumber: 3 },
          { sequenceLabel: 'Dose-4', sequenceNumber: 4 },
          { sequenceLabel: 'Booster-1', sequenceNumber: 11 },
          { sequenceLabel: 'Booster-2', sequenceNumber: 12 },
        ],
      },
    ],
  };
}

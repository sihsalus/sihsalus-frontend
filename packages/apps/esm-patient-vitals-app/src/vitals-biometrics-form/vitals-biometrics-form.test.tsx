import {
  ExtensionSlot,
  type FetchResponse,
  getDefaultsFromConfigSchema,
  showSnackbar,
  useConfig,
  usePatient,
} from '@openmrs/esm-framework';
import {
  fetchFreshPatientVitalStatus,
  type PatientWorkspace2DefinitionProps,
  useReferenceRanges,
  useVisitOrOfflineVisit,
} from '@openmrs/esm-patient-common-lib';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockConceptMetadata, mockConceptRanges, mockConceptUnits, mockPatient, mockVitalsConfig } from 'test-utils';

import { saveVitalsAndBiometrics, useVitalsConceptMetadata } from '../common';
import { type ConfigObject, configSchema } from '../config-schema';
import { buildVitalsEncounter, persistVitalsEncounter } from '../offline';

import VitalsAndBiometricsForm from './vitals-biometrics-form.workspace';

const heightValue = 180;
const muacValue = 23;
const abdominalCircumferenceValue = 95;
const oxygenSaturationValue = 100;
const pulseValue = 80;
const respiratoryRateValue = 16;
const weightValue = 62;
const systolicBloodPressureValue = 120;
const diastolicBloodPressureValue = 80;
const temperatureValue = 37;
const glasgowEyeOpeningSpontaneousUuid = 'faff1dec-14df-44d4-8695-b337dced2274';
const glasgowEyeOpeningNotTestableUuid = '25c71769-dddb-4d06-a858-cde05e2087e2';
const glasgowVerbalResponseOrientedUuid = '6440f83b-657e-4c5c-bac5-e3f67660ea4e';
const glasgowMotorResponseObeysCommandsUuid = 'bddbf4e2-c870-4515-924e-d98cfcb7948f';

const testProps = {
  closeWorkspace: () => {},
  closeWorkspaceWithSavedChanges: vi.fn(),
  patientUuid: mockPatient.id,
  promptBeforeClosing: vi.fn(),
  formContext: 'creating' as 'creating' | 'editing',
  setTitle: vi.fn(),
};

const testWorkspace2Props: PatientWorkspace2DefinitionProps<
  {
    encounterTypeUuid?: string;
    onVitalsSaved?: (payload: { formData: Record<string, number>; patientUuid: string; visitUuid: string }) => void;
    profile?: 'default' | 'emergency-triage';
  },
  object
> = {
  closeWorkspace: vi.fn(),
  groupProps: {
    patient: mockPatient as unknown as fhir.Patient,
    patientUuid: mockPatient.id,
    visitContext: null,
    mutateVisitContext: null,
  },
  launchChildWorkspace: vi.fn(),
  workspaceProps: {},
  workspaceName: '',
  windowProps: {},
  windowName: '',
  isRootWorkspace: false,
  showActionMenu: true,
};

const mockShowSnackbar = vi.mocked(showSnackbar);
const mockExtensionSlot = vi.mocked(ExtensionSlot);
const mockFetchFreshPatientVitalStatus = vi.mocked(fetchFreshPatientVitalStatus);
const mockBuildVitalsEncounter = vi.mocked(buildVitalsEncounter);
const mockPersistVitalsEncounter = vi.mocked(persistVitalsEncounter);
const mockSavePatientVitals = vi.mocked(saveVitalsAndBiometrics);
const mockUseConfig = vi.mocked(useConfig<ConfigObject>);
const mockUsePatient = vi.mocked(usePatient);
const mockUseReferenceRanges = vi.mocked(useReferenceRanges);
const mockUseVisitOrOfflineVisit = vi.mocked(useVisitOrOfflineVisit);
const mockUseVitalsConceptMetadata = vi.mocked(useVitalsConceptMetadata);

function mockPatientAgeInMonths(months: number) {
  const birthDate = new Date();
  birthDate.setHours(12, 0, 0, 0);
  birthDate.setMonth(birthDate.getMonth() - months);
  mockUsePatient.mockReturnValue({
    patient: { birthDate: birthDate.toISOString().slice(0, 10), deceasedBoolean: false },
  } as ReturnType<typeof usePatient>);
}

vi.mock('../common', () => ({
  assessValue: vi.fn(),
  getReferenceRangesForConcept: vi.fn(),
  generatePlaceholder: vi.fn(),
  interpretBloodPressure: vi.fn(),
  invalidateCachedVitalsAndBiometrics: vi.fn(),
  saveVitalsAndBiometrics: vi.fn(),
  useVitalsAndBiometrics: vi.fn(),
  useVitalsConceptMetadata: vi.fn().mockImplementation(() => ({
    data: mockConceptUnits,
    conceptMetadata: mockConceptMetadata,
    conceptRanges: mockConceptRanges,
  })),
}));

vi.mock('@openmrs/esm-patient-common-lib', async () => {
  const originalModule = await vi.importActual('@openmrs/esm-patient-common-lib');

  return {
    ...originalModule,
    fetchFreshPatientVitalStatus: vi.fn(),
    useReferenceRanges: vi.fn().mockReturnValue({
      ranges: new Map(),
      isLoading: false,
      error: undefined,
      mutate: vi.fn(),
    }),
    useVisitOrOfflineVisit: vi.fn(),
  };
});

vi.mock('../offline', () => ({
  buildVitalsEncounter: vi.fn(),
  persistVitalsEncounter: vi.fn(),
}));

mockUseConfig.mockReturnValue({
  ...getDefaultsFromConfigSchema(configSchema),
  ...mockVitalsConfig,
} as ConfigObject);

mockUsePatient.mockReturnValue({
  patient: {
    birthDate: mockPatient.birthdate,
  },
} as ReturnType<typeof usePatient>);

const activeVisitMock = {
  currentVisit: {
    uuid: 'test-visit-uuid',
    location: {
      uuid: 'test-visit-location',
    },
    stopDatetime: null,
  },
} as ReturnType<typeof useVisitOrOfflineVisit>;

describe('VitalsBiometricsForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePatient.mockReturnValue({
      patient: {
        birthDate: mockPatient.birthdate,
        deceasedBoolean: false,
      },
    } as ReturnType<typeof usePatient>);
    mockFetchFreshPatientVitalStatus.mockResolvedValue({ dead: false, deathDate: null, isDeceased: false });
    mockUseVitalsConceptMetadata.mockReturnValue({
      data: mockConceptUnits,
      conceptMetadata: mockConceptMetadata,
      conceptRanges: mockConceptRanges,
      error: undefined,
      isLoading: false,
    } as ReturnType<typeof useVitalsConceptMetadata>);
    mockBuildVitalsEncounter.mockImplementation((args) => args as never);
    mockPersistVitalsEncounter.mockImplementation(async (encounter, { abortController }) => {
      const testEncounter = encounter as unknown as Parameters<typeof buildVitalsEncounter>[0];
      const vitalStatus = await mockFetchFreshPatientVitalStatus(testEncounter.patientUuid, abortController.signal);
      if (vitalStatus.isDeceased) {
        throw Object.assign(new Error('Blocked'), { code: 'DECEASED_PATIENT_OPERATION_BLOCKED' });
      }
      await mockSavePatientVitals(
        testEncounter.encounterTypeUuid,
        testEncounter.concepts,
        testEncounter.patientUuid,
        testEncounter.vitals,
        abortController,
        testEncounter.locationUuid,
        testEncounter.visitUuid,
        {
          providerUuid: testEncounter.providerUuid,
          encounterRoleUuid: testEncounter.encounterRoleUuid,
        },
      );
      return { status: 'confirmed', encounterUuid: 'synthetic-encounter-uuid' };
    });
    mockUseReferenceRanges.mockReturnValue({
      ranges: new Map(),
      isLoading: false,
      error: undefined,
      mutate: vi.fn(),
    });
    mockUseVisitOrOfflineVisit.mockReturnValue(activeVisitMock);
  });

  it('renders the vitals and biometrics form', async () => {
    render(<VitalsAndBiometricsForm {...testProps} />);

    expect(screen.getByText(/vitals/i)).toBeInTheDocument();
    expect(screen.getByText(/biometrics/i)).toBeInTheDocument();
    expect(screen.getByText(/blood pressure/i)).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: /systolic/i })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: /diastolic/i })).toBeInTheDocument();
    expect(screen.getByText(/mmHg/i)).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: /pulse/i })).toBeInTheDocument();
    expect(screen.getByText(/beats\/min/i)).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: /oxygen saturation/i })).toBeInTheDocument();
    expect(screen.getByText(/spO2/i)).toBeInTheDocument();
    expect(screen.getByText(/%/i)).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: /respiration rate/i })).toBeInTheDocument();
    expect(screen.getByText(/breaths\/min/i)).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: /temperature/i })).toBeInTheDocument();
    expect(screen.getByText(/temp/i)).toBeInTheDocument();
    expect(screen.getByText(/DEG C/i)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /notes/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/type any additional notes here/i)).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: /weight/i })).toBeInTheDocument();
    expect(screen.getByText(/^kg$/i)).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: /height/i })).toBeInTheDocument();
    expect(screen.getByText(/bmi \(calc.\)/i)).toBeInTheDocument();
    expect(screen.getByText(/kg \/ m²/i)).toBeInTheDocument();
    const abdominalCircumferenceInput = screen.getByRole('spinbutton', {
      name: /abdominal circumference/i,
    });
    expect(abdominalCircumferenceInput).toBeInTheDocument();
    expect(abdominalCircumferenceInput.closest('section')).toHaveTextContent(/^cm$/i);
    expect(screen.queryByRole('spinbutton', { name: /muac/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /discard/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save and close/i })).toBeInTheDocument();
    expect(screen.queryByText(/glasgow coma scale/i)).not.toBeInTheDocument();
  });

  it('shows MUAC and its preventive ranges only for a patient aged 0 to 59 months', () => {
    mockPatientAgeInMonths(24);

    render(<VitalsAndBiometricsForm {...testProps} />);

    const muac = screen.getByRole('spinbutton', { name: /muac/i });
    expect(muac).toHaveAttribute('min', '6');
    expect(muac).toHaveAttribute('max', '26');
    expect(screen.getByText(/desnutrición aguda severa/i)).toBeInTheDocument();
    expect(screen.getByText(/riesgo de desnutrición aguda/i)).toBeInTheDocument();
    expect(screen.getByText(/adecuado/i)).toBeInTheDocument();
  });

  it('does not render the form for a deceased patient', () => {
    mockUsePatient.mockReturnValue({
      patient: {
        birthDate: mockPatient.birthdate,
        deceasedBoolean: true,
        deceasedDateTime: '2026-08-12T15:41:28.000Z',
      },
    } as ReturnType<typeof usePatient>);

    render(<VitalsAndBiometricsForm {...testProps} />);

    expect(screen.getByText(/new vitals cannot be recorded for a deceased patient/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save and close/i })).not.toBeInTheDocument();
  });

  it('fresh-checks vital status and blocks a save when the patient was marked deceased after the form opened', async () => {
    const user = userEvent.setup();
    mockFetchFreshPatientVitalStatus.mockResolvedValue({
      dead: true,
      deathDate: '2026-08-12T15:41:28.000Z',
      isDeceased: true,
    });

    render(<VitalsAndBiometricsForm {...testProps} />);

    await user.type(screen.getByRole('spinbutton', { name: /pulse/i }), '80');
    await user.click(screen.getByRole('button', { name: /save and close/i }));

    await waitFor(() =>
      expect(mockShowSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'error',
          subtitle: 'New vitals cannot be recorded for a deceased patient.',
        }),
      ),
    );
    expect(mockFetchFreshPatientVitalStatus).toHaveBeenCalledWith(mockPatient.id, expect.any(AbortSignal));
    expect(mockSavePatientVitals).not.toHaveBeenCalled();
  });

  it('fresh-checks vital status in the Form Engine pre-persistence seam', async () => {
    mockUseConfig.mockReturnValueOnce({
      ...getDefaultsFromConfigSchema(configSchema),
      ...mockVitalsConfig,
      vitals: {
        ...mockVitalsConfig.vitals,
        useFormEngine: true,
        formUuid: 'vitals-form-uuid',
      },
    } as ConfigObject);
    mockFetchFreshPatientVitalStatus.mockResolvedValue({
      dead: true,
      deathDate: '2026-08-12T15:41:28.000Z',
      isDeceased: true,
    });

    render(<VitalsAndBiometricsForm {...testProps} />);

    const formWidgetProps = mockExtensionSlot.mock.calls.find(
      ([props]) => props.name === 'form-widget-slot',
    )?.[0] as unknown as {
      state: { handleEncounterCreate: (encounter: object) => Promise<object> };
    };
    await expect(formWidgetProps.state.handleEncounterCreate({ patient: mockPatient.id })).rejects.toMatchObject({
      code: 'DECEASED_PATIENT_VITALS_BLOCKED',
    });
    expect(mockFetchFreshPatientVitalStatus).toHaveBeenCalledWith(mockPatient.id);
    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'error',
        subtitle: 'New vitals cannot be recorded for a deceased patient.',
      }),
    );
  });

  it('loads patient reference ranges for abdominal circumference', async () => {
    render(<VitalsAndBiometricsForm {...testProps} />);

    expect(mockUseReferenceRanges).toHaveBeenCalledWith(
      mockPatient.id,
      expect.arrayContaining([
        mockVitalsConfig.concepts.abdominalCircumferenceUuid,
        mockVitalsConfig.concepts.temperatureUuid,
      ]),
    );
  });

  it('uses the patient-specific absolute temperature range', async () => {
    const user = userEvent.setup();
    mockUseReferenceRanges.mockReturnValue({
      ranges: new Map([[mockVitalsConfig.concepts.temperatureUuid, { lowAbsolute: 35.5, hiAbsolute: 50 }]]),
      isLoading: false,
      error: undefined,
      mutate: vi.fn(),
    });

    render(<VitalsAndBiometricsForm {...testProps} />);

    const temperatureInput = screen.getByRole('spinbutton', {
      name: /temperature/i,
    });
    expect(temperatureInput).toHaveAttribute('min', '35.5');
    expect(temperatureInput).toHaveAttribute('max', '50');

    const saveButton = screen.getByRole('button', { name: /save and close/i });

    await user.type(temperatureInput, '25');
    await user.click(saveButton);

    expect(mockSavePatientVitals).not.toHaveBeenCalled();
    expect(screen.getByText(/values outside the expected range/i)).toBeInTheDocument();

    // confirming with a second save records the pathological value
    mockSavePatientVitals.mockResolvedValue({
      statusText: 'created',
      status: 201,
      data: [],
    } as FetchResponse<unknown>);
    await user.click(saveButton);
    await waitFor(() => expect(mockSavePatientVitals).toHaveBeenCalledTimes(1));
  });

  it("computes a patient's BMI from the given height and weight values", async () => {
    const user = userEvent.setup();

    render(<VitalsAndBiometricsForm {...testProps} />);

    const heightInput = screen.getByRole('spinbutton', { name: /height/i });
    const weightInput = screen.getByRole('spinbutton', { name: /weight/i });
    const bmiInput = screen.getByRole('spinbutton', { name: /bmi/i });

    await user.type(heightInput, '180');
    await user.type(weightInput, '62');

    expect(bmiInput).toHaveValue(19.1);
  });

  it('renders a success snackbar upon clicking the save button', async () => {
    const user = userEvent.setup();
    const onVitalsSaved = vi.fn();
    mockPatientAgeInMonths(24);

    const response = {
      statusText: 'created',
      status: 201,
      data: [],
    } as FetchResponse<unknown>;

    mockSavePatientVitals.mockResolvedValue(response);

    render(<VitalsAndBiometricsForm {...testProps} onVitalsSaved={onVitalsSaved} />);

    const heightInput = screen.getByRole('spinbutton', { name: /height/i });
    const weightInput = screen.getByRole('spinbutton', { name: /weight/i });
    const bmiInput = screen.getByRole('spinbutton', { name: /bmi/i });
    const systolic = screen.getByRole('spinbutton', { name: /systolic/i });
    const diastolic = screen.getByRole('spinbutton', { name: /diastolic/i });
    const pulse = screen.getByRole('spinbutton', { name: /pulse/i });
    const oxygenSaturation = screen.getByRole('spinbutton', {
      name: /oxygen saturation/i,
    });
    const respirationRate = screen.getByRole('spinbutton', {
      name: /respiration rate/i,
    });
    const temperature = screen.getByRole('spinbutton', {
      name: /temperature/i,
    });
    const abdominalCircumference = screen.getByRole('spinbutton', {
      name: /abdominal circumference/i,
    });
    const muac = screen.getByRole('spinbutton', { name: /muac/i });
    const saveButton = screen.getByRole('button', { name: /Save and close/i });

    await user.type(heightInput, heightValue.toString());
    await user.type(weightInput, weightValue.toString());
    await user.type(systolic, systolicBloodPressureValue.toString());
    await user.type(diastolic, diastolicBloodPressureValue.toString());
    await user.type(pulse, pulseValue.toString());
    await user.type(oxygenSaturation, oxygenSaturationValue.toString());
    await user.type(respirationRate, respiratoryRateValue.toString());
    await user.type(temperature, temperatureValue.toString());
    await user.type(abdominalCircumference, abdominalCircumferenceValue.toString());
    await user.type(muac, muacValue.toString());

    expect(bmiInput).toHaveValue(19.1);
    expect(systolic).toHaveValue(120);
    expect(pulse).toHaveValue(80);
    expect(oxygenSaturation).toHaveValue(100);
    expect(respirationRate).toHaveValue(16);
    expect(temperature).toHaveValue(37);
    expect(abdominalCircumference).toHaveValue(95);
    expect(muac).toHaveValue(23);

    await user.click(saveButton);

    await waitFor(() => expect(mockSavePatientVitals).toHaveBeenCalledTimes(1));
    expect(mockSavePatientVitals).toHaveBeenCalledWith(
      mockVitalsConfig.vitals.encounterTypeUuid,
      mockVitalsConfig.concepts,
      mockPatient.id,
      expect.objectContaining({
        height: heightValue,
        abdominalCircumference: abdominalCircumferenceValue,
        midUpperArmCircumference: muacValue,
        oxygenSaturation: oxygenSaturationValue,
        pulse: pulseValue,
        respiratoryRate: respiratoryRateValue,
        systolicBloodPressure: systolicBloodPressureValue,
        diastolicBloodPressure: diastolicBloodPressureValue,
        temperature: temperatureValue,
        weight: weightValue,
      }),
      expect.any(AbortController),
      'test-visit-location',
      'test-visit-uuid',
      expect.objectContaining({
        encounterRoleUuid: mockVitalsConfig.vitals.encounterRoleUuid,
      }),
    );
    expect(mockSavePatientVitals.mock.calls[0]?.[7]).not.toHaveProperty('encounterDatetime');

    expect(onVitalsSaved).toHaveBeenCalledWith({
      encounterTypeUuid: mockVitalsConfig.vitals.encounterTypeUuid,
      formData: expect.objectContaining({
        height: heightValue,
        oxygenSaturation: oxygenSaturationValue,
        pulse: pulseValue,
        respiratoryRate: respiratoryRateValue,
        systolicBloodPressure: systolicBloodPressureValue,
        temperature: temperatureValue,
        weight: weightValue,
      }),
      patientUuid: mockPatient.id,
      visitUuid: 'test-visit-uuid',
    });
    expect(mockShowSnackbar).toHaveBeenCalledTimes(1);
    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        isLowContrast: true,
        kind: 'success',
        subtitle: 'They are now visible on the Vitals and Biometrics page',
        title: 'Vitals and Biometrics saved',
      }),
    );
  });

  it('closes with an explicit pending state without running the post-save transition when the backend is unavailable', async () => {
    const user = userEvent.setup();
    const onVitalsSaved = vi.fn();
    mockPersistVitalsEncounter.mockResolvedValue({
      status: 'queued',
      encounterUuid: '11111111-1111-4111-8111-111111111111',
    });

    render(<VitalsAndBiometricsForm {...testProps} onVitalsSaved={onVitalsSaved} />);

    await user.type(screen.getByRole('spinbutton', { name: /pulse/i }), pulseValue.toString());
    await user.click(screen.getByRole('button', { name: /save and close/i }));

    await waitFor(() => expect(mockPersistVitalsEncounter).toHaveBeenCalledOnce());
    expect(onVitalsSaved).not.toHaveBeenCalled();
    expect(testProps.closeWorkspaceWithSavedChanges).toHaveBeenCalledOnce();
    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'warning',
        title: 'Vitals saved on this device',
        subtitle: expect.stringContaining('not yet part of the clinical record'),
      }),
    );
  });

  it('does not allow a second submission when queued vitals were saved but the workspace could not close', async () => {
    const user = userEvent.setup();
    const closeWorkspaceWithSavedChanges = vi.fn().mockRejectedValue(new Error('Synthetic close failure'));
    mockPersistVitalsEncounter.mockResolvedValue({
      status: 'queued',
      encounterUuid: '11111111-1111-4111-8111-111111111111',
    });

    render(<VitalsAndBiometricsForm {...testProps} closeWorkspaceWithSavedChanges={closeWorkspaceWithSavedChanges} />);

    await user.type(screen.getByRole('spinbutton', { name: /pulse/i }), pulseValue.toString());
    const saveButton = screen.getByRole('button', { name: /save and close/i });
    await user.click(saveButton);

    await waitFor(() => expect(saveButton).toBeDisabled());
    expect(mockPersistVitalsEncounter).toHaveBeenCalledOnce();
    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'warning',
        subtitle: expect.stringMatching(/workspace could not close.*do not save them again/i),
      }),
    );

    await user.click(saveButton);
    expect(mockPersistVitalsEncounter).toHaveBeenCalledOnce();
  });

  it('keeps a confirmed write terminal when a post-save workflow action fails', async () => {
    const user = userEvent.setup();
    const onVitalsSaved = vi.fn().mockRejectedValue(new Error('Synthetic routing failure'));

    render(<VitalsAndBiometricsForm {...testProps} onVitalsSaved={onVitalsSaved} />);

    await user.type(screen.getByRole('spinbutton', { name: /pulse/i }), pulseValue.toString());
    const saveButton = screen.getByRole('button', { name: /save and close/i });
    await user.click(saveButton);

    await waitFor(() => expect(saveButton).toBeDisabled());
    expect(mockPersistVitalsEncounter).toHaveBeenCalledOnce();
    expect(testProps.closeWorkspaceWithSavedChanges).toHaveBeenCalledOnce();
    expect(mockShowSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'warning',
        title: 'Vitals and Biometrics saved',
        subtitle: expect.stringMatching(/already in the clinical record.*do not save them again/i),
      }),
    );
  });

  it('keeps entered measurements visible when metadata revalidates during a backend outage', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<VitalsAndBiometricsForm {...testProps} />);
    const pulse = screen.getByRole('spinbutton', { name: /pulse/i });
    await user.type(pulse, pulseValue.toString());

    mockUseVitalsConceptMetadata.mockReturnValue({
      data: new Map(),
      conceptMetadata: undefined,
      conceptRanges: new Map(),
      error: undefined,
      isLoading: true,
    } as ReturnType<typeof useVitalsConceptMetadata>);
    mockUseReferenceRanges.mockReturnValue({
      ranges: new Map(),
      isLoading: true,
      error: undefined,
      mutate: vi.fn(),
    });
    rerender(<VitalsAndBiometricsForm {...testProps} />);

    expect(screen.getByRole('spinbutton', { name: /pulse/i })).toHaveValue(pulseValue);
    expect(screen.getByRole('button', { name: /save and close/i })).toBeInTheDocument();
    expect(screen.getByText('Reference ranges could not be loaded')).toBeInTheDocument();
  });

  it('uses the workspace encounter type override when saving from Workspace 2', async () => {
    const user = userEvent.setup();
    const triageEncounterTypeUuid = 'triage-encounter-type-uuid';
    const triageLocationUuid = 'emergency-location-uuid';

    mockSavePatientVitals.mockResolvedValue({
      statusText: 'created',
      status: 201,
      data: [],
    } as FetchResponse<unknown>);

    render(
      <VitalsAndBiometricsForm
        {...testWorkspace2Props}
        workspaceProps={{
          encounterTypeUuid: triageEncounterTypeUuid,
          locationUuid: triageLocationUuid,
        }}
      />,
    );

    await user.type(screen.getByRole('spinbutton', { name: /weight/i }), weightValue.toString());
    await user.click(screen.getByRole('button', { name: /save and close/i }));

    await waitFor(() => expect(mockSavePatientVitals).toHaveBeenCalledTimes(1));
    expect(mockSavePatientVitals).toHaveBeenCalledWith(
      triageEncounterTypeUuid,
      mockVitalsConfig.concepts,
      mockPatient.id,
      expect.objectContaining({
        weight: weightValue,
      }),
      expect.any(AbortController),
      triageLocationUuid,
      'test-visit-uuid',
      expect.objectContaining({
        encounterRoleUuid: mockVitalsConfig.vitals.encounterRoleUuid,
      }),
    );
  });

  it('renders Glasgow coma scale only for the emergency triage profile and saves the component concepts', async () => {
    const user = userEvent.setup();
    const triageEncounterTypeUuid = 'triage-encounter-type-uuid';

    mockSavePatientVitals.mockResolvedValue({
      statusText: 'created',
      status: 201,
      data: [],
    } as FetchResponse<unknown>);

    render(
      <VitalsAndBiometricsForm
        {...testWorkspace2Props}
        workspaceProps={{
          encounterTypeUuid: triageEncounterTypeUuid,
          profile: 'emergency-triage',
        }}
      />,
    );

    await user.selectOptions(screen.getByRole('combobox', { name: /eye opening/i }), glasgowEyeOpeningSpontaneousUuid);
    await user.selectOptions(
      screen.getByRole('combobox', { name: /verbal response/i }),
      glasgowVerbalResponseOrientedUuid,
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: /motor response/i }),
      glasgowMotorResponseObeysCommandsUuid,
    );

    await waitFor(() => expect(screen.getByRole('spinbutton', { name: /glasgow total/i })).toHaveValue(15));

    await user.click(screen.getByRole('button', { name: /save and close/i }));

    await waitFor(() => expect(mockSavePatientVitals).toHaveBeenCalledTimes(1));
    expect(mockSavePatientVitals).toHaveBeenCalledWith(
      triageEncounterTypeUuid,
      mockVitalsConfig.concepts,
      mockPatient.id,
      expect.objectContaining({
        glasgowEyeOpening: glasgowEyeOpeningSpontaneousUuid,
        glasgowVerbalResponse: glasgowVerbalResponseOrientedUuid,
        glasgowMotorResponse: glasgowMotorResponseObeysCommandsUuid,
        glasgowTotal: 15,
      }),
      expect.any(AbortController),
      'test-visit-location',
      'test-visit-uuid',
      expect.objectContaining({
        encounterRoleUuid: mockVitalsConfig.vitals.encounterRoleUuid,
      }),
    );
  });

  it('marks the five triage vital sign fields as required without marking notes or biometrics', () => {
    render(
      <VitalsAndBiometricsForm
        {...testWorkspace2Props}
        workspaceProps={{
          profile: 'emergency-triage',
        }}
      />,
    );

    expect(screen.getAllByText('*')).toHaveLength(5);
    expect(screen.getByRole('textbox', { name: 'Notes' }).closest('div')).not.toHaveTextContent('*');
    expect(screen.getByText('Weight').parentElement).not.toHaveTextContent('*');
  });

  it('does not submit a partial Glasgow coma scale', async () => {
    const user = userEvent.setup();

    render(
      <VitalsAndBiometricsForm
        {...testWorkspace2Props}
        workspaceProps={{
          profile: 'emergency-triage',
        }}
      />,
    );

    await user.selectOptions(screen.getByRole('combobox', { name: /eye opening/i }), glasgowEyeOpeningSpontaneousUuid);
    await user.click(screen.getByRole('button', { name: /save and close/i }));

    expect(mockSavePatientVitals).not.toHaveBeenCalled();
    expect(screen.getByText(/please complete all glasgow coma scale fields/i)).toBeInTheDocument();
  });

  it('does not compute Glasgow total when a component is not testable', async () => {
    const user = userEvent.setup();

    mockSavePatientVitals.mockResolvedValue({
      statusText: 'created',
      status: 201,
      data: [],
    } as FetchResponse<unknown>);

    render(
      <VitalsAndBiometricsForm
        {...testWorkspace2Props}
        workspaceProps={{
          profile: 'emergency-triage',
        }}
      />,
    );

    await user.selectOptions(screen.getByRole('combobox', { name: /eye opening/i }), glasgowEyeOpeningNotTestableUuid);
    await user.selectOptions(
      screen.getByRole('combobox', { name: /verbal response/i }),
      glasgowVerbalResponseOrientedUuid,
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: /motor response/i }),
      glasgowMotorResponseObeysCommandsUuid,
    );

    expect(screen.getByRole('spinbutton', { name: /glasgow total/i })).toHaveValue(null);

    await user.click(screen.getByRole('button', { name: /save and close/i }));

    await waitFor(() => expect(mockSavePatientVitals).toHaveBeenCalledTimes(1));
    const savedPayload = mockSavePatientVitals.mock.calls[0][3];
    expect(savedPayload).toMatchObject({
      glasgowEyeOpening: glasgowEyeOpeningNotTestableUuid,
      glasgowVerbalResponse: glasgowVerbalResponseOrientedUuid,
      glasgowMotorResponse: glasgowMotorResponseObeysCommandsUuid,
    });
    expect(savedPayload).not.toHaveProperty('glasgowTotal');
  });

  it('renders an error snackbar if there was a problem saving vitals and biometrics', async () => {
    const user = userEvent.setup();
    mockPatientAgeInMonths(24);

    const error = {
      message: 'Some of the values entered are invalid',
      response: {
        status: 500,
        statusText: 'Internal Server Error',
      },
    };

    mockSavePatientVitals.mockRejectedValueOnce(error);

    render(<VitalsAndBiometricsForm {...testProps} />);

    const heightInput = screen.getByRole('spinbutton', { name: /height/i });
    const weightInput = screen.getByRole('spinbutton', { name: /weight/i });
    const systolic = screen.getByRole('spinbutton', { name: /systolic/i });
    const diastolic = screen.getByRole('spinbutton', { name: /diastolic/i });
    const pulse = screen.getByRole('spinbutton', { name: /pulse/i });
    const oxygenSaturation = screen.getByRole('spinbutton', {
      name: /oxygen saturation/i,
    });
    const respirationRate = screen.getByRole('spinbutton', {
      name: /respiration rate/i,
    });
    const temperature = screen.getByRole('spinbutton', {
      name: /temperature/i,
    });
    const muac = screen.getByRole('spinbutton', { name: /muac/i });

    await user.type(heightInput, heightValue.toString());
    await user.type(weightInput, weightValue.toString());
    await user.type(systolic, systolicBloodPressureValue.toString());
    await user.type(diastolic, diastolicBloodPressureValue.toString());
    await user.type(pulse, pulseValue.toString());
    await user.type(oxygenSaturation, oxygenSaturationValue.toString());
    await user.type(respirationRate, respiratoryRateValue.toString());
    await user.type(temperature, temperatureValue.toString());
    await user.type(muac, muacValue.toString());

    const saveButton = screen.getByRole('button', { name: /save and close/i });

    await user.click(saveButton);

    expect(mockShowSnackbar).toHaveBeenCalledTimes(1);
    // The raw backend error message is never shown; it goes through the shared
    // user-facing error normalizer, which falls back to a safe generic message.
    expect(mockShowSnackbar).toHaveBeenCalledWith({
      isLowContrast: false,
      kind: 'error',
      subtitle: expect.any(String),
      title: 'Error saving vitals and biometrics',
    });
    expect(mockShowSnackbar.mock.calls[0][0].subtitle).not.toContain('Internal Server Error');
  });

  it('never saves a MUAC value outside the physical 6 to 26 cm range', async () => {
    const user = userEvent.setup();
    mockPatientAgeInMonths(24);

    render(<VitalsAndBiometricsForm {...testProps} />);

    const muacInput = screen.getByRole('spinbutton', { name: /muac/i });
    await user.type(muacInput, '3333');
    const saveButton = screen.getByRole('button', { name: /save and close/i });
    await user.click(saveButton);
    await user.click(saveButton);

    expect(mockSavePatientVitals).not.toHaveBeenCalled();
    expect(muacInput).toBeInvalid();
  });

  it('does not save vitals and biometrics without an active visit', async () => {
    const user = userEvent.setup();

    mockUseVisitOrOfflineVisit.mockReturnValue({
      currentVisit: null,
    } as ReturnType<typeof useVisitOrOfflineVisit>);

    render(<VitalsAndBiometricsForm {...testProps} />);

    await user.type(screen.getByRole('spinbutton', { name: /weight/i }), weightValue.toString());
    await user.click(screen.getByRole('button', { name: /save and close/i }));

    expect(mockSavePatientVitals).not.toHaveBeenCalled();
    expect(mockShowSnackbar).toHaveBeenCalledWith({
      isLowContrast: false,
      kind: 'error',
      subtitle: 'An active visit is required to record vitals and biometrics.',
      title: 'Error saving vitals and biometrics',
    });
  });

  it('does not fall back to the login facility when the active visit has no location', async () => {
    const user = userEvent.setup();

    mockUseVisitOrOfflineVisit.mockReturnValue({
      currentVisit: {
        uuid: 'test-visit-uuid',
        stopDatetime: null,
      },
    } as ReturnType<typeof useVisitOrOfflineVisit>);

    render(<VitalsAndBiometricsForm {...testProps} />);

    await user.type(screen.getByRole('spinbutton', { name: /weight/i }), weightValue.toString());
    await user.click(screen.getByRole('button', { name: /save and close/i }));

    expect(mockSavePatientVitals).not.toHaveBeenCalled();
    expect(mockShowSnackbar).toHaveBeenCalledWith({
      isLowContrast: false,
      kind: 'error',
      subtitle: 'Could not determine the active visit UPSS.',
      title: 'Error saving vitals and biometrics',
    });
  });

  it('warns on out-of-range values and only saves them after explicit confirmation', async () => {
    const user = userEvent.setup();

    mockSavePatientVitals.mockResolvedValue({
      statusText: 'created',
      status: 201,
      data: [],
    } as FetchResponse<unknown>);

    render(<VitalsAndBiometricsForm {...testProps} />);

    const systolic = screen.getByRole('spinbutton', { name: /systolic/i });
    const diastolic = screen.getByRole('spinbutton', { name: /diastolic/i });
    const pulse = screen.getByRole('spinbutton', { name: /pulse/i });
    const oxygenSaturation = screen.getByRole('spinbutton', {
      name: /oxygen saturation/i,
    });
    const temperature = screen.getByRole('spinbutton', {
      name: /temperature/i,
    });

    await user.type(systolic, '1000');
    await user.type(diastolic, diastolicBloodPressureValue.toString());
    await user.type(pulse, pulseValue.toString());
    await user.type(oxygenSaturation, '200');
    await user.type(temperature, temperatureValue.toString());

    const saveButton = screen.getByRole('button', { name: /save and close/i });
    await user.click(saveButton);

    // the first submit warns instead of saving or discarding the values
    expect(mockSavePatientVitals).not.toHaveBeenCalled();
    expect(screen.getByText(/values outside the expected range/i)).toBeInTheDocument();

    // a second submit with unchanged values records the pathological measurements
    await user.click(saveButton);
    await waitFor(() => expect(mockSavePatientVitals).toHaveBeenCalledTimes(1));
    expect(mockSavePatientVitals.mock.calls[0][3]).toMatchObject({
      systolicBloodPressure: 1000,
      oxygenSaturation: 200,
    });
  });

  it('requires both systolic and diastolic blood pressure values', async () => {
    const user = userEvent.setup();

    render(<VitalsAndBiometricsForm {...testProps} />);

    await user.type(screen.getByRole('spinbutton', { name: /systolic/i }), systolicBloodPressureValue.toString());
    await user.click(screen.getByRole('button', { name: /save and close/i }));

    expect(mockSavePatientVitals).not.toHaveBeenCalled();
    expect(screen.getByText(/blood pressure requires both systolic and diastolic values/i)).toBeInTheDocument();
  });

  it('requires systolic blood pressure to be greater than diastolic blood pressure', async () => {
    const user = userEvent.setup();

    render(<VitalsAndBiometricsForm {...testProps} />);

    await user.type(screen.getByRole('spinbutton', { name: /systolic/i }), '60');
    await user.type(screen.getByRole('spinbutton', { name: /diastolic/i }), '110');
    await user.click(screen.getByRole('button', { name: /save and close/i }));

    expect(mockSavePatientVitals).not.toHaveBeenCalled();
    expect(
      screen.getByText(/systolic blood pressure must be greater than diastolic blood pressure/i),
    ).toBeInTheDocument();
  });

  it('does not create an encounter from a note alone', async () => {
    const user = userEvent.setup();

    render(<VitalsAndBiometricsForm {...testProps} />);

    await user.type(screen.getByRole('textbox', { name: /notes/i }), 'Paciente en ayunas');
    await user.click(screen.getByRole('button', { name: /save and close/i }));

    expect(mockSavePatientVitals).not.toHaveBeenCalled();
    expect(screen.getByText(/record at least one measurement/i)).toBeInTheDocument();
  });

  it('uses dirtyFields to determine unsaved changes', async () => {
    const user = userEvent.setup();

    render(<VitalsAndBiometricsForm {...testProps} />);

    const initialGuard = vi.mocked(testProps.promptBeforeClosing).mock.calls.at(-1)?.[0];
    expect(initialGuard?.()).toBe(false);

    await user.type(screen.getByRole('spinbutton', { name: /height/i }), '180');

    const updatedGuard = vi.mocked(testProps.promptBeforeClosing).mock.calls.at(-1)?.[0];
    expect(updatedGuard?.()).toBe(true);
  });
});

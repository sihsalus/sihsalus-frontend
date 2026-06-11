import {
  type FetchResponse,
  getDefaultsFromConfigSchema,
  showSnackbar,
  useConfig,
  usePatient,
  useSession,
  useVisit,
} from '@openmrs/esm-framework';
import { type PatientWorkspace2DefinitionProps, useReferenceRanges } from '@openmrs/esm-patient-common-lib';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockConceptMetadata, mockConceptRanges, mockConceptUnits, mockPatient, mockVitalsConfig } from 'test-utils';

import { saveVitalsAndBiometrics } from '../common';
import { type ConfigObject, configSchema } from '../config-schema';

import VitalsAndBiometricsForm from './vitals-biometrics-form.workspace';

const heightValue = 180;
const muacValue = 23;
const abdominalCircumferenceValue = 95;
const oxygenSaturationValue = 100;
const pulseValue = 80;
const respiratoryRateValue = 16;
const weightValue = 62;
const systolicBloodPressureValue = 120;
const temperatureValue = 37;

const testProps = {
  closeWorkspace: () => {},
  closeWorkspaceWithSavedChanges: vi.fn(),
  patientUuid: mockPatient.id,
  promptBeforeClosing: vi.fn(),
  formContext: 'creating' as 'creating' | 'editing',
  setTitle: vi.fn(),
};

const testWorkspace2Props: PatientWorkspace2DefinitionProps<{ encounterTypeUuid?: string }, object> = {
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
const mockSavePatientVitals = vi.mocked(saveVitalsAndBiometrics);
const mockUseConfig = vi.mocked(useConfig<ConfigObject>);
const mockUsePatient = vi.mocked(usePatient);
const mockUseReferenceRanges = vi.mocked(useReferenceRanges);
const mockUseSession = vi.mocked(useSession);
const mockUseVisit = vi.mocked(useVisit);

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
    useReferenceRanges: vi.fn().mockReturnValue({
      ranges: new Map(),
      isLoading: false,
      error: undefined,
      mutate: vi.fn(),
    }),
  };
});

mockUseConfig.mockReturnValue({
  ...getDefaultsFromConfigSchema(configSchema),
  ...mockVitalsConfig,
} as ConfigObject);

mockUseSession.mockReturnValue({
  sessionLocation: {
    uuid: 'test-session-location',
  },
} as ReturnType<typeof useSession>);

mockUsePatient.mockReturnValue({
  patient: {
    birthDate: mockPatient.birthdate,
  },
} as ReturnType<typeof usePatient>);

const activeVisitMock = {
  currentVisit: {
    uuid: 'test-visit-uuid',
    stopDatetime: null,
  },
} as ReturnType<typeof useVisit>;

describe('VitalsBiometricsForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseVisit.mockReturnValue(activeVisitMock);
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
    const abdominalCircumferenceInput = screen.getByRole('spinbutton', { name: /abdominal circumference/i });
    expect(abdominalCircumferenceInput).toBeInTheDocument();
    expect(abdominalCircumferenceInput.closest('section')).toHaveTextContent(/^cm$/i);
    expect(screen.getByRole('spinbutton', { name: /muac/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /discard/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save and close/i })).toBeInTheDocument();
  });

  it('loads patient reference ranges for abdominal circumference', async () => {
    render(<VitalsAndBiometricsForm {...testProps} />);

    expect(mockUseReferenceRanges).toHaveBeenCalledWith(
      mockPatient.id,
      expect.arrayContaining([mockVitalsConfig.concepts.abdominalCircumferenceUuid]),
    );
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

    const response = {
      statusText: 'created',
      status: 201,
      data: [],
    } as FetchResponse<unknown>;

    mockSavePatientVitals.mockResolvedValue(response);

    render(<VitalsAndBiometricsForm {...testProps} />);

    const heightInput = screen.getByRole('spinbutton', { name: /height/i });
    const weightInput = screen.getByRole('spinbutton', { name: /weight/i });
    const bmiInput = screen.getByRole('spinbutton', { name: /bmi/i });
    const systolic = screen.getByRole('spinbutton', { name: /systolic/i });
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
    const abdominalCircumference = screen.getByRole('spinbutton', { name: /abdominal circumference/i });
    const muac = screen.getByRole('spinbutton', { name: /muac/i });
    const saveButton = screen.getByRole('button', { name: /Save and close/i });

    await user.type(heightInput, heightValue.toString());
    await user.type(weightInput, weightValue.toString());
    await user.type(systolic, systolicBloodPressureValue.toString());
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

    expect(mockSavePatientVitals).toHaveBeenCalledTimes(1);
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
        temperature: temperatureValue,
        weight: weightValue,
      }),
      expect.any(AbortController),
      'test-session-location',
      'test-visit-uuid',
    );

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

  it('uses the workspace encounter type override when saving from Workspace 2', async () => {
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
      'test-session-location',
      'test-visit-uuid',
    );
  });

  it('renders an error snackbar if there was a problem saving vitals and biometrics', async () => {
    const user = userEvent.setup();

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
    await user.type(pulse, pulseValue.toString());
    await user.type(oxygenSaturation, oxygenSaturationValue.toString());
    await user.type(respirationRate, respiratoryRateValue.toString());
    await user.type(temperature, temperatureValue.toString());
    await user.type(muac, muacValue.toString());

    const saveButton = screen.getByRole('button', { name: /save and close/i });

    await user.click(saveButton);

    expect(mockShowSnackbar).toHaveBeenCalledTimes(1);
    expect(mockShowSnackbar).toHaveBeenCalledWith({
      isLowContrast: false,
      kind: 'error',
      subtitle: 'Some of the values entered are invalid',
      title: 'Error saving vitals and biometrics',
    });
  });

  it('does not save vitals and biometrics without an active visit', async () => {
    const user = userEvent.setup();

    mockUseVisit.mockReturnValue({
      currentVisit: null,
    } as ReturnType<typeof useVisit>);

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

  it('Display an inline error notification on submit if value of vitals entered is invalid', async () => {
    const user = userEvent.setup();

    render(<VitalsAndBiometricsForm {...testProps} />);

    const systolic = screen.getByRole('spinbutton', { name: /systolic/i });
    const pulse = screen.getByRole('spinbutton', { name: /pulse/i });
    const oxygenSaturation = screen.getByRole('spinbutton', {
      name: /oxygen saturation/i,
    });
    const temperature = screen.getByRole('spinbutton', {
      name: /temperature/i,
    });

    await user.type(systolic, '1000');
    await user.type(pulse, pulseValue.toString());
    await user.type(oxygenSaturation, '200');
    await user.type(temperature, temperatureValue.toString());

    const saveButton = screen.getByRole('button', { name: /save and close/i });
    await user.click(saveButton);

    expect(screen.getByText(/Some of the values entered are invalid/i)).toBeInTheDocument();

    // close the inline notification --> resubmit --> check for presence of inline notification
    const closeInlineNotificationButton = screen.getByTitle(/close notification/i);
    await user.click(closeInlineNotificationButton);
    expect(screen.queryByText(/some of the values entered are invalid/i)).not.toBeInTheDocument();
    await user.click(saveButton);
    expect(screen.getByText(/Some of the values entered are invalid/i)).toBeInTheDocument();
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

import { isDesktop, useConfig, useLayoutType } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useMaternalFormIdentifierLauncher } from '../../hooks/useMaternalFormLauncher';
import { usePartograph } from '../../hooks/usePartograph';
import Partograph from './partograph.component';

const mockUseConfig = useConfig as vi.Mock;
const mockUseLayoutType = vi.mocked(useLayoutType);
const mockIsDesktop = vi.mocked(isDesktop);
const mockLaunchForm = vi.fn();
const mockUseMaternalFormIdentifierLauncher = vi.mocked(useMaternalFormIdentifierLauncher);
const mockUsePartograph = vi.mocked(usePartograph);

vi.mock('../../hooks/usePartograph', () => ({
  usePartograph: vi.fn(),
}));

vi.mock('../../hooks/useMaternalFormLauncher', () => ({
  useMaternalFormIdentifierLauncher: vi.fn(),
}));

vi.mock('./partograph-chart', () => ({
  default: () => <div>chart view</div>,
}));

const partographyConfig = {
  formUuid: 'HOSP-011-HOJA DE MONITORIZACIÓN OBSTÉTRICA-PARTO',
  concepts: {
    timeRecordedUuid: 'time',
    fetalHeartRateUuid: 'fhr',
    cervicalDilationUuid: '',
    descentOfHeadUuid: '',
    contractionFrequencyUuid: 'frequency',
    contractionIntensityUuid: 'intensity',
    contractionDurationUuid: 'duration',
    maternalSystolicBloodPressureUuid: 'systolic',
    maternalDiastolicBloodPressureUuid: 'diastolic',
    maternalPulseUuid: 'pulse',
    maternalTemperatureUuid: 'temperature',
    maternalRespiratoryRateUuid: 'respiratory',
    urineOutputUuid: 'urine',
    fetalDeathUuid: 'fetal-death',
    observationsUuid: 'observations',
  },
  descentOfHeadAnswerLabels: {},
};

describe('Partograph', () => {
  beforeEach(() => {
    mockUseConfig.mockReturnValue({ partography: partographyConfig });
    mockUseLayoutType.mockReturnValue('desktop');
    mockIsDesktop.mockReturnValue(true);
    mockLaunchForm.mockReset();
    mockUseMaternalFormIdentifierLauncher.mockReturnValue({ launchForm: mockLaunchForm } as never);
  });

  it('opens the configured monitoring form from the empty state', async () => {
    const user = userEvent.setup();
    mockUsePartograph.mockReturnValue({
      encounters: [],
      isLoading: false,
      isValidating: false,
      error: null,
      mutate: vi.fn(),
    });

    render(<Partograph patientUuid="patient-uuid" />);

    await user.click(screen.getByRole('button', { name: /registrar datos del trabajo de parto/i }));

    expect(mockUseMaternalFormIdentifierLauncher).toHaveBeenCalledWith(partographyConfig.formUuid, 'Partograph');
    expect(mockLaunchForm).toHaveBeenCalledWith('', expect.any(Function));
  });

  it('renders obstetric monitoring values as partograph rows', () => {
    mockUsePartograph.mockReturnValue({
      encounters: [
        {
          uuid: 'progress-row',
          obsDatetime: '2026-01-01T10:00:00.000Z',
          groupMembers: [
            { concept: { uuid: 'time' }, value: '2026-01-01T10:30:00.000Z' },
            { concept: { uuid: 'fhr' }, value: 142 },
            { concept: { uuid: 'frequency' }, value: '4' },
            { concept: { uuid: 'intensity' }, value: { display: 'Fuerte' } },
            { concept: { uuid: 'duration' }, value: 60 },
            { concept: { uuid: 'systolic' }, value: 120 },
            { concept: { uuid: 'diastolic' }, value: 80 },
            { concept: { uuid: 'pulse' }, value: 90 },
            { concept: { uuid: 'temperature' }, value: 37.1 },
            { concept: { uuid: 'respiratory' }, value: 20 },
            { concept: { uuid: 'urine' }, value: 'Diuresis espontánea' },
            { concept: { uuid: 'fetal-death' }, value: 'No' },
            { concept: { uuid: 'observations' }, value: 'Sin signos de alarma' },
          ],
        },
      ],
      isLoading: false,
      isValidating: false,
      error: null,
      mutate: vi.fn(),
    });

    render(<Partograph patientUuid="patient-uuid" />);

    expect(screen.getByText('142')).toBeInTheDocument();
    expect(screen.getByText('120/80')).toBeInTheDocument();
    expect(screen.getByText('Fuerte')).toBeInTheDocument();
    expect(screen.getByText('Diuresis espontánea')).toBeInTheDocument();
    expect(screen.getByText('Sin signos de alarma')).toBeInTheDocument();
  });
});

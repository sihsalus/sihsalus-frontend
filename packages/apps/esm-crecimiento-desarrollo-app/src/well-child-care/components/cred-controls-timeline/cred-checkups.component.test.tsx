import { userHasAccess } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createInstance } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import en from '../../../../translations/en.json';
import es from '../../../../translations/es.json';
import { useCREDSchedule } from '../../../hooks/useCREDSchedule';
import { useNutritionFollowup } from '../../../hooks/useNutritionFollowup';
import { useStimulationFollowup } from '../../../hooks/useStimulationFollowup';
import { createCREDAppointments } from '../../common/cred-appointments.resource';
import NutritionFollowup from '../child-nutrition/nutrition-followup/nutrition-followup.component';
import StimulationFollowup from '../early-stimulation/stimulation-followup/stimulation-followup.component';
import CredCheckups from './cred-checkups.component';

const { launchWorkspace, launchForm, mutateAppointments } = vi.hoisted(() => ({
  launchWorkspace: vi.fn(),
  launchForm: vi.fn(),
  mutateAppointments: vi.fn(),
}));
vi.mock('react-i18next', async () => {
  const { createRequire } = await import('node:module');
  return createRequire(import.meta.url)('react-i18next');
});
vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  useSession: () => ({ user: {} }),
  useConfig: () => ({ credScheduling: { appointmentServiceUuid: 'service', appointmentLocationUuid: 'location' } }),
  userHasAccess: vi.fn(() => true),
}));
vi.mock('@openmrs/esm-patient-common-lib', async () => ({
  ...(await vi.importActual('@openmrs/esm-patient-common-lib')),
  useLaunchWorkspaceRequiringVisit: () => launchWorkspace,
}));
vi.mock('../../../hooks/useCREDSchedule', () => ({ useCREDSchedule: vi.fn() }));
vi.mock('../../../hooks/useNutritionFollowup', () => ({ useNutritionFollowup: vi.fn() }));
vi.mock('../../../hooks/useStimulationFollowup', () => ({ useStimulationFollowup: vi.fn() }));
vi.mock('../../../hooks/useCREDFormLauncher', () => ({
  useCREDFormLauncher: () => ({ launchForm, isLoading: false }),
}));
vi.mock('../../../ui/form/appointments-form.resource', () => ({
  useMutateAppointments: () => ({ mutateAppointments }),
}));
vi.mock('../../common/cred-appointments.resource', () => ({ createCREDAppointments: vi.fn() }));

const control = {
  controlNumber: 4,
  label: '1 mes',
  phase: 'infant' as const,
  ageGroupLabel: '1 mes',
  targetDate: new Date(2020, 0, 15),
  dueEndDate: new Date(2020, 0, 30),
  status: 'scheduled' as const,
  appointmentDate: new Date(2020, 0, 20),
  appointmentUuid: 'appointment',
};
async function renderCards(language: 'es' | 'en' = 'es') {
  const i18n = createInstance();
  await i18n.use(initReactI18next).init({
    lng: language,
    fallbackLng: false,
    defaultNS: 'another-module',
    resources: { en: { '@sihsalus/esm-cred-app': en }, es: { '@sihsalus/esm-cred-app': es } },
    interpolation: { escapeValue: false },
  });
  return render(
    <I18nextProvider i18n={i18n}>
      <CredCheckups patientUuid="child" />
      <NutritionFollowup patientUuid="child" />
      <StimulationFollowup patientUuid="child" />
    </I18nextProvider>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(userHasAccess).mockReturnValue(true);
  vi.mocked(useCREDSchedule).mockReturnValue({
    controls: [control],
    nextDueControl: control,
    overdueControls: [],
    completedCount: 3,
    totalCount: 27,
    isLoading: false,
    error: null,
  });
  vi.mocked(useNutritionFollowup).mockReturnValue({
    nutritionClassification: 'Clasificación registrada',
    evolution: 'Nota extensa registrada por el profesional que debe conservarse completa.',
    referral: 'Sí, según evaluación registrada',
    lastFollowupDate: '15/01/2020',
    isLoading: false,
    error: null,
  });
  vi.mocked(useStimulationFollowup).mockReturnValue({
    lastEvaluationResult: 'Resultado registrado con observaciones para el siguiente seguimiento.',
    lastEvaluationDate: '15/01/2020',
    coordinationResult: null,
    motorResult: null,
    hasStimulationLack: true,
    isLoading: false,
    error: null,
  });
});

describe.each(['es', 'en'] as const)('summary cards (%s)', (language) => {
  it('uses standard translated headings and keeps recorded information and native actions', async () => {
    const messages = language === 'es' ? es : en;
    await renderCards(language);
    expect(
      screen.getByRole('heading', {
        name: language === 'es' ? 'Controles de crecimiento y desarrollo' : 'Growth and development controls',
      }),
    ).toBeVisible();
    expect(screen.getByRole('heading', { name: messages.cnFollowUpTitle })).toBeVisible();
    expect(screen.getByRole('heading', { name: messages.esFollowUpTitle })).toBeVisible();
    expect(screen.getByText(messages.credRecordedControlNumber.replace('{{number}}', '4'))).toBeVisible();
    expect(screen.getByText(messages.minimumControlDate)).toBeVisible();
    expect(screen.getAllByText('20/01/2020')).toHaveLength(2);
    expect(
      screen.getByText(messages.completedOf.replace('{{completed}}', '3').replace('{{total}}', '27')),
    ).toBeVisible();
    expect(screen.getByText('Nota extensa registrada por el profesional que debe conservarse completa.')).toBeVisible();
    expect(screen.getAllByText(messages.esRisk)).toHaveLength(2);
    await userEvent.click(screen.getByRole('button', { name: messages.registerControl }));
    expect(launchWorkspace).toHaveBeenCalledWith({
      patientUuid: 'child',
      control,
      type: 'newControl',
      workspaceTitle: messages.newCredEncounter,
    });
    await userEvent.click(screen.getAllByRole('button', { name: messages.add })[0]);
    expect(launchForm).toHaveBeenCalledOnce();
    expect(
      screen.getByRole('button', { name: language === 'es' ? 'Generar cita' : 'Generate appointment' }),
    ).toBeDisabled();
  });
});
it('keeps future registration disabled while scheduling exactly the recommended control', async () => {
  const future = {
    ...control,
    status: 'future' as const,
    targetDate: new Date(2099, 0, 15),
    appointmentDate: undefined,
    appointmentUuid: undefined,
  };
  vi.mocked(useCREDSchedule).mockReturnValue({
    controls: [],
    nextDueControl: future,
    overdueControls: [],
    completedCount: 3,
    totalCount: 27,
    isLoading: false,
    error: null,
  });
  vi.mocked(createCREDAppointments).mockResolvedValue({ created: [], errors: [] });
  await renderCards();
  expect(screen.getByRole('button', { name: 'Registrar control' })).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: 'Generar cita' }));
  expect(createCREDAppointments).toHaveBeenCalledWith('child', [future], 'service', 'location', 30);
  expect(launchWorkspace).not.toHaveBeenCalled();
});
it('preserves read-only recorded summaries without exposing actions', async () => {
  vi.mocked(userHasAccess).mockReturnValue(false);
  await renderCards();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  expect(screen.getByText('Clasificación registrada')).toBeVisible();
});
it('shows missing records without inferring a normal development result', async () => {
  vi.mocked(useNutritionFollowup).mockReturnValue({
    nutritionClassification: null,
    evolution: null,
    referral: null,
    lastFollowupDate: null,
    isLoading: false,
    error: null,
  });
  vi.mocked(useStimulationFollowup).mockReturnValue({
    lastEvaluationResult: null,
    lastEvaluationDate: null,
    coordinationResult: null,
    motorResult: null,
    hasStimulationLack: false,
    isLoading: false,
    error: null,
  });
  await renderCards();
  expect(screen.getAllByText('Sin datos')).toHaveLength(7);
  expect(screen.queryByText('Normal')).not.toBeInTheDocument();
  expect(screen.queryByText(es.resultRecorded)).not.toBeInTheDocument();
});
it('withholds registration while the schedule is loading or has failed', async () => {
  vi.mocked(useCREDSchedule).mockReturnValue({
    controls: [],
    nextDueControl: null,
    overdueControls: [],
    completedCount: 0,
    totalCount: 27,
    isLoading: true,
    error: null,
  });
  const view = await renderCards();
  expect(screen.getByText(es.loadingSchedule)).toBeVisible();
  expect(screen.queryByRole('button', { name: es.registerControl })).not.toBeInTheDocument();
  view.unmount();
  vi.mocked(useCREDSchedule).mockReturnValue({
    controls: [],
    nextDueControl: null,
    overdueControls: [],
    completedCount: 0,
    totalCount: 27,
    isLoading: false,
    error: new Error('Synthetic load failure'),
  });
  await renderCards();
  expect(screen.getByText(es.errorLoadingSchedule)).toBeVisible();
  expect(screen.queryByRole('button', { name: es.registerControl })).not.toBeInTheDocument();
});

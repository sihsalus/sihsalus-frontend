import { act, render, screen, waitFor } from '@testing-library/react';
import { getDefaultsFromConfigSchema, openmrsFetch, UserHasAccess, useConfig } from '@openmrs/esm-framework';
import { launchPatientWorkspace } from '@openmrs/esm-patient-common-lib';
import type { ReactNode } from 'react';
import userEvent from '@testing-library/user-event';
import OutPatientSocialHistory from './patient-social-history.component';
import { configSchema } from '../../../config-schema';

vi.mock('@openmrs/esm-patient-common-lib', async () => {
  const actual = await vi.importActual('@openmrs/esm-patient-common-lib');

  return {
    ...actual,
    getObsFromEncounter: (_encounter: unknown, conceptUuid: string) => (conceptUuid === 'alcohol-use' ? 'No' : '--'),
    launchPatientWorkspace: vi.fn(),
  };
});

const config = {
  clinicalEncounterUuid: 'clinical-encounter',
  concepts: {
    alcoholUseUuid: 'alcohol-use',
    alcoholUseDurationUuid: 'alcohol-duration',
    smokingUuid: 'smoking',
    smokingDurationUuid: 'smoking-duration',
    otherSubstanceAbuseUuid: 'other-substance',
  },
  formsList: { clinicalEncounterFormUuid: 'clinical-form' },
};

const encounters = [
  {
    uuid: 'encounter-1',
    encounterDatetime: '2026-08-10T10:00:00.000Z',
  },
] as never;

describe('OutPatientSocialHistory privileges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useConfig).mockReturnValue(config as never);
    vi.mocked(openmrsFetch).mockResolvedValue({
      data: {
        results: [
          {
            uuid: 'clinical-form',
            name: 'clinical-form',
            published: true,
            retired: false,
            encounterType: { uuid: 'clinical-encounter' },
          },
        ],
      },
    } as never);
  });

  it('keeps the social-history list visible and hides Add without historiaSocial.editar', () => {
    vi.mocked(UserHasAccess).mockImplementation(({ fallback }: { fallback?: ReactNode }) => fallback);

    render(
      <OutPatientSocialHistory
        patientUuid="patient-1"
        encounters={encounters}
        isLoading={false}
        error={undefined as never}
        isValidating={false}
        mutate={vi.fn() as never}
      />,
    );

    expect(screen.getByRole('table', { name: 'Social History' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'No' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add' })).not.toBeInTheDocument();
    expect(vi.mocked(UserHasAccess).mock.calls[0][0]).toEqual(
      expect.objectContaining({
        privilege: 'app:hoja.clinica.historiaSocial.editar',
      }),
    );
  });

  it('opens a new encounter and refreshes its history when the form closes', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn().mockResolvedValue(undefined);
    vi.mocked(UserHasAccess).mockImplementation(({ children }: { children?: ReactNode }) => children);

    render(
      <OutPatientSocialHistory
        patientUuid="patient-1"
        encounters={encounters}
        isLoading={false}
        error={undefined as never}
        isValidating={false}
        mutate={mutate}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() =>
      expect(vi.mocked(launchPatientWorkspace)).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          formInfo: expect.objectContaining({
            encounterUuid: '',
            formUuid: 'clinical-form',
            patientUuid: 'patient-1',
          }),
        }),
      ),
    );
    expect(mutate).not.toHaveBeenCalled();
    const { mutateForm } = vi.mocked(launchPatientWorkspace).mock.calls[0][1] as {
      mutateForm: () => Promise<unknown>;
    };
    expect(mutateForm).toEqual(expect.any(Function));

    await act(async () => {
      await mutateForm();
    });

    expect(mutate).toHaveBeenCalledExactlyOnceWith();
  });

  it('labels bundled concepts by their meaning without changing recorded values or the table structure', () => {
    const defaults = getDefaultsFromConfigSchema(configSchema);
    vi.mocked(useConfig).mockReturnValue({
      ...defaults,
      concepts: { ...defaults.concepts, alcoholUseUuid: 'alcohol-use' },
    });
    vi.mocked(UserHasAccess).mockImplementation(({ fallback }: { fallback?: ReactNode }) => fallback);
    render(
      <OutPatientSocialHistory
        patientUuid="patient-1"
        encounters={encounters}
        isLoading={false}
        error={undefined as never}
        isValidating={false}
        mutate={vi.fn() as never}
      />,
    );
    expect(screen.getByRole('columnheader', { name: 'Cigarettes per day' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Tobacco use status' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Smoking duration (years)' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Alcohol Use Duration' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Other Substance Abuse' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('columnheader')).toHaveLength(6);
    expect(screen.getByRole('cell', { name: 'No' })).toBeInTheDocument();
    expect(launchPatientWorkspace).not.toHaveBeenCalled();
  });

  it('preserves labels for institutions overriding the legacy concept mappings', () => {
    render(
      <OutPatientSocialHistory
        patientUuid="patient-1"
        encounters={encounters}
        isLoading={false}
        error={undefined as never}
        isValidating={false}
        mutate={vi.fn() as never}
      />,
    );
    expect(screen.getByRole('columnheader', { name: 'Alcohol Use Duration' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Other Substance Abuse' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Smoking Duration' })).toBeInTheDocument();
  });
});

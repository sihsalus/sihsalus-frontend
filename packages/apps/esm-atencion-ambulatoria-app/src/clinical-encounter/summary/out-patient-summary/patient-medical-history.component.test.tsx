import { getDefaultsFromConfigSchema, UserHasAccess, useConfig } from '@openmrs/esm-framework';
import { launchPatientWorkspace } from '@openmrs/esm-patient-common-lib';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { type ConfigObject, configSchema } from '../../../config-schema';
import type { OpenmrsEncounter } from '../../../types';
import OutPatientMedicalHistory from './patient-medical-history.component';

vi.mock('@openmrs/esm-patient-common-lib', async () => ({
  ...(await vi.importActual('@openmrs/esm-patient-common-lib')),
  launchPatientWorkspace: vi.fn(),
}));

describe('OutPatientMedicalHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useConfig).mockReturnValue(getDefaultsFromConfigSchema(configSchema) as ConfigObject);
  });

  it.each([
    { coded: { display: 'Synthetic coded diagnosis' }, expected: 'Synthetic coded diagnosis' },
    { coded: null, expected: '--' },
  ])('keeps the history visible when the coded diagnosis is $coded', ({ coded, expected }) => {
    const encounter = {
      uuid: 'synthetic-history-encounter',
      encounterDatetime: '2026-09-01T12:00:00.000Z',
      obs: [],
      diagnoses: [{ uuid: 'synthetic-diagnosis', diagnosis: { coded } }],
    } as unknown as OpenmrsEncounter;

    render(
      <OutPatientMedicalHistory
        patientUuid="synthetic-patient"
        encounters={[encounter]}
        isLoading={false}
        error={null}
        isValidating={false}
        mutate={vi.fn()}
      />,
    );

    expect(screen.getByRole('table', { name: 'Medical History' })).toBeInTheDocument();
    expect(screen.getAllByRole('cell').at(-1)).toHaveTextContent(expected);
  });

  it('refreshes the displayed history when the launched form closes', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn().mockResolvedValue(undefined);
    vi.mocked(UserHasAccess).mockImplementation(({ children }: { children?: ReactNode }) => children);

    render(
      <OutPatientMedicalHistory
        patientUuid="synthetic-patient"
        encounters={[
          {
            uuid: 'synthetic-history-encounter',
            encounterDatetime: '2026-09-01T12:00:00.000Z',
            obs: [],
            diagnoses: [{ diagnosis: { coded: { display: 'Synthetic coded diagnosis' } } }],
          } as unknown as OpenmrsEncounter,
        ]}
        isLoading={false}
        error={null}
        isValidating={false}
        mutate={mutate}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Add' }));

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

  it.each([false, true])('hides the legacy form action in read-only mode, including empty history: %s', (empty) => {
    vi.mocked(UserHasAccess).mockImplementation(({ children }: { children?: ReactNode }) => children);
    const encounter = {
      uuid: 'synthetic-history-encounter',
      encounterDatetime: '2026-09-01T12:00:00.000Z',
      obs: [],
      diagnoses: [{ diagnosis: { coded: { display: 'Synthetic coded diagnosis' } } }],
    } as unknown as OpenmrsEncounter;

    render(
      <OutPatientMedicalHistory
        patientUuid="synthetic-patient"
        encounters={empty ? [] : [encounter]}
        isLoading={false}
        error={null}
        isValidating={false}
        mutate={vi.fn()}
        readOnly
      />,
    );

    expect(screen.getByText('Previous medical records')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(launchPatientWorkspace).not.toHaveBeenCalled();
    if (!empty) {
      expect(screen.getByText('Synthetic coded diagnosis')).toBeInTheDocument();
    }
  });
});

import { render, screen } from '@testing-library/react';
import { UserHasAccess, useConfig } from '@openmrs/esm-framework';
import type { ReactNode } from 'react';
import OutPatientSocialHistory from './patient-social-history.component';

vi.mock('@openmrs/esm-patient-common-lib', async () => {
  const actual = await vi.importActual('@openmrs/esm-patient-common-lib');

  return {
    ...actual,
    getObsFromEncounter: (_encounter: unknown, conceptUuid: string) => (conceptUuid === 'alcohol-use' ? 'No' : '--'),
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
    vi.mocked(useConfig).mockReturnValue(config as never);
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
      expect.objectContaining({ privilege: 'app:hoja.clinica.historiaSocial.editar' }),
    );
  });
});

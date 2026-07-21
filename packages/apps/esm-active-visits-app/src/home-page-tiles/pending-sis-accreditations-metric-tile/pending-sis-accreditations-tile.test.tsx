import { getDefaultsFromConfigSchema, useConfig } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';

import { type ActiveVisitsConfigSchema, configSchema } from '../../config-schema';
import { usePendingSisAccreditations } from '../../pending-sis-accreditations/pending-sis-accreditations.resource';
import PendingSisAccreditationsTile from './pending-sis-accreditations-tile.component';

vi.mock('../../pending-sis-accreditations/pending-sis-accreditations.resource', async () => ({
  ...(await vi.importActual('../../pending-sis-accreditations/pending-sis-accreditations.resource')),
  usePendingSisAccreditations: vi.fn(),
}));

const mockUseConfig = vi.mocked(useConfig<ActiveVisitsConfigSchema>);
const mockUsePendingSisAccreditations = vi.mocked(usePendingSisAccreditations);

describe('PendingSisAccreditationsTile', () => {
  beforeEach(() => {
    mockUseConfig.mockReturnValue(getDefaultsFromConfigSchema(configSchema) as ActiveVisitsConfigSchema);
  });

  it('counts each pending patient once', () => {
    mockUsePendingSisAccreditations.mockReturnValue({
      pendingVisits: [
        { visitUuid: 'visit-1', patientUuid: 'patient-1' },
        { visitUuid: 'visit-2', patientUuid: 'patient-1' },
        { visitUuid: 'visit-3', patientUuid: 'patient-2' },
      ] as ReturnType<typeof usePendingSisAccreditations>['pendingVisits'],
      error: undefined,
      isLoading: false,
      isValidating: false,
    });

    render(<PendingSisAccreditationsTile />);

    expect(screen.getByText('Pacientes pendientes de acreditación')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('does not present a false zero while loading or after an error', () => {
    mockUsePendingSisAccreditations.mockReturnValue({
      pendingVisits: [],
      error: new Error('request failed'),
      isLoading: false,
      isValidating: false,
    });

    render(<PendingSisAccreditationsTile />);

    expect(screen.getByText('--')).toBeInTheDocument();
  });
});

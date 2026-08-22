import { getDefaultsFromConfigSchema, useConfig, useSession } from '@openmrs/esm-framework';
import { act, render, screen } from '@testing-library/react';

import { esmPatientRegistrationSchema, type RegistrationConfig } from '../config-schema';
import BulkPatientImportAdminCardLink from './bulk-patient-import-admin-card-link.component';

const mockUseConfig = vi.mocked(useConfig<RegistrationConfig>);
const mockUseSession = vi.mocked(useSession);

const approvedUserUuid = '11111111-1111-4111-8111-111111111111';
const approvedLocationUuid = '22222222-2222-4222-8222-222222222222';
const approvalCheckTime = '2026-08-21T12:00:00.000Z';
const approvalExpiresAt = '2026-08-21T12:30:00.000Z';

function getConfig(overrides: Partial<RegistrationConfig['bulkPatientImport']> = {}): RegistrationConfig {
  const defaults = getDefaultsFromConfigSchema(esmPatientRegistrationSchema) as RegistrationConfig;
  return {
    ...defaults,
    bulkPatientImport: {
      ...defaults.bulkPatientImport,
      enabled: true,
      approvedFileSha256: 'a'.repeat(64),
      approvedBuildSha: 'b'.repeat(40),
      approvedOrigin: globalThis.location.origin,
      approvalExpiresAt,
      approvedUserUuid,
      approvedLocationUuid,
      domicilioTarget: 'address4',
      ...overrides,
    },
  };
}

describe('BulkPatientImportAdminCardLink', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(approvalCheckTime);
    mockUseConfig.mockReturnValue(getConfig());
    mockUseSession.mockReturnValue({
      user: { uuid: approvedUserUuid },
      sessionLocation: { uuid: approvedLocationUuid },
    } as ReturnType<typeof useSession>);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not render when the one-time import is disabled', () => {
    mockUseConfig.mockReturnValue(getConfig({ enabled: false }));

    render(<BulkPatientImportAdminCardLink />);

    expect(screen.queryByText('Import patients')).not.toBeInTheDocument();
  });

  it.each([
    ['origin', { approvedOrigin: 'https://different.example' }, {}],
    ['user', {}, { user: { uuid: '33333333-3333-4333-8333-333333333333' } }],
    ['location', {}, { sessionLocation: { uuid: '44444444-4444-4444-8444-444444444444' } }],
  ] as const)('does not render when the approved %s does not match the session', (_name, configOverride, sessionOverride) => {
    mockUseConfig.mockReturnValue(getConfig(configOverride));
    mockUseSession.mockReturnValue({
      user: { uuid: approvedUserUuid },
      sessionLocation: { uuid: approvedLocationUuid },
      ...sessionOverride,
    } as ReturnType<typeof useSession>);

    render(<BulkPatientImportAdminCardLink />);

    expect(screen.queryByText('Import patients')).not.toBeInTheDocument();
  });

  it('renders only for the exact approved origin, user, and session location', () => {
    render(<BulkPatientImportAdminCardLink />);

    expect(screen.getByRole('link', { name: /import patients/i })).toHaveAttribute('href', '/spa/patient-import');
  });

  it('hides the card when the active one-time approval expires', () => {
    render(<BulkPatientImportAdminCardLink />);
    expect(screen.getByRole('link', { name: /import patients/i })).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(30 * 60 * 1000 + 1));

    expect(screen.queryByRole('link', { name: /import patients/i })).not.toBeInTheDocument();
  });

  it.each([
    ['invalid', '2026-08-21T12:30:00Z'],
    ['expired', approvalCheckTime],
  ])('does not render when the approval timestamp is %s', (_label, expiresAt) => {
    mockUseConfig.mockReturnValue(getConfig({ approvalExpiresAt: expiresAt }));

    render(<BulkPatientImportAdminCardLink />);

    expect(screen.queryByText('Import patients')).not.toBeInTheDocument();
  });
});

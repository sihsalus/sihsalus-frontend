import { useSession, userHasAccess } from '@openmrs/esm-framework';
import { MotherChildRelationships } from '@openmrs/esm-patient-common-lib';
import { render, screen } from '@testing-library/react';
import CaregiverScreening, { isCaregiverScreeningAge } from './caregiver-screening.component';

vi.mock('@openmrs/esm-patient-common-lib', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@openmrs/esm-patient-common-lib')>()),
  MotherChildRelationships: vi.fn(() => null),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (_key, fallback) => fallback }) }));
const birthDate = '2026-01-01';
it.each(['2026-01-30', '2027-01-01', '2028-01-01', '2029-01-01', '2030-01-01'])(
  'offers the adult reminder for the child age at %s',
  (referenceDate) => {
    expect(isCaregiverScreeningAge(birthDate, referenceDate)).toBe(true);
  },
);
it.each(['2026-01-15', '2026-03-05', '2026-12-01', '2031-01-01', 'invalid'])(
  'does not classify an unrelated or invalid child age as the adult screening period: %s',
  (referenceDate) => {
    expect(isCaregiverScreeningAge(birthDate, referenceDate)).toBe(false);
  },
);
it('uses native adult search and only explicit relationships without launching a form on the child', () => {
  vi.mocked(useSession).mockReturnValue({ authenticated: true, user: { uuid: 'synthetic-user' } } as never);
  vi.mocked(userHasAccess).mockReturnValue(true);
  render(<CaregiverScreening patientUuid="synthetic-child" birthDate={birthDate} referenceDate="2026-02-01" />);
  expect(screen.getByRole('link', { name: 'Buscar la historia del adulto identificado' })).toHaveAttribute(
    'href',
    `${window.getOpenmrsSpaBase()}search`,
  );
  expect(screen.getByText(/El vínculo de madre no identifica/)).toBeVisible();
  expect(MotherChildRelationships).toHaveBeenCalledWith(
    expect.objectContaining({ patientUuid: 'synthetic-child', patientRole: 'child', canView: true }),
    expect.anything(),
  );
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
it('does not expose search or enable relationship reading without chart access', () => {
  vi.mocked(useSession).mockReturnValue({ authenticated: true, user: { uuid: 'synthetic-user' } } as never);
  vi.mocked(userHasAccess).mockReturnValue(false);
  render(<CaregiverScreening patientUuid="synthetic-child" birthDate={birthDate} referenceDate="2026-02-01" />);
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
  expect(MotherChildRelationships).toHaveBeenLastCalledWith(
    expect.objectContaining({ canView: false }),
    expect.anything(),
  );
});

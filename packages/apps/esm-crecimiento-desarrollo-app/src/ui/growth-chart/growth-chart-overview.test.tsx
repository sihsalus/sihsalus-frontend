import { userHasAccess, useSession } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';

import { credNeonatalEditPrivilege } from '../../constants';
import GrowthChartOverview from './growth-chart-overview.component';
import { useBiometrics } from './hooks/useBiometrics';

vi.mock('./hooks/useBiometrics', () => ({
  useBiometrics: vi.fn(),
}));

const mockUseBiometrics = vi.mocked(useBiometrics);
const mockUseSession = vi.mocked(useSession);
const mockUserHasAccess = vi.mocked(userHasAccess);

const sessionWithEditPrivilege = {
  authenticated: true,
  user: { privileges: [{ display: credNeonatalEditPrivilege }] },
} as unknown as ReturnType<typeof useSession>;

const sessionWithoutPrivileges = {
  authenticated: true,
  user: { privileges: [] },
} as unknown as ReturnType<typeof useSession>;

const patient = {
  id: 'patient-1',
  gender: 'female',
  birthDate: '2025-06-01',
  name: [{ given: ['Niña'], family: 'Prueba' }],
} as unknown as fhir.Patient;

describe('GrowthChartOverview', () => {
  beforeEach(() => {
    mockUseBiometrics.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useBiometrics>);
    mockUserHasAccess.mockReturnValue(false);
  });

  it('offers to record data when the user has the neonatal edit privilege', () => {
    mockUseSession.mockReturnValue(sessionWithEditPrivilege);
    mockUserHasAccess.mockReturnValue(true);

    render(<GrowthChartOverview patient={patient} patientUuid="patient-1" />);

    expect(mockUserHasAccess).toHaveBeenCalledWith(credNeonatalEditPrivilege, sessionWithEditPrivilege.user);
    expect(screen.getByRole('button', { name: /record/i })).toBeInTheDocument();
  });

  it('hides the record action when the user lacks the neonatal edit privilege', () => {
    mockUseSession.mockReturnValue(sessionWithoutPrivileges);

    render(<GrowthChartOverview patient={patient} patientUuid="patient-1" />);

    expect(screen.queryByRole('button', { name: /record/i })).not.toBeInTheDocument();
    expect(screen.getByText(/there are no/i)).toBeInTheDocument();
  });

  it('warns instead of plotting when the patient has no valid birth date', () => {
    mockUseSession.mockReturnValue(sessionWithEditPrivilege);
    const patientWithoutBirthDate = { ...patient, birthDate: undefined } as unknown as fhir.Patient;

    render(<GrowthChartOverview patient={patientWithoutBirthDate} patientUuid="patient-1" />);

    expect(screen.getByText(/no se puede graficar/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /record/i })).not.toBeInTheDocument();
  });

  it('warns instead of plotting when the patient gender is not male or female', () => {
    mockUseSession.mockReturnValue(sessionWithEditPrivilege);
    const patientWithOtherGender = { ...patient, gender: 'other' } as unknown as fhir.Patient;

    render(<GrowthChartOverview patient={patientWithOtherGender} patientUuid="patient-1" />);

    expect(screen.getByText(/no se puede graficar/i)).toBeInTheDocument();
  });
});

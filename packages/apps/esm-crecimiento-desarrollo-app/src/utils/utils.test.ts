import { getPatientName } from '@openmrs/esm-framework';

import { getSafePatientName } from './utils';

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  getPatientName: vi.fn(),
}));

const mockGetPatientName = vi.mocked(getPatientName);

describe('getSafePatientName', () => {
  beforeEach(() => {
    mockGetPatientName.mockReset();
  });

  it('returns an empty string when the patient is missing', () => {
    expect(getSafePatientName(undefined)).toBe('');
    expect(getSafePatientName(null)).toBe('');
    expect(mockGetPatientName).not.toHaveBeenCalled();
  });

  it('delegates to framework getPatientName when the patient exists', () => {
    const patient = { id: 'patient-123' } as fhir.Patient;
    mockGetPatientName.mockReturnValue('Ada Lovelace');

    expect(getSafePatientName(patient)).toBe('Ada Lovelace');
    expect(mockGetPatientName).toHaveBeenCalledWith(patient);
  });
});

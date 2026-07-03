import { openmrsFetch, useConfig } from '@openmrs/esm-framework';
import { renderHook, waitFor } from '@testing-library/react';

import type { ConfigObject } from '../config-schema';
import useContacts from './useContacts';

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  openmrsFetch: vi.fn(),
  useConfig: vi.fn(),
}));

const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const mockUseConfig = vi.mocked(useConfig);

const indexPatientUuid = '11111111-1111-4111-8111-111111111111';
const patientRelativeUuid = '22222222-2222-4222-8222-222222222222';
const personRelativeUuid = '33333333-3333-4333-8333-333333333333';
const relationshipTypeUuid = '44444444-4444-4444-8444-444444444444';

const config = {
  pnsRelationships: [{ uuid: relationshipTypeUuid, display: 'Pareja', sexual: true }],
  contactPersonAttributesUuid: {
    telephone: 'telephone-attr-uuid',
    baselineHIVStatus: 'baseline-attr-uuid',
    contactCreated: 'contact-created-attr-uuid',
    preferedPnsAproach: 'pns-attr-uuid',
    livingWithContact: 'living-attr-uuid',
    contactipvOutcome: 'ipv-attr-uuid',
    dataConsent: 'consent-attr-uuid',
  },
} as ConfigObject;

function buildRelationship(overrides: Record<string, unknown>) {
  return {
    display: 'relationship',
    startDate: null,
    endDate: null,
    relationshipType: {
      uuid: relationshipTypeUuid,
      display: 'Pareja/Pareja',
      aIsToB: 'Pareja A',
      bIsToA: 'Pareja B',
      weight: 0,
    },
    ...overrides,
  };
}

describe('useContacts', () => {
  beforeEach(() => {
    mockUseConfig.mockReturnValue(config);
  });

  it('requests isPatient and the relationship type weight in the custom representation', async () => {
    mockOpenmrsFetch.mockResolvedValue({ data: { results: [] } } as never);

    const { result } = renderHook(() => useContacts(indexPatientUuid));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const requestedUrl = mockOpenmrsFetch.mock.calls[0][0] as string;
    expect(requestedUrl).toContain('isPatient');
    expect(requestedUrl).toContain('weight');
  });

  it('only assigns patientUuid when the relative actually is a patient', async () => {
    // SWR caches by URL across tests, so each test uses its own index patient uuid.
    const indexUuid = `${indexPatientUuid}-patient-detection`;
    mockOpenmrsFetch.mockResolvedValue({
      data: {
        results: [
          buildRelationship({
            uuid: 'rel-1',
            personA: { uuid: indexUuid, display: 'Index', isPatient: true, attributes: [] },
            personB: {
              uuid: patientRelativeUuid,
              display: 'Relative Patient',
              gender: 'F',
              age: 30,
              isPatient: true,
              attributes: [],
            },
          }),
          buildRelationship({
            uuid: 'rel-2',
            personA: { uuid: indexUuid, display: 'Index', isPatient: true, attributes: [] },
            personB: {
              uuid: personRelativeUuid,
              display: 'Relative Person Only',
              gender: 'M',
              age: 40,
              isPatient: false,
              attributes: [],
            },
          }),
        ],
      },
    } as never);

    const { result } = renderHook(() => useContacts(indexUuid));
    await waitFor(() => expect(result.current.contacts).toHaveLength(2));

    const [patientContact, personContact] = result.current.contacts;

    expect(patientContact.isPatient).toBe(true);
    expect(patientContact.patientUuid).toBe(patientRelativeUuid);

    expect(personContact.isPatient).toBe(false);
    expect(personContact.patientUuid).toBeNull();
    expect(personContact.relativeUuid).toBe(personRelativeUuid);
  });

  it('uses the direction-appropriate relationship label and maps weight to consanguinity degree', async () => {
    const indexUuid = `${indexPatientUuid}-direction`;
    mockOpenmrsFetch.mockResolvedValue({
      data: {
        results: [
          buildRelationship({
            uuid: 'rel-1',
            relationshipType: {
              uuid: relationshipTypeUuid,
              display: 'Madre/Hijo',
              aIsToB: 'Madre',
              bIsToA: 'Hijo',
              weight: 1,
            },
            // The index patient is personB, so the relative (personA) is their Madre.
            personA: { uuid: personRelativeUuid, display: 'Madre Person', isPatient: false, attributes: [] },
            personB: { uuid: indexUuid, display: 'Index', isPatient: true, attributes: [] },
          }),
        ],
      },
    } as never);

    const { result } = renderHook(() => useContacts(indexUuid));
    await waitFor(() => expect(result.current.contacts).toHaveLength(1));

    expect(result.current.contacts[0].relationshipType).toBe('Madre');
    expect(result.current.contacts[0].consanguinityDegree).toBe(1);
  });
});

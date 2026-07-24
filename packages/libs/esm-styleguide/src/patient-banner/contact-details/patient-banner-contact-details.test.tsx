import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { usePatient } from '@openmrs/esm-react-utils';
import { screen } from '@testing-library/react';
import { renderWithSwr } from '../../test-utils';
import { PatientBannerContactDetails } from './patient-banner-contact-details.component';
import { usePatientAttributes, usePatientContactAttributes } from './usePatientAttributes';
import { usePatientListsForPatient } from './usePatientListsForPatient';
import { useRelationships } from './useRelationships';

const mockUsePatient = vi.mocked(usePatient);
const mockUsePatientAttributes = vi.mocked(usePatientAttributes);
const mockUsePatientContactAttributes = vi.mocked(usePatientContactAttributes);
const mockUsePatientListsForPatient = vi.mocked(usePatientListsForPatient);
const mockUseRelationships = vi.mocked(useRelationships);

const mockRelationships = [
  {
    display: '100ADT - Amanda Robinson',
    name: 'Amanda Robinson',
    relationshipType: 'Sibling',
    relativeAge: 24,
    relativeUuid: '07006bcb-91d4-4c57-a5f7-49751899d9b5',
    uuid: '993bc79d-5ca5-4c76-b4b3-adf49e25bd0b',
  },
];

const mockPersonAttributes = [
  {
    display: 'Next of Kin Contact Phone Number = 0000000000',
    uuid: '1de1ac71-68e8-4a08-a7e2-5042093d4e46',
    value: '0700-000-000',
    attributeType: {
      uuid: 'a657a4f1-9c0f-444b-a1fd-445bb91dd12d',
      display: 'Next of Kin Contact Phone Number',
    },
  },
  {
    display: 'Phone number',
    uuid: 'asdflkjhasdf',
    value: '+0123456789',
    attributeType: {
      uuid: 'qweproiuqweproiu',
      display: 'Phone number',
    },
  },
];

const mockCohorts = [
  {
    uuid: 'fdc95682-e206-421b-9534-e2a4010cc05d',
    name: 'List three',
    startDate: '2023-04-19T23:26:27.000+0000',
    endDate: null,
  },
  {
    uuid: '1d48bec7-6aab-464c-ac16-687ba46e7812',
    name: ' Test patient List-47',
    startDate: '2023-04-24T23:28:49.000+0000',
    endDate: null,
  },
  {
    uuid: '6ce81b61-387d-43ab-86fb-606fa16d39dd',
    name: ' Test patient List-41',
    startDate: '2023-04-24T23:28:49.000+0000',
    endDate: null,
  },
  {
    uuid: '1361caf0-b3c3-4937-88e3-40074f7f3320',
    name: 'Potential Patients',
    startDate: '2023-06-07T15:40:00.000+0000',
    endDate: null,
  },
];

vi.mock('./usePatientAttributes', () => ({
  usePatientAttributes: vi.fn(),
  usePatientContactAttributes: vi.fn(),
}));

vi.mock('./usePatientListsForPatient', () => ({
  usePatientListsForPatient: vi.fn(),
}));

vi.mock('./useRelationships', () => ({
  useRelationships: vi.fn(),
}));

describe('ContactDetails', () => {
  beforeEach(() => {
    mockUsePatient.mockReturnValue({
      isLoading: false,
      patient: {
        address: [
          {
            city: 'Foo',
            country: 'Bar',
            id: '0000',
            postalCode: '00100',
            state: 'Quux',
            use: 'home',
          },
        ],
        telecom: [{ system: 'Cellular', value: '+0123456789' }],
      },
      patientUuid: '123e4567-e89b-12d3-a456-426614174000',
      error: null,
    });

    mockUsePatientContactAttributes.mockReturnValue({
      isLoading: false,
      contactAttributes: mockPersonAttributes,
      error: null,
    });

    mockUsePatientListsForPatient.mockReturnValue({
      isLoading: false,
      cohorts: mockCohorts,
    });

    mockUseRelationships.mockReturnValue({
      isLoading: false,
      data: mockRelationships,
      error: undefined,
      isValidating: false,
    });
  });

  it("renders the patient's address, contact details, patient lists, and relationships when available", async () => {
    renderWithSwr(<PatientBannerContactDetails patientId={'some-uuid'} deceased={false} />);

    expect(screen.getByText(/place of residence/i)).toBeInTheDocument();
    expect(screen.getByText(/contact details/i)).toBeInTheDocument();
    expect(screen.getByText(/familiares/i)).toBeInTheDocument();
    expect(screen.getByText(/Amanda Robinson/)).toBeInTheDocument();
    expect(screen.getByText(/Sibling/i)).toBeInTheDocument();
    expect(screen.getByText(/24 years/i)).toBeInTheDocument();
    expect(screen.getByText(/\+0123456789/i)).toBeInTheDocument();
    expect(screen.getByText(/Next of Kin Contact Phone Number/i)).toBeInTheDocument();
    expect(screen.getByText(/0700-000-000/)).toBeInTheDocument();
    expect(screen.getByText(/patient lists/i)).toBeInTheDocument();
    expect(screen.getByText(/Test patient List-47/)).toBeInTheDocument();
    expect(screen.getByText(/List three/)).toBeInTheDocument();
    expect(screen.getByText(/postal code/i)).toBeInTheDocument();
    expect(screen.getByText(/00100/)).toBeInTheDocument();
  });

  it('renders residence and birthplace separately without exposing internal address metadata', () => {
    const openmrsAddressExtensionUrl = 'http://openmrs.org/fhir/StructureDefinition/address';
    const openmrsAddressExtensions = (values: Record<string, string>) => ({
      url: openmrsAddressExtensionUrl,
      extension: Object.entries(values).map(([field, value]) => ({
        url: `${openmrsAddressExtensionUrl}#${field}`,
        valueString: value,
      })),
    });

    mockUsePatient.mockReturnValue({
      isLoading: false,
      patient: {
        address: [
          {
            city: 'Birth district',
            country: 'PERU',
            district: 'Birth province',
            extension: [
              openmrsAddressExtensions({
                address1: 'Birth populated center',
                address13: 'PERU|BIRTH REGION|BIRTH PROVINCE|BIRTH DISTRICT',
                address14: '1603030001',
                address15: 'SIHSALUS_BIRTH_ADDRESS',
              }),
            ],
            id: 'birth-address-uuid',
            state: 'Birth region',
            use: 'home',
          },
          {
            city: 'Residence district',
            country: 'PERU',
            district: 'Residence province',
            extension: [
              openmrsAddressExtensions({
                address1: 'Residence populated center',
                address2: 'Jr. Principal 123',
                address13: 'PERU|RESIDENCE REGION|RESIDENCE PROVINCE|RESIDENCE DISTRICT',
                address14: '090501',
              }),
            ],
            id: 'residence-address-uuid',
            state: 'Residence region',
            use: 'home',
          },
        ],
      },
      patientUuid: '123e4567-e89b-12d3-a456-426614174000',
      error: null,
    });

    renderWithSwr(<PatientBannerContactDetails patientId={'some-uuid'} deceased={false} />);

    expect(screen.getByText('Place of residence')).toBeInTheDocument();
    expect(screen.getByText('Place of birth')).toBeInTheDocument();
    expect(screen.getByText(/Residence populated center/)).toBeInTheDocument();
    expect(screen.getByText(/Jr. Principal 123/)).toBeInTheDocument();
    expect(screen.getByText(/Birth populated center/)).toBeInTheDocument();
    expect(screen.queryByText(/address13/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/address14/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/address15/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/PERU\|/)).not.toBeInTheDocument();
    expect(screen.queryByText(/1603030001|090501/)).not.toBeInTheDocument();
    expect(screen.queryByText(/SIHSALUS_BIRTH_ADDRESS/)).not.toBeInTheDocument();
  });

  it('patient related name should be a link', async () => {
    renderWithSwr(<PatientBannerContactDetails patientId={'some-uuid'} deceased={false} />);

    const relationship = screen.getByRole('link', { name: /Amanda Robinson/ });
    expect(relationship).toHaveAttribute('href', `/spa/patient/${mockRelationships[0].relativeUuid}/chart`);
  });

  it('renders an empty state view when contact details, relations, patient lists and addresses are not available', async () => {
    mockUsePatient.mockReturnValue({
      isLoading: false,
      patient: undefined,
      patientUuid: null,
      error: null,
    });

    mockUsePatientAttributes.mockReturnValue({
      isLoading: false,
      attributes: [],
      error: null,
    });

    mockUsePatientContactAttributes.mockReturnValue({
      isLoading: false,
      contactAttributes: [],
      error: null,
    });

    mockUsePatientListsForPatient.mockReturnValue({
      isLoading: false,
      cohorts: [],
    });

    mockUseRelationships.mockReturnValue({
      isLoading: false,
      data: [],
      error: undefined,
      isValidating: false,
    });

    renderWithSwr(<PatientBannerContactDetails patientId={'some-uuid'} deceased={false} />);

    expect(screen.getByText(/place of residence/i)).toBeInTheDocument();
    expect(screen.getByText(/familiares/i)).toBeInTheDocument();
    expect(screen.getByText(/contact details/i)).toBeInTheDocument();
    expect(screen.getByText(/patient lists/i)).toBeInTheDocument();
    expect(screen.getAllByText('--').length).toBe(4);
  });
});

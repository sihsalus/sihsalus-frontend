import { useConfig, usePatient } from '@openmrs/esm-framework';
import { act, render, screen, within } from '@testing-library/react';
import { type PropsWithChildren } from 'react';

import { type ConfigObject } from '../config-schema';
import { useEthnicIdentity } from '../hooks/useEthnicIdentity';
import { usePatientAdditionalAttributes, usePatientContactAttributes } from '../hooks/usePatientAttributes';
import { usePatientListsForPatient } from '../hooks/usePatientListsForPatient';
import { useRelationships } from '../hooks/useRelationships';

import { PatientBannerContactDetails } from './patient-banner-contact-details.component';

vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  ConfigurableLink: ({ children, to }: PropsWithChildren<{ to: string }>) => <a href={to}>{children}</a>,
  useConfig: vi.fn(),
  usePatient: vi.fn(),
}));

vi.mock('../hooks/useEthnicIdentity', () => ({
  useEthnicIdentity: vi.fn(),
}));

vi.mock('../hooks/usePatientAttributes', () => ({
  usePatientAdditionalAttributes: vi.fn(),
  usePatientContactAttributes: vi.fn(),
}));

vi.mock('../hooks/usePatientListsForPatient', () => ({
  usePatientListsForPatient: vi.fn(),
}));

vi.mock('../hooks/useRelationships', () => ({
  useRelationships: vi.fn(),
}));

const mockUseConfig = vi.mocked(useConfig);
const mockUseEthnicIdentity = vi.mocked(useEthnicIdentity);
const mockUsePatient = vi.mocked(usePatient);
const mockUsePatientAdditionalAttributes = vi.mocked(usePatientAdditionalAttributes);
const mockUsePatientContactAttributes = vi.mocked(usePatientContactAttributes);
const mockUsePatientListsForPatient = vi.mocked(usePatientListsForPatient);
const mockUseRelationships = vi.mocked(useRelationships);

const patientId = 'patient-123';

const loadedPerson = {
  age: 32,
  attributes: [],
  birthdate: '1994-01-01',
  display: 'Maria Perez',
  gender: 'F',
  preferredAddress: null,
  uuid: patientId,
};

describe('PatientBannerContactDetails', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockUseConfig.mockReturnValue({
      additionalAttributeTypes: [],
      contactAttributeTypes: [],
      ethnicIdentityConceptUuid: '',
      printPatientSticker: {
        fields: [],
        header: {
          logo: '',
          showBarcode: true,
          showLogo: false,
        },
        identifiersToDisplay: [],
        pageSize: 'A4',
        printScale: '1',
      },
      useRelationshipNameLink: false,
    } as ConfigObject);
    mockUsePatient.mockReturnValue({
      isLoading: false,
      patient: { address: [] },
    } as ReturnType<typeof usePatient>);
    mockUseEthnicIdentity.mockReturnValue({
      currentValue: null,
      isLoading: false,
    } as ReturnType<typeof useEthnicIdentity>);
    mockUsePatientContactAttributes.mockReturnValue({
      contactAttributes: [],
      isLoading: false,
    });
    mockUsePatientListsForPatient.mockReturnValue({
      cohorts: [],
      isLoading: false,
    });
    mockUsePatientAdditionalAttributes.mockReturnValue({
      additionalAttributes: [],
      identifiers: [],
      isLoading: false,
      person: loadedPerson,
    });
    mockUseRelationships.mockReturnValue({
      data: [],
      isLoading: false,
    } as ReturnType<typeof useRelationships>);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('stops showing infinite loading for identifiers and relationships', () => {
    mockUsePatientAdditionalAttributes.mockReturnValue({
      additionalAttributes: [],
      identifiers: [],
      isLoading: true,
      person: null,
    });
    mockUseRelationships.mockReturnValue({
      data: null,
      isLoading: true,
    } as ReturnType<typeof useRelationships>);

    render(<PatientBannerContactDetails patientId={patientId} deceased={false} />);

    const identifiersSection = screen.getByText('Identifiers').parentElement;
    const relationshipsSection = screen.getByText('Relationships').parentElement;
    expect(within(identifiersSection!).getByRole('progressbar')).toBeInTheDocument();
    expect(within(relationshipsSection!).getByRole('progressbar')).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(10000));

    expect(within(identifiersSection!).queryByRole('progressbar')).not.toBeInTheDocument();
    expect(within(identifiersSection!).getByText('--')).toBeInTheDocument();
    expect(within(relationshipsSection!).queryByRole('progressbar')).not.toBeInTheDocument();
    expect(within(relationshipsSection!).getByText('--')).toBeInTheDocument();
    expect(screen.getByText(/Status:\s*--/i)).toBeInTheDocument();
  });

  it('renders identifiers and relationships when data arrives after the timeout fallback', () => {
    mockUsePatientAdditionalAttributes.mockReturnValue({
      additionalAttributes: [],
      identifiers: [],
      isLoading: true,
      person: null,
    });
    mockUseRelationships.mockReturnValue({
      data: null,
      isLoading: true,
    } as ReturnType<typeof useRelationships>);

    const { rerender } = render(<PatientBannerContactDetails patientId={patientId} deceased={false} />);

    act(() => vi.advanceTimersByTime(10000));

    mockUsePatientAdditionalAttributes.mockReturnValue({
      additionalAttributes: [],
      identifiers: [
        {
          identifier: '12345678',
          identifierType: { name: 'DNI', uuid: 'dni-uuid' },
          preferred: true,
          uuid: 'identifier-uuid',
        },
      ],
      isLoading: false,
      person: loadedPerson,
    });
    mockUseRelationships.mockReturnValue({
      data: [
        {
          display: 'Juan Perez',
          relationshipType: 'Father',
          relativeAge: 60,
          relativeUuid: 'relative-uuid',
          uuid: 'relationship-uuid',
        },
      ],
      isLoading: false,
    } as ReturnType<typeof useRelationships>);

    rerender(<PatientBannerContactDetails patientId={patientId} deceased={false} />);

    expect(screen.getByText(/DNI: 12345678/i)).toBeInTheDocument();
    expect(screen.getByText(/Preferred/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Juan Perez' })).toBeInTheDocument();
    expect(screen.getByText('Father')).toBeInTheDocument();
  });
});

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
  ...((await vi.importActual('@openmrs/esm-framework')) as object),
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
    vi.setSystemTime(new Date('2026-06-18T12:00:00Z'));
    mockUseConfig.mockReturnValue({
      additionalAttributeTypes: [],
      birthplaceAttributeTypeUuid: '8d8718c2-c2cc-11de-8d13-0010c6dffd0f',
      contactAttributeTypes: [],
      ethnicIdentityAttributeTypeUuid: '8d871386-c2cc-11de-8d13-0010c6dffd0f',
      ethnicIdentityConceptUuid: '',
      occupationAttributeTypeUuid: '8d871afc-c2cc-11de-8d13-0010c6dffd0f',
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

  it('does not render technical address metadata used for UBIGEO persistence', () => {
    mockUsePatient.mockReturnValue({
      isLoading: false,
      patient: {
        address: [
          {
            country: 'PERU',
            extension: [
              {
                url: 'http://openmrs.org/fhir/StructureDefinition/address',
                extension: [
                  {
                    url: 'http://openmrs.org/fhir/StructureDefinition/address#address1',
                    valueString: 'UCAYALI',
                  },
                  {
                    url: 'http://openmrs.org/fhir/StructureDefinition/address#address13',
                    valueString: 'PERU|UCAYALI|ATALAYA|RAYMONDI|AGUAJAL',
                  },
                  {
                    url: 'http://openmrs.org/fhir/StructureDefinition/address#address14',
                    valueString: '2502010191',
                  },
                ],
              },
            ],
            use: 'home',
          },
        ],
      },
    } as ReturnType<typeof usePatient>);

    render(<PatientBannerContactDetails patientId={patientId} deceased={false} />);

    expect(screen.getByText('UCAYALI')).toBeInTheDocument();
    expect(screen.queryByText('2502010191')).not.toBeInTheDocument();
    expect(screen.queryByText('PERU|UCAYALI|ATALAYA|RAYMONDI|AGUAJAL')).not.toBeInTheDocument();
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
    if (!identifiersSection || !relationshipsSection) {
      throw new Error('Expected identifiers and relationships sections to render');
    }

    expect(within(identifiersSection).getByRole('progressbar')).toBeInTheDocument();
    expect(within(relationshipsSection).getByRole('progressbar')).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(10000));

    expect(within(identifiersSection).queryByRole('progressbar')).not.toBeInTheDocument();
    expect(within(identifiersSection).getByText('No identifiers recorded')).toBeInTheDocument();
    expect(within(relationshipsSection).queryByRole('progressbar')).not.toBeInTheDocument();
    expect(within(relationshipsSection).getByText('No relationships recorded')).toBeInTheDocument();
    expect(screen.getByText('No demographics recorded')).toBeInTheDocument();
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
          dni: '76543210',
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

    const identifiersSection = screen.getByText('Identifiers').parentElement;
    const relationshipsSection = screen.getByText('Relationships').parentElement;
    if (!identifiersSection || !relationshipsSection) {
      throw new Error('Expected identifiers and relationships sections to render');
    }

    expect(within(identifiersSection).getByText('DNI:').closest('li')).toHaveTextContent(/DNI:\s*12345678/i);
    expect(screen.getByText(/Preferred/i)).toBeInTheDocument();
    expect(within(relationshipsSection).getByRole('link', { name: 'Juan Perez' })).toBeInTheDocument();
    expect(within(relationshipsSection).getByText('Juan Perez').closest('li')).toHaveTextContent(
      /Relationship:\s*Father.*DNI:\s*76543210.*Age:\s*60 yrs/,
    );
  });

  it('renders demographic age with year, month, or week units', () => {
    for (const { birthdate, expectedAge } of [
      { birthdate: '2010-06-16', expectedAge: /16 years/i },
      { birthdate: '2025-06-16', expectedAge: /12 months/i },
      { birthdate: '2026-05-28', expectedAge: /3 weeks/i },
      { birthdate: '2026-05-18', expectedAge: /4 weeks/i },
    ]) {
      mockUsePatientAdditionalAttributes.mockReturnValue({
        additionalAttributes: [],
        identifiers: [],
        isLoading: false,
        person: {
          ...loadedPerson,
          birthdate,
        },
      });

      const { unmount } = render(<PatientBannerContactDetails patientId={patientId} deceased={false} />);

      expect(screen.getByText('Age:').closest('li')).toHaveTextContent(expectedAge);
      unmount();
    }
  });

  it('renders affiliation details without duplicating ethnicity in contact details', () => {
    mockUseEthnicIdentity.mockReturnValue({
      currentValue: 'Ashaninka',
      isLoading: false,
    } as ReturnType<typeof useEthnicIdentity>);
    mockUsePatientContactAttributes.mockReturnValue({
      contactAttributes: [
        {
          attributeType: { display: 'Phone', uuid: 'phone-uuid' },
          display: 'Phone = 999999999',
          uuid: 'phone',
          value: '999999999',
        },
      ],
      isLoading: false,
    });
    mockUsePatientAdditionalAttributes.mockReturnValue({
      additionalAttributes: [
        {
          attributeType: { display: 'Etnia', uuid: '8d871386-c2cc-11de-8d13-0010c6dffd0f' },
          display: 'Etnia = Ashaninka',
          uuid: 'ethnicity',
          value: 'Ashaninka',
        },
        {
          attributeType: { display: 'Ocupacion', uuid: '8d871afc-c2cc-11de-8d13-0010c6dffd0f' },
          display: 'Ocupacion = Agricultor',
          uuid: 'occupation',
          value: 'Agricultor',
        },
        {
          attributeType: { display: 'Lugar de nacimiento', uuid: '8d8718c2-c2cc-11de-8d13-0010c6dffd0f' },
          display: 'Lugar de nacimiento = Loreto - Maynas',
          uuid: 'birthplace',
          value: 'Loreto - Maynas',
        },
      ],
      identifiers: [],
      isLoading: false,
      person: loadedPerson,
    });

    render(<PatientBannerContactDetails patientId={patientId} deceased={false} />);

    const contactSection = screen.getByText('Contact details').parentElement;
    const additionalSection = screen.getByText('Additional details').parentElement;
    if (!contactSection || !additionalSection) {
      throw new Error('Expected contact and additional details sections to render');
    }

    expect(within(contactSection).queryByText('Ethnicity:')).not.toBeInTheDocument();
    expect(within(additionalSection).getByText('Ethnicity:').closest('li')).toHaveTextContent(/Ashaninka/);
    expect(within(additionalSection).getByText('Occupation:').closest('li')).toHaveTextContent(/Agricultor/);
    expect(within(additionalSection).getByText('Place of birth:').closest('li')).toHaveTextContent(/Loreto - Maynas/);
  });
});

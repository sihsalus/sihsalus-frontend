import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { useConfig, usePrimaryIdentifierCode } from '@openmrs/esm-react-utils';
import { render, screen } from '@testing-library/react';
import PatientBannerPatientIdentifiers from './patient-banner-patient-identifiers.component';

const mockUsePrimaryIdentifierCode = vi.mocked(usePrimaryIdentifierCode);
const mockUseConfig = vi.mocked(useConfig);

describe('PatientBannerPatientIdentifiers', () => {
  const mockIdentifiers = [
    {
      use: 'official',
      type: {
        coding: [{ code: '05a29f94-c0ed-11e2-94be-8c13b969e334' }],
        text: 'OpenMRS ID',
      },
      value: '100GEJ',
    },
    {
      use: 'official',
      type: {
        coding: [{ code: '4281ec43-388b-4c25-8bb2-deaff0867b2c' }],
        text: 'National ID',
      },
      value: '123456789',
    },
  ];

  beforeEach(() => {
    mockUsePrimaryIdentifierCode.mockReturnValue({
      primaryIdentifierCode: '05a29f94-c0ed-11e2-94be-8c13b969e334',
      isLoading: false,
      error: undefined,
    });
    mockUseConfig.mockReturnValue({
      excludePatientIdentifierCodeTypes: { uuids: [] },
    });
  });

  it('renders the patient identifiers', async () => {
    render(<PatientBannerPatientIdentifiers identifiers={mockIdentifiers} showIdentifierLabel />);

    expect(screen.getByText(/openmrs id/i)).toBeInTheDocument();
    expect(screen.getByText(/100gej/i)).toBeInTheDocument();
    expect(screen.getByText(/national id/i)).toBeInTheDocument();
    expect(screen.getByText(/123456789/i)).toBeInTheDocument();
  });

  it('does not render identifier labels if showIdentifierLabel is false', () => {
    render(<PatientBannerPatientIdentifiers identifiers={mockIdentifiers} showIdentifierLabel={false} />);

    expect(screen.queryByText(/openmrs id/i)).not.toBeInTheDocument();
    expect(screen.getByText(/100gej/i)).toBeInTheDocument();
    expect(screen.queryByText(/national id/i)).not.toBeInTheDocument();
    expect(screen.getByText(/123456789/i)).toBeInTheDocument();
  });

  it('renders nothing if identifiers are not provided', () => {
    const { container } = render(<PatientBannerPatientIdentifiers identifiers={[]} showIdentifierLabel />);

    expect(container).toBeEmptyDOMElement();
  });

  it('filters out excluded identifier types', () => {
    mockUseConfig.mockReturnValue({
      excludePatientIdentifierCodeTypes: { uuids: ['4281ec43-388b-4c25-8bb2-deaff0867b2c'] },
    });

    render(<PatientBannerPatientIdentifiers identifiers={mockIdentifiers} showIdentifierLabel />);

    expect(screen.getByText(/openmrs id/i)).toBeInTheDocument();
    expect(screen.queryByText(/national id/i)).not.toBeInTheDocument();
  });

  it('highlights DNI instead of the primary identifier when DNI is present', () => {
    const identifiersWithDni = [
      {
        use: 'official',
        type: {
          coding: [{ code: '05a29f94-c0ed-11e2-94be-8c13b969e334' }],
          text: 'N° Historia Clínica',
        },
        value: '100000',
      },
      {
        use: 'official',
        type: {
          coding: [{ code: '550e8400-e29b-41d4-a716-446655440001' }],
          text: 'DNI',
        },
        value: '12345678',
      },
    ];

    render(<PatientBannerPatientIdentifiers identifiers={identifiersWithDni} showIdentifierLabel />);

    expect(screen.getByText('100000').closest('.secondaryIdentifier')).toBeInTheDocument();
    expect(screen.getByText('12345678').closest('.primaryIdentifier')).toBeInTheDocument();
  });
});

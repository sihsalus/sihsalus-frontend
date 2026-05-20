import { formatDatetime, parseDate, useVisit } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import { mockCurrentVisit, mockPatient } from 'test-utils';
import VisitTag from './visit-tag.extension';

const mockUseVisit = vi.mocked(useVisit);

describe('VisitBannerTag', () => {
  it('renders an active visit tag when an active visit is ongoing', () => {
    mockUseVisit.mockReturnValue({
      activeVisit: mockCurrentVisit,
      currentVisit: mockCurrentVisit,
      currentVisitIsRetrospective: false,
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    });

    const patient = { ...mockPatient, deceasedDateTime: null } as unknown as fhir.Patient;
    render(<VisitTag patientUuid={mockPatient.id} patient={patient} />);

    const visitMetadata =
      mockCurrentVisit.visitType.display +
      ' Started: ' +
      formatDatetime(parseDate(mockCurrentVisit.startDatetime), { mode: 'wide' });

    expect(
      screen.getByRole('tooltip', {
        name: visitMetadata,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Active Visit/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Retrospective Entry/i })).not.toBeInTheDocument();
  });

  it('should not render active visit tag for deceased patients', () => {
    mockUseVisit.mockReturnValue({
      activeVisit: mockCurrentVisit,
      currentVisit: mockCurrentVisit,
      currentVisitIsRetrospective: false,
      error: null,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    });

    const patient = { ...mockPatient, deceasedDateTime: '2002-04-04' } as unknown as fhir.Patient;

    render(<VisitTag patientUuid={mockPatient.id} patient={patient} />);

    expect(screen.queryByRole('button', { name: /Active Visit/i })).not.toBeInTheDocument();
  });
});

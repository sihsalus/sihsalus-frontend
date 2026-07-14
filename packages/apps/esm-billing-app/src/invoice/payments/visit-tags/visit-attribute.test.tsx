import { render, screen } from '@testing-library/react';

import { usePatientPaymentInfo } from '../../../billing.resource';
import VisitAttributeTags from './visit-attribute.component';

vi.mock('../../../billing.resource', () => ({
  usePatientPaymentInfo: vi.fn(),
}));

const mockUsePatientPaymentInfo = vi.mocked(usePatientPaymentInfo);

describe('VisitAttributeTags', () => {
  it('renders the display text of a coded visit attribute', () => {
    mockUsePatientPaymentInfo.mockReturnValue([
      {
        name: 'Insurance scheme',
        uuid: 'insurance-attribute-uuid',
        value: {
          uuid: 'concept-uuid',
          display: 'SIS',
          name: 'SIS',
          datatype: { display: 'Coded' },
          conceptClass: { display: 'Misc' },
        },
      },
    ]);

    render(<VisitAttributeTags patientUuid="patient-uuid" />);

    expect(screen.getByText('Insurance scheme')).toBeInTheDocument();
    expect(screen.getByText('SIS')).toBeInTheDocument();
  });

  it('continues rendering primitive visit attribute values', () => {
    mockUsePatientPaymentInfo.mockReturnValue([
      {
        name: 'Policy number',
        uuid: 'policy-number-attribute-uuid',
        value: 'POL-123',
      },
    ]);

    render(<VisitAttributeTags patientUuid="patient-uuid" />);

    expect(screen.getByText('POL-123')).toBeInTheDocument();
  });
});

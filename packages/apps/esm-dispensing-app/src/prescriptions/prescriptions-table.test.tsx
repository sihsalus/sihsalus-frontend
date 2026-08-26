import { useConfig } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import { usePrescriptionsTable } from '../medication-request/medication-request.resource';
import PrescriptionsTable from './prescriptions-table.component';

vi.mock('../medication-request/medication-request.resource');
vi.mock('../patient/patient-info-cell.component', () => ({
  default: ({ patient }) => <span>{patient.name}</span>,
}));
vi.mock('./prescription-expanded.component', () => ({
  default: () => <div>Expanded prescription</div>,
}));

const mockUseConfig = vi.mocked(useConfig);
const mockUsePrescriptionsTable = vi.mocked(usePrescriptionsTable);

describe('PrescriptionsTable', () => {
  beforeEach(() => {
    mockUseConfig.mockReturnValue({
      locationBehavior: { locationColumn: { enabled: false } },
      medicationRequestExpirationPeriodInDays: 90,
      refreshInterval: 10000,
    });
    mockUsePrescriptionsTable.mockReturnValue({
      prescriptionsTableRows: [
        {
          id: 'synthetic-encounter',
          created: '2026-08-25T08:00:00-05:00',
          patient: { name: 'Paciente Sintético', uuid: 'synthetic-patient' },
          prescriber: 'Profesional Sintético',
          drugs: 'Amoxicilina 500 mg; Paracetamol 500 mg',
          lastDispenser: null,
          status: 'active',
          location: null,
        },
      ],
      error: undefined,
      isLoading: false,
      totalOrders: 1,
    });
  });

  it('labels and lists the prescribed medication orders clearly', () => {
    render(<PrescriptionsTable debouncedSearchTerm="" loadData locations={[]} />);

    expect(screen.getByRole('columnheader', { name: /Date prescribed/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Prescribed by/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Prescribed medications/ })).toBeInTheDocument();

    const medications = screen.getByRole('list', { name: 'Prescribed medications' });
    expect(medications).toHaveTextContent('Amoxicilina 500 mg');
    expect(medications).toHaveTextContent('Paracetamol 500 mg');
    expect(medications.querySelectorAll('li')).toHaveLength(2);

    expect(screen.getByText('active')).toHaveClass('cds--tag__label');
    expect(screen.getByText('active').closest('.cds--tag')).toHaveClass('cds--tag--blue');
  });
});

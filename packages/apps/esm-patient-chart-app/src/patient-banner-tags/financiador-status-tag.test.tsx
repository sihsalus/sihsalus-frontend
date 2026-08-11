import { useVisitOrOfflineVisit } from '@openmrs/esm-patient-common-lib';
import { render, screen } from '@testing-library/react';
import React from 'react';
import FinanciadorStatusTag, { getAccreditationTagType } from './financiador-status-tag.extension';

vi.mock('@openmrs/esm-patient-common-lib', async () => ({
  ...(await vi.importActual('@openmrs/esm-patient-common-lib')),
  useVisitOrOfflineVisit: vi.fn(),
}));

const mockUseVisitOrOfflineVisit = vi.mocked(useVisitOrOfflineVisit);

const FINANCIADOR_TYPE = '3a988e33-a6c0-4b76-b924-01abb998944b';
const STATUS_TYPE = '5e13e902-2030-4f65-b9d5-9a4810c9a603';

function visitWith(attributes: Array<{ type: string; display: string }>) {
  return {
    currentVisit: {
      voided: false,
      attributes: attributes.map(({ type, display }) => ({
        uuid: `attr-${type}`,
        attributeType: { uuid: type },
        value: { display },
      })),
    },
  } as unknown as ReturnType<typeof useVisitOrOfflineVisit>;
}

describe('getAccreditationTagType', () => {
  it.each([
    ['Acreditación vigente', 'green'],
    ['Vigente', 'green'],
    ['No vigente', 'red'],
    ['Acreditación no vigente', 'red'],
    ['Pendiente', 'gray'],
    ['No consultada', 'gray'],
    [null, 'gray'],
  ])('maps %s to %s', (display, expected) => {
    expect(getAccreditationTagType(display)).toBe(expected);
  });
});

describe('FinanciadorStatusTag', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders one tag with the financer as label and the accreditation as color', () => {
    mockUseVisitOrOfflineVisit.mockReturnValue(
      visitWith([
        { type: FINANCIADOR_TYPE, display: 'Seguro Integral de Salud (SIS)' },
        { type: STATUS_TYPE, display: 'Acreditación vigente' },
      ]),
    );

    render(<FinanciadorStatusTag patientUuid="patient-uuid" />);

    const tag = screen.getByText('Seguro Integral de Salud (SIS)');
    expect(tag).toBeInTheDocument();
    expect(tag.closest('.cds--tag')).toHaveClass('cds--tag--green');
    // The status stays reachable without its own tag.
    expect(screen.queryByText('Acreditación vigente')).not.toBeInTheDocument();
  });

  it('turns red when the accreditation is not current', () => {
    mockUseVisitOrOfflineVisit.mockReturnValue(
      visitWith([
        { type: FINANCIADOR_TYPE, display: 'Seguro Integral de Salud (SIS)' },
        { type: STATUS_TYPE, display: 'No vigente' },
      ]),
    );

    render(<FinanciadorStatusTag patientUuid="patient-uuid" />);

    expect(screen.getByText('Seguro Integral de Salud (SIS)').closest('.cds--tag')).toHaveClass('cds--tag--red');
  });

  it('stays gray while the accreditation is not validated yet', () => {
    mockUseVisitOrOfflineVisit.mockReturnValue(
      visitWith([{ type: FINANCIADOR_TYPE, display: 'Seguro Integral de Salud (SIS)' }]),
    );

    render(<FinanciadorStatusTag patientUuid="patient-uuid" />);

    expect(screen.getByText('Seguro Integral de Salud (SIS)').closest('.cds--tag')).toHaveClass('cds--tag--gray');
  });

  it('renders nothing without a financer attribute', () => {
    mockUseVisitOrOfflineVisit.mockReturnValue(visitWith([{ type: STATUS_TYPE, display: 'Vigente' }]));

    const { container } = render(<FinanciadorStatusTag patientUuid="patient-uuid" />);

    expect(container).toBeEmptyDOMElement();
  });
});

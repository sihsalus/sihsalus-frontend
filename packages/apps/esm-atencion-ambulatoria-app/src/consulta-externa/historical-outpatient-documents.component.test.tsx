import { useConfig, type Visit } from '@openmrs/esm-framework';
import { render, screen } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { consultaExternaPrivilege, patientVisitsPrivilege } from '../utils/constants';
import HistoricalOutpatientDocuments from './historical-outpatient-documents.component';
import OutpatientVisitSummaryDownload from './outpatient-visit-summary-download.component';

const deniedPrivileges = new Set<string>();
vi.mock('@sihsalus/esm-rbac', () => ({
  RequirePrivilege: ({ privilege, children }: PropsWithChildren<{ privilege: string[] }>) =>
    privilege.some((value) => deniedPrivileges.has(value)) ? null : children,
}));
vi.mock('./outpatient-visit-summary-download.component', () => ({
  default: vi.fn(() => <div>Historical document actions</div>),
}));

const visit = {
  uuid: 'historical-visit',
  startDatetime: '2025-01-01T10:00:00Z',
  stopDatetime: '2025-01-01T11:00:00Z',
  visitType: { uuid: 'outpatient-type' },
} as Visit;

beforeEach(() => {
  deniedPrivileges.clear();
  vi.mocked(useConfig).mockReturnValue({ visitTypes: { ambulatory: 'outpatient-type' } });
});

it('uses the explicitly selected finalized visit and explains the historical copy', () => {
  render(<HistoricalOutpatientDocuments patientUuid="patient-uuid" visit={visit} />);
  expect(screen.getByText(/Copia informativa de una consulta finalizada/)).toBeInTheDocument();
  expect(vi.mocked(OutpatientVisitSummaryDownload).mock.calls[0][0]).toEqual({
    patientUuid: 'patient-uuid',
    historicalVisitUuid: 'historical-visit',
  });
});

it.each([consultaExternaPrivilege, patientVisitsPrivilege])('requires the read privilege %s', (privilege) => {
  deniedPrivileges.add(privilege);
  render(<HistoricalOutpatientDocuments patientUuid="patient-uuid" visit={visit} />);
  expect(OutpatientVisitSummaryDownload).not.toHaveBeenCalled();
});

it.each([
  { ...visit, stopDatetime: null },
  { ...visit, visitType: { uuid: 'inpatient-type' } },
  { ...visit, stopDatetime: 'invalid' },
])('does not offer historical documents for an unsupported visit', (unsupportedVisit) => {
  render(<HistoricalOutpatientDocuments patientUuid="patient-uuid" visit={unsupportedVisit as Visit} />);
  expect(screen.getByText(/Seleccione una consulta ambulatoria finalizada/)).toBeInTheDocument();
  expect(OutpatientVisitSummaryDownload).not.toHaveBeenCalled();
});

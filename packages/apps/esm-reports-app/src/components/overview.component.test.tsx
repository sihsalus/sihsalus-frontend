import { useConfig, useSession } from '@openmrs/esm-framework';
import { screen, waitFor } from '@testing-library/react';
import React from 'react';
import { mockSession, renderWithSwr } from 'test-utils';

import OverviewComponent from './overview.component';
import { useReports } from './reports.resource';

void React;

const mockReports = [
  {
    id: 'report-1',
    reportName: 'OPD/IPD Report',
    status: 'FAILED',
    requestedBy: 'RUHINYURAMPUNZI RUHINYURAMPUNZI RUHINYURAMPUNZI',
    requestedByUserUuid: mockSession.data.user.uuid,
    requestedOn: '2025-11-12 12:00',
    outputFormat: 'CsvReportRenderer',
    parameters: 'startDate: 2025-05-06, endDate: 2025-05-06, department: Pediatric Service',
    evaluateCompleteDatetime: '',
    schedule: '',
  },
  {
    id: 'report-2',
    reportName: 'OPD/IPD Report',
    status: 'FAILED',
    requestedBy: 'RUHINYURAMPUNZI RUHINYURAMPUNZI RUHINYURAMPUNZI',
    requestedByUserUuid: mockSession.data.user.uuid,
    requestedOn: '2025-11-11 12:00',
    outputFormat: 'CsvReportRenderer',
    parameters: 'startDate: 2025-05-06, endDate: 2025-05-06, department: Pediatric Service',
    evaluateCompleteDatetime: '',
    schedule: '',
  },
  {
    id: 'report-3',
    reportName: 'OPD/IPD Report',
    status: 'FAILED',
    requestedBy: 'RUHINYURAMPUNZI RUHINYURAMPUNZI RUHINYURAMPUNZI',
    requestedByUserUuid: mockSession.data.user.uuid,
    requestedOn: '2025-11-10 12:00',
    outputFormat: 'CsvReportRenderer',
    parameters: 'startDate: 2025-05-06, endDate: 2025-05-06, department: Pediatric Service',
    evaluateCompleteDatetime: '',
    schedule: '',
  },
  {
    id: 'report-4',
    reportName: 'Generic Encounter Report',
    status: 'COMPLETED',
    requestedBy: 'Admin User',
    requestedByUserUuid: mockSession.data.user.uuid,
    requestedOn: '2025-11-13 10:30',
    outputFormat: 'Web Preview',
    parameters: 'startDate: 2025-11-01, endDate: 2025-11-13, location: Main Clinic',
    evaluateCompleteDatetime: '',
    schedule: '',
  },
  {
    id: 'report-5',
    reportName: 'Patient Demographics Report',
    status: 'COMPLETED',
    requestedBy: 'System Administrator',
    requestedByUserUuid: mockSession.data.user.uuid,
    requestedOn: '2025-11-13 09:15',
    outputFormat: 'Generic Encounter Report.xls',
    parameters: 'location: All Locations, ageGroup: Adult',
    evaluateCompleteDatetime: '',
    schedule: '',
  },
];

// Mock dependencies
vi.mock('@openmrs/esm-framework', async () => ({
  ...(await vi.importActual('@openmrs/esm-framework')),
  openmrsFetch: vi.fn(),
  useConfig: vi.fn(),
  useSession: vi.fn(),
  useLayoutType: vi.fn(() => 'desktop'),
  isDesktop: vi.fn(() => true),
  userHasAccess: vi.fn(() => true),
  ExtensionSlot: vi.fn(({ name }) => <div data-testid={`extension-slot-${name}`} />),
  navigate: vi.fn(),
  showModal: vi.fn(),
  getGlobalStore: vi.fn(() => ({
    getState: vi.fn(),
    setState: vi.fn(),
    subscribe: vi.fn(),
  })),
}));

const mockUseReports = vi.mocked(useReports);

vi.mock('./reports.resource', () => ({
  useReports: vi.fn(),
  downloadReport: vi.fn(),
  downloadMultipleReports: vi.fn(),
  preserveReport: vi.fn(),
}));

const mockUseSession = vi.mocked(useSession);

const mockUseConfig = useConfig as vi.Mock;

describe('OverviewComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue(mockSession.data);
  });

  it('should show View button for Web Preview reports', async () => {
    mockUseConfig.mockReturnValue({
      webPreviewViewReportUrl: 'https://example.com/view/{reportRequestUuid}',
    });

    mockUseReports.mockReturnValue({
      reports: mockReports,
      reportsTotalCount: mockReports.length,
      error: null,
      isValidating: false,
      mutateReports: vi.fn(),
    });

    renderWithSwr(<OverviewComponent />);

    // Wait for the component to render
    await waitFor(() => {
      expect(screen.getByText('Actions')).toBeInTheDocument();
    });

    const expectedColumnHeaders = [
      /report name/i,
      /status/i,
      /requested by/i,
      /requested on/i,
      /output format/i,
      /actions/i,
    ];

    expectedColumnHeaders.forEach((header) => {
      expect(screen.getByRole('columnheader', { name: new RegExp(header, 'i') })).toBeInTheDocument();
    });

    expect(screen.getAllByRole('row')).toHaveLength(6);
    expect(screen.getAllByRole('button', { name: /^Delete$/i })).toHaveLength(5);
  });

  it('should show Download button when webPreviewViewReportUrl is NOT configured', async () => {
    mockUseConfig.mockReturnValue({
      webPreviewViewReportUrl: '', // No URL configured
    });

    mockUseReports.mockReturnValue({
      reports: mockReports,
      reportsTotalCount: mockReports.length,
      error: null,
      isValidating: false,
      mutateReports: vi.fn(),
    });

    renderWithSwr(<OverviewComponent />);

    // Wait for the component to render
    await waitFor(() => {
      expect(screen.getByText('Actions')).toBeInTheDocument();
    });

    // Validate table headers
    const expectedColumnHeaders = [
      /report name/i,
      /status/i,
      /requested by/i,
      /requested on/i,
      /output format/i,
      /actions/i,
    ];

    expectedColumnHeaders.forEach((header) => {
      expect(screen.getByRole('columnheader', { name: new RegExp(header, 'i') })).toBeInTheDocument();
    });

    // Validate row contents - when webPreviewViewReportUrl is NOT configured:
    // - Failed reports should show Delete button only
    // - Completed reports should show Download button instead of View button
    expect(screen.getAllByRole('row')).toHaveLength(6);
    expect(screen.getAllByRole('button', { name: /^Delete$/i })).toHaveLength(5);
    expect(screen.getAllByRole('button', { name: /^Download$/i })).toHaveLength(2);
    expect(screen.queryAllByRole('button', { name: /^View$/i })).toHaveLength(0);
  });
});

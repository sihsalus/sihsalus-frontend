import { render } from '@testing-library/react';

import { useQueueEntries } from '../hooks/useQueueEntries';
import { useQueueWorkflowMetadata } from '../triage-workflow/triage-workflow.resource';

import PatientBannerQueueEntryStatus from './patient-banner-queue-entry-status.extension';

vi.mock('../hooks/useQueueEntries', () => ({
  useQueueEntries: vi.fn(),
}));

vi.mock('../triage-workflow/triage-workflow.resource', () => ({
  useQueueWorkflowMetadata: vi.fn(),
}));

const mockUseQueueEntries = vi.mocked(useQueueEntries);
const mockUseQueueWorkflowMetadata = vi.mocked(useQueueWorkflowMetadata);

describe('PatientBannerQueueEntryStatus', () => {
  it('does not load queue workflow data for patient search results', () => {
    render(<PatientBannerQueueEntryStatus patientUuid="patient-uuid" renderedFrom="patient-search" />);

    expect(mockUseQueueEntries).not.toHaveBeenCalled();
    expect(mockUseQueueWorkflowMetadata).not.toHaveBeenCalled();
  });
});

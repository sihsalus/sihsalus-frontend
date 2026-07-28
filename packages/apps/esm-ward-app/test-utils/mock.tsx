import {
  mockAdmissionLocation,
  mockInpatientAdmissions,
  mockInpatientRequests,
  mockLocationInpatientWard,
} from 'test-utils';
import { vi } from 'vitest';
import { useAdmissionLocation } from '../src/hooks/use-admission-location';
import { useInpatientAdmission } from '../src/hooks/use-inpatient-admission';
import { useInpatientRequest } from '../src/hooks/use-inpatient-request';
import { useWardPatientGrouping } from '../src/hooks/use-ward-patient-grouping';
import { type WardViewContext } from '../src/types';
import DefaultWardPatientCardHeader from '../src/ward-view/default-ward/default-ward-patient-card-header.component';
import { createAndGetWardPatientGrouping } from '../src/ward-view/ward-view.resource';

vi.mock('../src/hooks/use-admission-location', () => ({
  useAdmissionLocation: vi.fn(),
}));
vi.mock('../src/hooks/use-inpatient-admission', () => ({
  useInpatientAdmission: vi.fn(),
}));
vi.mock('../src/hooks/use-inpatient-request', () => ({
  useInpatientRequest: vi.fn(),
}));
vi.mock('../src/hooks/use-ward-patient-grouping', () => ({
  useWardPatientGrouping: vi.fn(),
}));
const mockAdmissionLocationResponse = vi.mocked(useAdmissionLocation).mockReturnValue({
  error: undefined,
  mutate: vi.fn(),
  isValidating: false,
  isLoading: false,
  admissionLocation: mockAdmissionLocation,
});
const mockInpatientAdmissionResponse = vi.mocked(useInpatientAdmission).mockReturnValue({
  data: mockInpatientAdmissions,
  hasMore: false,
  loadMore: vi.fn(),
  isValidating: false,
  isLoading: false,
  error: undefined,
  mutate: vi.fn(),
  totalCount: mockInpatientAdmissions.length,
  nextUri: null,
});

const mockInpatientRequestResponse = vi.mocked(useInpatientRequest).mockReturnValue({
  inpatientRequests: mockInpatientRequests,
  hasMore: false,
  loadMore: vi.fn(),
  isValidating: false,
  isLoading: false,
  error: undefined,
  mutate: vi.fn(),
  totalCount: mockInpatientRequests.length,
  nextUri: null,
});

export const mockWardPatientGroupDetails = vi.mocked(useWardPatientGrouping).mockReturnValue({
  admissionLocationResponse: mockAdmissionLocationResponse(),
  inpatientAdmissionResponse: mockInpatientAdmissionResponse(),
  inpatientRequestResponse: mockInpatientRequestResponse(),
  ...createAndGetWardPatientGrouping(
    mockInpatientAdmissions,
    mockAdmissionLocation,
    mockInpatientRequests,
    [],
    mockLocationInpatientWard,
  ),
  isLoading: false,
  mutate: vi.fn(),
});

export const mockWardViewContext: WardViewContext = {
  wardPatientGroupDetails: mockWardPatientGroupDetails(),
  WardPatientHeader: DefaultWardPatientCardHeader,
};

import { ExtensionSlot } from '@openmrs/esm-framework';
import type { Order } from '@openmrs/esm-patient-common-lib';
import { render } from '@testing-library/react';
import useSWR from 'swr';
import { beforeEach, expect, it, vi } from 'vitest';
import { useLabEncounter, useOrderConceptByUuid } from '../lab-results/lab-results.resource';
import TestOrder from './test-order.component';

vi.mock('swr', () => ({ default: vi.fn() }));
vi.mock('../lab-results/lab-results.resource', () => ({
  useLabEncounter: vi.fn(),
  useOrderConceptByUuid: vi.fn(),
}));

const mockExtensionSlot = vi.mocked(ExtensionSlot);
const mockUseLabEncounter = vi.mocked(useLabEncounter);
const mockUseOrderConceptByUuid = vi.mocked(useOrderConceptByUuid);
const mockUseSWR = vi.mocked(useSWR);

const testOrder = {
  concept: { uuid: '11111111-1111-1111-1111-111111111111' },
  encounter: { uuid: '22222222-2222-2222-2222-222222222222' },
  fulfillerComment: 'Declined reason',
  fulfillerStatus: 'DECLINED',
  orderType: { display: 'Laboratory test' },
  type: 'testorder',
  uuid: '33333333-3333-3333-3333-333333333333',
} as Order;

beforeEach(() => {
  vi.clearAllMocks();
  mockUseLabEncounter.mockReturnValue({ encounter: undefined, isLoading: false } as ReturnType<typeof useLabEncounter>);
  mockUseOrderConceptByUuid.mockReturnValue({ concept: undefined, isLoading: false } as ReturnType<
    typeof useOrderConceptByUuid
  >);
  mockUseSWR.mockReturnValue({ data: undefined } as ReturnType<typeof useSWR>);
});

it('mounts the supplemental PDF slot for a patient-chart test order', () => {
  render(<TestOrder testOrder={testOrder} />);

  expect(
    mockExtensionSlot.mock.calls.some(
      ([props]) => props.name === 'lab-order-pdf-attachments-slot' && props.state.order === testOrder,
    ),
  ).toBe(true);
});

it('allows the laboratory result consumer to suppress only the duplicate PDF slot', () => {
  render(<TestOrder testOrder={testOrder} hideSupplementalPdf />);

  expect(mockExtensionSlot.mock.calls.some(([props]) => props.name === 'lab-order-pdf-attachments-slot')).toBe(false);
});

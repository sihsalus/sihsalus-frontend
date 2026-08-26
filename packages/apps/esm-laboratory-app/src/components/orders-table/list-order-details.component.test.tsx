import { ExtensionSlot } from '@openmrs/esm-framework';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { FulfillerStatus, GroupedOrders, Order } from '../../types';
import ListOrderDetails from './list-order-details.component';

const mockExtensionSlot = vi.mocked(ExtensionSlot);

const createGroupedOrders = (fulfillerStatus: FulfillerStatus): GroupedOrders => {
  const order = {
    dateActivated: '2026-08-26T10:00:00.000-05:00',
    display: 'Complete blood count',
    fulfillerStatus,
    instructions: '',
    orderNumber: 'ORD-1',
    orderer: { display: 'Synthetic Provider' },
    type: 'testorder',
    urgency: 'ROUTINE',
    uuid: '11111111-1111-1111-1111-111111111111',
  } as Order;

  return {
    orders: [],
    originalOrders: [order],
    patientUuid: '22222222-2222-2222-2222-222222222222',
    totalOrders: 1,
    visitUuids: [],
  };
};

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

it.each([
  'IN_PROGRESS',
  'DRAFT',
  'COMPLETED',
] as const)('mounts exactly one direct PDF slot when the order status is %s', (status) => {
  render(<ListOrderDetails groupedOrders={createGroupedOrders(status)} />);

  const pdfCalls = mockExtensionSlot.mock.calls.filter(([props]) => props.name === 'lab-order-pdf-attachments-slot');
  expect(pdfCalls).toHaveLength(1);
  const state = pdfCalls[0][0].state as { order: Order };
  expect(state.order.fulfillerStatus).toBe(status);
});

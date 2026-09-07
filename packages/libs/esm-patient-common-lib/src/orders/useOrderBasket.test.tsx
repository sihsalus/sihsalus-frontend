import { act, renderHook } from '@testing-library/react';
import { StrictMode } from 'react';

import { getPatientChartStore } from '../store/patient-chart-store';
import { _resetOrderBasketStore, orderBasketStore } from './store';
import { type OrderBasketItem, type PostDataPrepFunction } from './types';
import { useOrderBasket } from './useOrderBasket';

const mockDrugOrderBasketItem: OrderBasketItem = {
  action: 'NEW',
  display: 'Mock drug',
  uuid: 'mock-drug-uuid',
};

const mockLabOrderBasketItem: OrderBasketItem = {
  action: 'NEW',
  display: 'Mock lab',
  uuid: 'mock-lab-uuid',
};

const preparePostData: PostDataPrepFunction = (order, patientUuid, encounterUuid) => ({
  action: order.action,
  encounter: encounterUuid ?? undefined,
  patient: patientUuid,
});

const patientA = { id: 'patient-a' } as fhir.Patient & { id: string };
const patientB = { id: 'patient-b' } as fhir.Patient & { id: string };

describe('useOrderBasket', () => {
  beforeEach(() => {
    _resetOrderBasketStore();
    getPatientChartStore().setState({
      patient: null,
      patientUuid: 'test-patient-uuid',
      visitContext: null,
      mutateVisitContext: null,
    });
  });

  it('returns the correct list of orders given a grouping', () => {
    const { result } = renderHook(() => useOrderBasket('medications', preparePostData));
    expect(result.current.orders).toEqual([]);
    act(() => {
      result.current.setOrders([mockDrugOrderBasketItem]);
    });
    expect(result.current.orders).toEqual([mockDrugOrderBasketItem]);
  });

  it('can modify items in one grouping without affecting the other', () => {
    const { result: drugResult } = renderHook(() => useOrderBasket('medications', preparePostData));
    const { result: labResult } = renderHook(() => useOrderBasket('labs', preparePostData));
    expect(drugResult.current.orders).toEqual([]);
    expect(labResult.current.orders).toEqual([]);
    act(() => {
      drugResult.current.setOrders([mockDrugOrderBasketItem]);
    });
    expect(drugResult.current.orders).toEqual([mockDrugOrderBasketItem]);
    expect(labResult.current.orders).toEqual([]);
    act(() => {
      labResult.current.setOrders([mockLabOrderBasketItem]);
    });
    expect(drugResult.current.orders).toEqual([mockDrugOrderBasketItem]);
    expect(labResult.current.orders).toEqual([mockLabOrderBasketItem]);
  });

  it('keeps reads, writes, and clears scoped to an explicitly supplied patient', () => {
    const { result: patientAResult } = renderHook(() => useOrderBasket(patientA, 'medications', preparePostData));
    const { result: patientBResult } = renderHook(() => useOrderBasket(patientB, 'medications', preparePostData));

    act(() => {
      patientAResult.current.setOrders([mockDrugOrderBasketItem]);
      patientBResult.current.setOrders([mockLabOrderBasketItem]);
    });

    expect(patientAResult.current.orders).toEqual([mockDrugOrderBasketItem]);
    expect(patientBResult.current.orders).toEqual([mockLabOrderBasketItem]);

    act(() => {
      getPatientChartStore().setState({ patientUuid: patientB.id });
      patientAResult.current.setOrders([{ ...mockDrugOrderBasketItem, display: 'updated for patient A' }]);
    });

    expect(patientAResult.current.orders).toEqual([
      expect.objectContaining({ display: 'updated for patient A', uuid: mockDrugOrderBasketItem.uuid }),
    ]);
    expect(patientBResult.current.orders).toEqual([mockLabOrderBasketItem]);

    act(() => {
      patientAResult.current.clearOrders();
    });

    expect(patientAResult.current.orders).toEqual([]);
    expect(patientBResult.current.orders).toEqual([mockLabOrderBasketItem]);
  });

  it('uses current validation after metadata moves from loading to available and then fails', () => {
    const { rerender } = renderHook(
      ({ available }) =>
        useOrderBasket(patientA, 'medications', (order, patientUuid, encounterUuid, orderingProviderUuid) => {
          if (!available) throw new Error('Synthetic metadata is unavailable');
          return { ...preparePostData(order, patientUuid, encounterUuid), orderer: orderingProviderUuid };
        }),
      { initialProps: { available: false } },
    );
    const prepare = orderBasketStore.getState().postDataPrepFunctions.medications;
    expect(() => prepare(mockDrugOrderBasketItem, patientA.id, 'encounter-a')).toThrow('metadata is unavailable');

    rerender({ available: true });
    expect(orderBasketStore.getState().postDataPrepFunctions.medications).toBe(prepare);
    expect(prepare(mockDrugOrderBasketItem, patientA.id, 'encounter-a', 'current-provider')).toMatchObject({
      patient: patientA.id,
      encounter: 'encounter-a',
      orderer: 'current-provider',
    });

    rerender({ available: false });
    expect(() => prepare(mockDrugOrderBasketItem, patientA.id, 'encounter-a')).toThrow('metadata is unavailable');
  });

  it('keeps one dispatcher for concurrent consumers and restores the current remaining owner on unmount', () => {
    const storeWrite = vi.spyOn(orderBasketStore, 'setState');
    const first = renderHook(
      ({ orderer }) =>
        useOrderBasket(patientA, 'medications', (order, patientUuid, encounterUuid) => ({
          ...preparePostData(order, patientUuid, encounterUuid),
          orderer,
        })),
      { initialProps: { orderer: 'first-owner' }, wrapper: StrictMode },
    );
    const second = renderHook(
      ({ orderer }) =>
        useOrderBasket(patientA, 'medications', (order, patientUuid, encounterUuid) => ({
          ...preparePostData(order, patientUuid, encounterUuid),
          orderer,
        })),
      { initialProps: { orderer: 'second-owner' }, wrapper: StrictMode },
    );
    const observer = renderHook(() => useOrderBasket(patientA, 'medications'));
    const prepare = orderBasketStore.getState().postDataPrepFunctions.medications;
    const writesAfterMount = storeWrite.mock.calls.length;
    expect(prepare(mockDrugOrderBasketItem, patientA.id, 'encounter-a').orderer).toBe('second-owner');

    first.rerender({ orderer: 'first-current' });
    second.rerender({ orderer: 'second-current' });
    expect(prepare(mockDrugOrderBasketItem, patientA.id, 'encounter-a').orderer).toBe('second-current');
    expect(storeWrite).toHaveBeenCalledTimes(writesAfterMount);

    second.unmount();
    expect(prepare(mockDrugOrderBasketItem, patientA.id, 'encounter-a').orderer).toBe('first-current');
    act(() => {
      first.result.current.setOrders([mockDrugOrderBasketItem]);
      first.result.current.clearOrders();
    });
    expect(observer.result.current.orders).toEqual([]);
    expect(orderBasketStore.getState().postDataPrepFunctions.medications).toBe(prepare);
    expect(prepare(mockDrugOrderBasketItem, patientA.id, 'encounter-a').orderer).toBe('first-current');
    first.unmount();
    expect(() => prepare(mockDrugOrderBasketItem, patientA.id, 'encounter-a')).toThrow('No active order preparation');
    observer.unmount();
    storeWrite.mockRestore();
  });

  it('selects the target patient owner instead of a later consumer for another patient', () => {
    renderHook(() =>
      useOrderBasket(patientA, 'medications', (order, patientUuid, encounterUuid) => ({
        ...preparePostData(order, patientUuid, encounterUuid),
        orderer: 'provider-for-a',
      })),
    );
    const second = renderHook(() =>
      useOrderBasket(patientB, 'medications', (order, patientUuid, encounterUuid) => ({
        ...preparePostData(order, patientUuid, encounterUuid),
        orderer: 'provider-for-b',
      })),
    );
    const prepare = orderBasketStore.getState().postDataPrepFunctions.medications;
    expect(prepare(mockDrugOrderBasketItem, patientA.id, 'encounter-a').orderer).toBe('provider-for-a');
    expect(prepare(mockDrugOrderBasketItem, patientB.id, 'encounter-b').orderer).toBe('provider-for-b');
    second.unmount();
    expect(() => prepare(mockDrugOrderBasketItem, patientB.id, 'encounter-b')).toThrow('No active order preparation');
  });
});

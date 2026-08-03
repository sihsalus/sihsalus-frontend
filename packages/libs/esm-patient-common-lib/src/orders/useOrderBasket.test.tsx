import { act, renderHook } from '@testing-library/react';

import { getPatientChartStore } from '../store/patient-chart-store';
import { _resetOrderBasketStore } from './store';
import { type OrderBasketItem, type PostDataPrepFunction } from './types';
import { useOrderBasket } from './useOrderBasket';

const mockDrugOrderBasketItem = {
  action: 'NEW',
  uuid: 'mock-drug-uuid',
} as OrderBasketItem;

const mockLabOrderBasketItem = {
  action: 'NEW',
  uuid: 'mock-lab-uuid',
} as OrderBasketItem;

const patientA = { id: 'patient-a' } as fhir.Patient;
const patientB = { id: 'patient-b' } as fhir.Patient;

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
    const { result } = renderHook(() => useOrderBasket('medications', ((x) => x) as unknown as PostDataPrepFunction));
    expect(result.current.orders).toEqual([]);
    act(() => {
      result.current.setOrders([mockDrugOrderBasketItem]);
    });
    expect(result.current.orders).toEqual([mockDrugOrderBasketItem]);
  });

  it('can modify items in one grouping without affecting the other', () => {
    const { result: drugResult } = renderHook(() =>
      useOrderBasket('medications', ((x) => x) as unknown as PostDataPrepFunction),
    );
    const { result: labResult } = renderHook(() =>
      useOrderBasket('labs', ((x) => x) as unknown as PostDataPrepFunction),
    );
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
    const preparePostData = ((x) => x) as unknown as PostDataPrepFunction;
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
});

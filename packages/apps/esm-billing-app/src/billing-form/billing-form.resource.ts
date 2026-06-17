import { type OpenmrsResource, openmrsFetch } from '@openmrs/esm-framework';
import useSWR from 'swr';
import { apiBasePath } from '../constants';

export const useBillableItems = () => {
  const url = `${apiBasePath}billableService?v=custom:(uuid,name,shortName,serviceStatus,serviceType:(display),servicePrices:(uuid,name,price,paymentMode:(uuid,name)))`;
  const { data, isLoading, error } = useSWR<{ data: { results: Array<OpenmrsResource> } }>(url, openmrsFetch);
  const allItems = data?.data?.results ?? [];
  const isEnabledItem = (item: OpenmrsResource) => (item as { serviceStatus?: string }).serviceStatus === 'ENABLED';
  return {
    lineItems: allItems.filter(isEnabledItem),
    isLoading,
    error,
  };
};

export const useCashPoint = () => {
  const url = `${apiBasePath}cashPoint`;
  const { data, isLoading, error } = useSWR<{ data: { results: Array<OpenmrsResource> } }>(url, openmrsFetch);

  return { isLoading, error, cashPoints: data?.data?.results ?? [] };
};

export const createPatientBill = (payload) => {
  const postUrl = `${apiBasePath}bill`;
  return openmrsFetch(postUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload });
};

export const usePaymentMethods = () => {
  const url = `${apiBasePath}paymentMode`;
  const { data, isLoading, error } = useSWR<{ data: { results: Array<OpenmrsResource> } }>(url, openmrsFetch);

  return { isLoading, error, paymentModes: data?.data?.results ?? [] };
};

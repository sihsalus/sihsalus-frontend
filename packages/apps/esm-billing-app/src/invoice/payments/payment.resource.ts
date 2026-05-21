import { openmrsFetch, restBaseUrl, type Visit } from '@openmrs/esm-framework';
import useSWR from 'swr';
import { apiBasePath } from '../../constants';

type PaymentMethod = {
  uuid: string;
  description: string;
  name: string;
  retired: boolean;
};

const swrOption = {
  errorRetryCount: 2,
};

export const usePaymentModes = () => {
  const url = `${apiBasePath}paymentMode`;
  const { data, isLoading, error, mutate } = useSWR<{ data: { results: Array<PaymentMethod> } }>(
    url,
    openmrsFetch,
    swrOption,
  );

  return {
    paymentModes: data?.data?.results ?? [],
    isLoading,
    mutate,
    error,
  };
};

export const updateBillVisitAttribute = async (visit: Visit, formPayloadPendingAttributeTypeUuid: string) => {
  const { uuid, attributes } = visit;
  const pendingPaymentAtrributeUuid = attributes?.find(
    (attribute) => attribute.attributeType.uuid === formPayloadPendingAttributeTypeUuid,
  )?.uuid;
  return openmrsFetch(`${restBaseUrl}/visit/${uuid}/attribute/${pendingPaymentAtrributeUuid}`, {
    body: { value: false },
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });
};

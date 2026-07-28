import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export const appointmentServicesSearchParam = 'services';

export function getAppointmentServiceTypes(searchParams: URLSearchParams, legacyServiceType?: string) {
  if (!searchParams.has(appointmentServicesSearchParam)) {
    return legacyServiceType ? [legacyServiceType] : [];
  }

  return Array.from(
    new Set(
      (searchParams.get(appointmentServicesSearchParam) ?? '')
        .split(',')
        .map((serviceType) => serviceType.trim())
        .filter(Boolean),
    ),
  );
}

export function getAppointmentServiceFilterSearch(serviceTypes: Array<string>) {
  const normalizedServiceTypes = Array.from(
    new Set(serviceTypes.map((serviceType) => serviceType.trim()).filter(Boolean)),
  );

  if (!normalizedServiceTypes.length) {
    return '';
  }

  const searchParams = new URLSearchParams();
  searchParams.set(appointmentServicesSearchParam, normalizedServiceTypes.join(','));
  return `?${searchParams.toString()}`;
}

export function useAppointmentServiceFilter(legacyServiceType?: string) {
  const [searchParams, setSearchParams] = useSearchParams();
  const serializedSearchParams = searchParams.toString();
  const appointmentServiceTypes = useMemo(
    () => getAppointmentServiceTypes(new URLSearchParams(serializedSearchParams), legacyServiceType),
    [legacyServiceType, serializedSearchParams],
  );

  const setAppointmentServiceTypes = useCallback(
    (serviceTypes: Array<string>) => {
      const nextSearchParams = new URLSearchParams(serializedSearchParams);
      nextSearchParams.set(
        appointmentServicesSearchParam,
        Array.from(new Set(serviceTypes.map((serviceType) => serviceType.trim()).filter(Boolean))).join(','),
      );
      setSearchParams(nextSearchParams, { replace: true });
    },
    [serializedSearchParams, setSearchParams],
  );

  return { appointmentServiceTypes, setAppointmentServiceTypes };
}

import { type Location } from '@openmrs/esm-framework';
import { useParams } from 'react-router-dom';
import useLocation from './useLocation';

export default function useWardLocation(): {
  location: Location | undefined;
  isLoadingLocation: boolean;
  errorFetchingLocation: Error | undefined;
  invalidLocation: boolean;
} {
  const { locationUuid: locationUuidFromUrl } = useParams();
  const {
    data: locationResponse,
    isLoading: isLoadingLocation,
    error: errorFetchingLocation,
  } = useLocation(locationUuidFromUrl ? locationUuidFromUrl : null);
  const location = locationResponse?.data;
  const isAdmissionLocation = location?.tags?.some((tag) => tag.display === 'Admission Location');
  const invalidLocation = Boolean(
    locationUuidFromUrl && (errorFetchingLocation || (!isLoadingLocation && location && !isAdmissionLocation)),
  );

  return {
    location: locationUuidFromUrl && !invalidLocation ? location : undefined,
    isLoadingLocation: Boolean(locationUuidFromUrl && isLoadingLocation),
    errorFetchingLocation,
    invalidLocation,
  };
}

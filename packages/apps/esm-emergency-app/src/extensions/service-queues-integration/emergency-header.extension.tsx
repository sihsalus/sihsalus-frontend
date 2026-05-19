/**
 * Emergency Header Extension
 *
 * Extension component that renders the emergency header in service-queues-app
 * when emergency location is selected.
 *
 * Registered in: service-queues-emergency-header-slot
 *
 * This extension decides internally whether to render based on the current location.
 * If it's not an emergency location, it returns null.
 */
import EmergencyHeader from '../../emergency-dashboard/emergency-header/emergency-header.component';
import { useIsEmergencyLocation } from '../../utils/emergency-detection';

export default function EmergencyHeaderExtension() {
  const isEmergencyLocation = useIsEmergencyLocation();

  // Only render if emergency location is selected
  if (!isEmergencyLocation) {
    return null;
  }

  return <EmergencyHeader />;
}

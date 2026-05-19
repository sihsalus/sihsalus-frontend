/**
 * Emergency Alerts Extension
 *
 * Extension component that renders emergency alerts in service-queues-app
 * when emergency location is selected.
 *
 * Registered in: service-queues-emergency-alerts-slot
 *
 * This extension decides internally whether to render based on the current location.
 * If it's not an emergency location, it returns null.
 */
import EmergencyAlerts from '../../emergency-dashboard/emergency-alerts/emergency-alerts.component';
import { useIsEmergencyLocation } from '../../utils/emergency-detection';

export default function EmergencyAlertsExtension() {
  const isEmergencyLocation = useIsEmergencyLocation();

  // Only render if emergency location is selected
  if (!isEmergencyLocation) {
    return null;
  }

  return <EmergencyAlerts />;
}

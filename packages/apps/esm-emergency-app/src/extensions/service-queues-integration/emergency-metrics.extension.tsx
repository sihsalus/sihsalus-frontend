/**
 * Emergency Metrics Extension
 *
 * Extension component that renders emergency-specific metrics in service-queues-app
 * when emergency location is selected. While active, it claims the emergency UI through
 * the shared serviceQueues store so service-queues hides its standard ClinicMetrics —
 * state-driven composition instead of DOM manipulation, so it does not depend on
 * extension mount order.
 *
 * Uses CompactMetricsContainer which contains the emergency compact metrics.
 *
 * Registered in: service-queues-emergency-metrics-slot
 */
import CompactMetricsContainer from '../../emergency-dashboard/compact-metrics/compact-metrics-container.component';
import { useIsEmergencyLocation } from '../../utils/emergency-detection';
import { useEmergencyUiActiveClaim } from '../../utils/service-queues-integration';

export default function EmergencyMetricsExtension() {
  const isEmergencyLocation = useIsEmergencyLocation();

  useEmergencyUiActiveClaim(isEmergencyLocation);

  if (!isEmergencyLocation) {
    return null;
  }

  return <CompactMetricsContainer />;
}

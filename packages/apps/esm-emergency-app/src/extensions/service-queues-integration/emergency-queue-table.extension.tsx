/**
 * Emergency Queue Table Extension
 *
 * Extension component that renders the emergency-specific queue table in service-queues-app
 * when emergency location is selected. While active, it claims the emergency UI through the
 * shared serviceQueues store so service-queues hides its standard DefaultQueueTable —
 * state-driven composition instead of DOM manipulation, so it does not depend on
 * extension mount order.
 *
 * This table is optimized for emergency department workflows with priority-based sorting.
 *
 * Registered in: service-queues-emergency-queue-table-slot
 */
import EmergencyQueueTable from '../../emergency-dashboard/emergency-queue-table/emergency-queue-table.component';
import { useIsEmergencyLocation } from '../../utils/emergency-detection';
import { useEmergencyUiActiveClaim } from '../../utils/service-queues-integration';

export default function EmergencyQueueTableExtension() {
  const isEmergencyLocation = useIsEmergencyLocation();

  useEmergencyUiActiveClaim(isEmergencyLocation);

  if (!isEmergencyLocation) {
    return null;
  }

  return <EmergencyQueueTable />;
}

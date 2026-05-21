/**
 * Emergency Queue Table Extension
 *
 * Extension component that renders the emergency-specific queue table in service-queues-app
 * when emergency location is selected. When not in emergency location, this extension
 * ensures the standard DefaultQueueTable component is hidden via CSS.
 *
 * This table is optimized for emergency department workflows with priority-based sorting.
 *
 * Registered in: service-queues-emergency-queue-table-slot
 *
 * This extension always renders to ensure proper control over table display.
 * When emergency location is selected, shows emergency table and hides standard table.
 * When not emergency, returns null to allow standard table to show.
 */
import { useEffect } from 'react';
import EmergencyQueueTable from '../../emergency-dashboard/emergency-queue-table/emergency-queue-table.component';
import { useIsEmergencyLocation } from '../../utils/emergency-detection';

export default function EmergencyQueueTableExtension() {
  const isEmergencyLocation = useIsEmergencyLocation();

  // Hide standard DefaultQueueTable when emergency table is showing
  useEffect(() => {
    const standardTableContainer = document.querySelector('[data-standard-queue-table-container]');
    if (standardTableContainer) {
      if (isEmergencyLocation) {
        (standardTableContainer as HTMLElement).style.display = 'none';
      } else {
        (standardTableContainer as HTMLElement).style.display = '';
      }
    }

    return () => {
      // Restore display when component unmounts
      if (standardTableContainer) {
        (standardTableContainer as HTMLElement).style.display = '';
      }
    };
  }, [isEmergencyLocation]);

  // Only render emergency table if emergency location is selected
  if (!isEmergencyLocation) {
    return null;
  }

  return <EmergencyQueueTable />;
}

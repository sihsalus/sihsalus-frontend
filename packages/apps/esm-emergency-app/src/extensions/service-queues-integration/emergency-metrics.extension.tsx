/**
 * Emergency Metrics Extension
 *
 * Extension component that renders emergency-specific metrics in service-queues-app
 * when emergency location is selected. When not in emergency location, this extension
 * ensures the standard ClinicMetrics component is hidden via CSS.
 *
 * Uses CompactMetricsContainer which contains the emergency compact metrics.
 *
 * Registered in: service-queues-emergency-metrics-slot
 *
 * This extension always renders to ensure proper control over metrics display.
 * When emergency location is selected, shows emergency metrics and hides standard metrics.
 * When not emergency, returns null to allow standard metrics to show.
 */
import { useEffect } from 'react';
import CompactMetricsContainer from '../../emergency-dashboard/compact-metrics/compact-metrics-container.component';
import { useIsEmergencyLocation } from '../../utils/emergency-detection';

export default function EmergencyMetricsExtension() {
  const isEmergencyLocation = useIsEmergencyLocation();

  // Hide standard ClinicMetrics when emergency metrics are showing
  useEffect(() => {
    const standardMetricsContainer = document.querySelector('[data-standard-metrics-container]');
    if (standardMetricsContainer) {
      if (isEmergencyLocation) {
        (standardMetricsContainer as HTMLElement).style.display = 'none';
      } else {
        (standardMetricsContainer as HTMLElement).style.display = '';
      }
    }

    return () => {
      // Restore display when component unmounts
      if (standardMetricsContainer) {
        (standardMetricsContainer as HTMLElement).style.display = '';
      }
    };
  }, [isEmergencyLocation]);

  // Only render emergency metrics if emergency location is selected
  if (!isEmergencyLocation) {
    return null;
  }

  return <CompactMetricsContainer />;
}

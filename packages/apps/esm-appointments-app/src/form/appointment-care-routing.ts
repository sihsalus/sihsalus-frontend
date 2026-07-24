import { type AppointmentArrivalRule } from '../config-schema';
import { type AppointmentService } from '../types';

export type AppointmentCareRoutingIssue =
  | 'arrival-rule-ambiguous'
  | 'arrival-rule-invalid'
  | 'arrival-rule-missing'
  | 'service-location-mismatch'
  | 'service-location-missing'
  | 'service-location-unavailable';

interface AppointmentCareRoutingInput {
  appointmentArrivalRules: ReadonlyArray<AppointmentArrivalRule>;
  enforceArrivalRouting: boolean;
  selectableLocationUuids: ReadonlySet<string>;
  selectedLocationUuid: string;
  service?: Pick<AppointmentService, 'location' | 'uuid'>;
}

/**
 * Validates the frontend's complete appointment-to-care route.
 *
 * The AppointmentService location is the canonical scheduling UPSS. When the
 * deployed routing contract is enabled, the exact service-UPSS pair must also
 * resolve to one and only one arrival rule. Required-field validation for the
 * user's current UPSS selection is kept in the form schema; configuration
 * defects are still reported even while that selection is empty.
 */
export function getAppointmentCareRoutingIssue({
  appointmentArrivalRules,
  enforceArrivalRouting,
  selectableLocationUuids,
  selectedLocationUuid,
  service,
}: AppointmentCareRoutingInput): AppointmentCareRoutingIssue | null {
  if (!service) {
    return null;
  }

  const configuredLocationUuid = service.location?.uuid;

  if (!configuredLocationUuid) {
    return enforceArrivalRouting ? 'service-location-missing' : null;
  }

  if (!selectableLocationUuids.has(configuredLocationUuid)) {
    return 'service-location-unavailable';
  }

  if (!selectedLocationUuid) {
    return null;
  }

  if (selectedLocationUuid !== configuredLocationUuid) {
    return 'service-location-mismatch';
  }

  if (!enforceArrivalRouting) {
    return null;
  }

  const matchingRules = appointmentArrivalRules.filter(
    (rule) => rule.appointmentServiceUuid === service.uuid && rule.appointmentLocationUuid === configuredLocationUuid,
  );

  if (matchingRules.length === 0) {
    return 'arrival-rule-missing';
  }

  if (matchingRules.length > 1) {
    return 'arrival-rule-ambiguous';
  }

  const [arrivalRule] = matchingRules;
  const hasRequiredVisitType = Boolean(arrivalRule.requiredVisitTypeUuid?.trim());
  const hasQueueUuid = Boolean(arrivalRule.queueUuid?.trim());
  const hasQueueLocationUuid = Boolean(arrivalRule.queueLocationUuid?.trim());
  const isQueuePolicy =
    arrivalRule.arrivalPolicy === 'queue-optional' || arrivalRule.arrivalPolicy === 'queue-required';
  const queueConfigurationIsValid = isQueuePolicy
    ? hasQueueUuid && hasQueueLocationUuid
    : !hasQueueUuid && !hasQueueLocationUuid;

  if (!hasRequiredVisitType || !queueConfigurationIsValid) {
    return 'arrival-rule-invalid';
  }

  return null;
}

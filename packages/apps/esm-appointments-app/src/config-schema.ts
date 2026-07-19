import { Type, validator, validators } from '@openmrs/esm-framework';

const patientChartUrlPlaceholder = `\${openmrsSpaBase}/patient/\${patientUuid}/chart`;
const arrivalPolicies = ['queue-optional', 'queue-required', 'direct'] as const;
const providerSchedulingCategoryValidationModes = ['off', 'warn', 'strict'] as const;

const hasNonEmptyString = (value: unknown) => typeof value === 'string' && value.trim().length > 0;

export type AppointmentArrivalPolicy = (typeof arrivalPolicies)[number];
export type ProviderSchedulingCategoryValidationMode = (typeof providerSchedulingCategoryValidationModes)[number];

export interface AppointmentArrivalRule {
  appointmentServiceUuid: string;
  appointmentLocationUuid: string;
  arrivalPolicy: AppointmentArrivalPolicy;
  requiredVisitTypeUuid: string;
  queueUuid?: string;
  queueLocationUuid?: string;
}

export const configSchema = {
  allowAllDayAppointments: {
    _type: Type.Boolean,
    _description: 'Whether to allow scheduling of all-day appointments (vs appointments with start time and end time)',
    _default: false,
  },
  appointmentStatuses: {
    _type: Type.Array,
    _description: 'Configurable appointment status (status of appointments)',
    _default: ['Requested', 'Scheduled', 'CheckedIn', 'Completed', 'Cancelled', 'Missed'],
  },
  // TODO(SIHSALUS): move the MINSA appointment entry-condition catalog to a shared frontend/backend contract.
  // Frontend should only render labels; backend should own validation, persistence values, and migrations.
  appointmentTypes: {
    _type: Type.Array,
    _description:
      'Configurable appointment types for rendering. Values are sent to the backend as appointment kinds (Scheduled, WalkIn, Virtual).',
    _default: ['Scheduled', 'WalkIn', 'Virtual'],
  },
  appointmentServiceGenderRules: {
    _type: Type.Array,
    _description:
      'Gender eligibility rules for appointment services. Services without a rule are available for every patient gender.',
    _default: [],
    _elements: {
      appointmentServiceUuid: {
        _type: Type.UUID,
        _description: 'Appointment service UUID to restrict.',
      },
      allowedGenders: {
        _type: Type.Array,
        _elements: {
          _type: Type.String,
        },
        _default: [],
        _description: 'Accepted patient genders. Supported canonical values are F, M, O, and U.',
      },
    },
  },
  appointmentVisitAttributeTypeUuid: {
    _type: Type.UUID,
    _description: 'Visit attribute type used to persist the originating appointment UUID on an OpenMRS visit',
    _default: '193508ab-20c6-5291-9f23-0257335eaabd',
  },
  careRoutingContractVersion: {
    _type: Type.String,
    _description: 'Version of the canonical appointment-to-care routing contract deployed with SIH.SALUS content',
    _default: '',
  },
  appointmentArrivalRules: {
    _type: Type.Array,
    _description:
      'Exact rules from appointment service and location UUIDs to a direct or queue-based arrival workflow. Arrival is blocked when no unique rule exists.',
    _default: [],
    _elements: {
      _validators: [
        validator((rule: Record<string, unknown>) => {
          const hasBaseFields = ['appointmentServiceUuid', 'appointmentLocationUuid', 'requiredVisitTypeUuid'].every(
            (field) => hasNonEmptyString(rule?.[field]),
          );
          const arrivalPolicy = rule?.arrivalPolicy;
          if (!hasBaseFields || !arrivalPolicies.includes(arrivalPolicy as AppointmentArrivalPolicy)) {
            return false;
          }

          const hasQueueUuid = hasNonEmptyString(rule?.queueUuid);
          const hasQueueLocationUuid = hasNonEmptyString(rule?.queueLocationUuid);
          return arrivalPolicy === 'direct'
            ? !hasQueueUuid && !hasQueueLocationUuid
            : hasQueueUuid && hasQueueLocationUuid;
        }, 'Each appointment arrival rule must define service, appointment location, policy and required visit type UUIDs; queue policies also require queue and queue location UUIDs, while direct policies must omit them.'),
      ],
      appointmentServiceUuid: { _type: Type.UUID },
      appointmentLocationUuid: { _type: Type.UUID },
      arrivalPolicy: {
        _type: Type.String,
        _validators: [validators.oneOf(arrivalPolicies)],
      },
      requiredVisitTypeUuid: { _type: Type.UUID },
      queueUuid: { _type: Type.UUID },
      queueLocationUuid: { _type: Type.UUID },
    },
  },
  providerSchedulingCategoryValidation: {
    mode: {
      _type: Type.String,
      _description:
        'How to validate that the selected provider is enabled for the appointment service scheduling category',
      _default: 'off',
      _validators: [validators.oneOf(providerSchedulingCategoryValidationModes)],
    },
    providerAttributeTypeUuid: {
      _type: Type.UUID,
      _description:
        'Multi-valued Provider attribute whose FreeText values are exact AppointmentSpeciality UUIDs enabled for scheduling',
      _default: '3961cbdd-3240-4b70-99ca-5f63af488b15',
    },
  },
  checkInButton: {
    enabled: {
      _type: Type.Boolean,
      _description: 'Whether the check-in button on the "Appointments" list should be enabled',
      _default: true,
    },
    showIfActiveVisit: {
      _type: Type.Boolean,
      _description: 'Whether to show the check-in button if the patient currently has an active visit',
      _default: true,
    },
    customUrl: {
      _type: Type.String,
      _description: 'Custom URL to open when clicking the check-in button (instead of thes start visit form)',
      _default: '',
    },
  },
  checkOutButton: {
    enabled: {
      _type: Type.Boolean,
      _description: 'Whether the check-out button on the "Appointments" list should be disabled',
      _default: true,
    },
    customUrl: {
      _type: Type.String,
      _description: 'Custom URL to open when clicking the check-out button',
      _default: '',
    },
  },
  customPatientChartUrl: {
    _type: Type.String,
    _description: `Template URL that will be used when clicking on the patient name in the queues table.
      Available argument: patientUuid, openmrsSpaBase, openBase
      (openmrsSpaBase and openBase are available to any <ConfigurableLink>)`,
    _default: patientChartUrlPlaceholder,
    _validators: [validators.isUrlWithTemplateParameters(['patientUuid'])],
  },
  includePhoneNumberInExcelSpreadsheet: {
    _type: Type.Boolean,
    _description: 'Whether to include phone numbers in the exported Excel spreadsheet',
    _default: true,
  },
  patientIdentifierType: {
    _type: Type.String,
    _description: 'The name of the patient identifier type to be used for the patient identifier field',
    _default: 'N° Historia Clínica',
  },
  showUnscheduledAppointmentsTab: {
    _type: Type.Boolean,
    _description:
      'Whether to show the Unscheduled Appointments tab. Note that configuring this to true requires a custom unscheduledAppointment endpoint not currently available',
    _default: false,
  },
};

export interface ConfigObject {
  allowAllDayAppointments: boolean;
  appointmentStatuses: Array<string>;
  appointmentTypes: Array<string>;
  appointmentServiceGenderRules: Array<{
    appointmentServiceUuid: string;
    allowedGenders: Array<string>;
  }>;
  appointmentVisitAttributeTypeUuid: string;
  careRoutingContractVersion: string;
  appointmentArrivalRules: Array<AppointmentArrivalRule>;
  providerSchedulingCategoryValidation: {
    mode: ProviderSchedulingCategoryValidationMode;
    providerAttributeTypeUuid: string;
  };
  checkInButton: {
    enabled: boolean;
    showIfActiveVisit: boolean;
    customUrl: string;
  };
  checkOutButton: {
    enabled: boolean;
    customUrl: string;
  };
  customPatientChartUrl: string;
  includePhoneNumberInExcelSpreadsheet: boolean;
  patientIdentifierType: string;
  showUnscheduledAppointmentsTab: boolean;
}

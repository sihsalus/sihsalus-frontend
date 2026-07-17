import { Type, validator, validators } from '@openmrs/esm-framework';

const patientChartUrlPlaceholder = `\${openmrsSpaBase}/patient/\${patientUuid}/chart`;

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
  appointmentVisitAttributeTypeUuid: {
    _type: Type.UUID,
    _description: 'Visit attribute type used to persist the originating appointment UUID on an OpenMRS visit',
    _default: '193508ab-20c6-5291-9f23-0257335eaabd',
  },
  appointmentQueueMappings: {
    _type: Type.Array,
    _description:
      'Exact mappings from appointment service and location UUIDs to a queue and queue location. Unmapped services require manual queue selection.',
    _default: [],
    _elements: {
      _validators: [
        validator(
          (mapping: Record<string, unknown>) =>
            [
              'appointmentServiceUuid',
              'appointmentLocationUuid',
              'queueUuid',
              'queueLocationUuid',
              'requiredVisitTypeUuid',
            ].every((field) => {
              const value = mapping?.[field];
              return typeof value === 'string' && value.trim().length > 0;
            }),
          'Each appointment queue mapping must define service, appointment location, queue, queue location, and required visit type UUIDs.',
        ),
      ],
      appointmentServiceUuid: { _type: Type.UUID },
      appointmentLocationUuid: { _type: Type.UUID },
      queueUuid: { _type: Type.UUID },
      queueLocationUuid: { _type: Type.UUID },
      requiredVisitTypeUuid: { _type: Type.UUID },
      compatibleActiveVisitTypeUuids: {
        _type: Type.Array,
        _elements: { _type: Type.UUID },
      },
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
  appointmentVisitAttributeTypeUuid: string;
  appointmentQueueMappings: Array<{
    appointmentServiceUuid: string;
    appointmentLocationUuid: string;
    queueUuid: string;
    queueLocationUuid: string;
    requiredVisitTypeUuid: string;
    compatibleActiveVisitTypeUuids?: Array<string>;
  }>;
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

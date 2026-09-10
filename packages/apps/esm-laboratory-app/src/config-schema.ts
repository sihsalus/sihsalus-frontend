import { Type, validators } from '@openmrs/esm-framework';

const allowedLabTableColumns = [
  'name',
  'age',
  'dob',
  'sex',
  'sisCoverage',
  'totalOrders',
  'action',
  'patientId',
] as const;
type LabTableColumnName = (typeof allowedLabTableColumns)[number];

export const configSchema = {
  laboratoryOrderTypeUuid: {
    _type: Type.String,
    _default: '52a447d3-a64a-11e3-9aeb-50e549534c5e',
    _description: 'UUID for orderType',
  },
  labTableColumns: {
    _type: Type.Array,
    _default: ['name', 'age', 'sex', 'sisCoverage', 'totalOrders', 'action'] as Array<LabTableColumnName>,
    _description: 'The columns to display in the lab table. Allowed values: ' + allowedLabTableColumns.join(', '),
    _elements: {
      _type: Type.String,
      _validators: [validators.oneOf(allowedLabTableColumns)],
    },
  },
  patientIdIdentifierTypeUuid: {
    _type: Type.UUID,
    _default: '05a29f94-c0ed-11e2-94be-8c13b969e334',
    _description: 'Needed if the "id" column of "labTableColumns" is used. Is the OpenMRS ID by default.',
  },
  enableReviewingLabResultsBeforeApproval: {
    _type: Type.Boolean,
    _default: false,
    _description:
      'Enable reviewing lab results before final approval. When enabled, lab results will be submitted for review before being approved and finalized.',
  },
  enableRealtimeLabResultNotifications: {
    _type: Type.Boolean,
    _default: false,
    _description:
      'Refresh the laboratory dashboard and show an in-app notice when a compatible SIHSALUS notifications OMOD is deployed. Enable explicitly after validating the backend transport.',
  },
  resultsViewerConcepts: {
    _type: Type.Array,
    _description: 'Conceptos de sets de laboratorio utilizados para filtrar las órdenes por grupo.',
    _default: [
      { conceptUuid: '228ced89-758e-4e0b-982e-155c01ed50f7' }, // Hematología
      { conceptUuid: '20df74e8-192d-4c30-8e5c-d9989c8a33d8' }, // Bioquímica
      { conceptUuid: '8ed15668-238d-4f19-947f-2237cb5d793f' }, // Inmunología
      { conceptUuid: '48ea717c-cc7c-4dc1-a018-9c0d439ee178' }, // Microbiología
      { conceptUuid: '0a84d7d3-2d86-4415-a12f-dc2a307ddba1' }, // Coproanálisis
      { conceptUuid: '29f4a2ac-d212-4ada-961c-b3d64101b390' }, // Grupo Sanguíneo y Factor Rh
      { conceptUuid: '24305e8e-f3dc-4ac6-bf87-e4f11f3b970e' }, // Hemograma completo
      { conceptUuid: 'ea88fc4e-e3d9-4d2b-9cdd-c5be0490615a' }, // Lámina periférica
      { conceptUuid: '2220fe2e-37ad-465a-a49b-881369ad93cd' }, // Bilirrubina
      { conceptUuid: '9c7b89d6-7adc-4450-8e91-bd2115d28992' }, // Proteínas totales y albúmina
      { conceptUuid: 'ef0a9d25-658b-466b-9b7e-4571673b28b0' }, // Prueba KOH
      { conceptUuid: '476ced01-24e8-43c0-a9f0-81327f6734f7' }, // Parasitología
      { conceptUuid: '4df83426-dfdf-4085-8db3-8ceedd268327' }, // Reacción inflamatoria
      { conceptUuid: '7e750f3a-8d5c-45b1-8e94-ebf850208e35' }, // Examen orina
      { conceptUuid: 'c5cedfda-c2b7-4c85-b420-ecf0b53cba08' }, // Sedimento urinario
    ],
  },
};

export type Config = {
  enableRealtimeLabResultNotifications: boolean;
  enableReviewingLabResultsBeforeApproval: boolean;
  laboratoryOrderTypeUuid: string;
  labTableColumns: Array<LabTableColumnName>;
  patientIdIdentifierTypeUuid: string;
  resultsViewerConcepts: Array<{ conceptUuid: string }>;
};

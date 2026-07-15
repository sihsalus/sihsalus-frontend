import { Type, validators } from '@openmrs/esm-framework';

const allowedLabTableColumns = ['name', 'age', 'dob', 'sex', 'totalOrders', 'action', 'patientId'] as const;
type LabTableColumnName = (typeof allowedLabTableColumns)[number];

export const configSchema = {
  laboratoryOrderTypeUuid: {
    _type: Type.String,
    _default: '52a447d3-a64a-11e3-9aeb-50e549534c5e',
    _description: 'UUID for orderType',
  },
  labTableColumns: {
    _type: Type.Array,
    _default: ['name', 'age', 'sex', 'totalOrders', 'action'] as Array<LabTableColumnName>,
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
  resultsViewerConcepts: {
    _type: Type.Array,
    _description: 'Conceptos de sets de laboratorio utilizados para filtrar las órdenes por grupo.',
    _default: [
      //{ conceptUuid: '24305e8e-f3dc-4ac6-bf87-e4f11f3b970e' }, // Hemograma completo
      { conceptUuid: '7e750f3a-8d5c-45b1-8e94-ebf850208e35' }, // Examen completo de orina
      //{ conceptUuid: 'df144cc2-6718-4005-9881-f39eafd73315' }, // Examen de Heces
      { conceptUuid: '339febfd-699e-4a26-927f-1f9a7780bb5e' }, // Panel de Química del Suero
      { conceptUuid: '241eb982-1fdd-4183-a2b5-763f5ce2d528' }, // Otras Pruebas de Laboratorio
      //{ conceptUuid: '1bcb541a-55e8-4c5d-83fb-d121a9d54d9d' }, // Pruebas de Tipificación Sanguínea
      { conceptUuid: '654b11a8-a326-45c9-885e-2fae6143404a' }, // Determinación de Leucocitos en Heces
      { conceptUuid: '968c8a41-ab1b-426c-86ee-761b88c26e40' }, // Tinción con colorante de Wright
      { conceptUuid: 'ef0a9d25-658b-466b-9b7e-4571673b28b0' }, // Prueba de KOH
      { conceptUuid: '7969c932-60db-4a38-8723-2f3a5bba8c16' }, // Prueba de Látex PCR Directo
      { conceptUuid: 'bb3af485-89b6-4c04-848c-8d024a6b4a7a' }, // Examen Parasitológico en heces
    ],
  },
};

export type Config = {
  enableReviewingLabResultsBeforeApproval: boolean;
  laboratoryOrderTypeUuid: string;
  labTableColumns: Array<LabTableColumnName>;
  patientIdIdentifierTypeUuid: string;
  resultsViewerConcepts: Array<{ conceptUuid: string }>;
};

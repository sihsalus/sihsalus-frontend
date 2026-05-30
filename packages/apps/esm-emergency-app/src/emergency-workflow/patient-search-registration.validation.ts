import { z } from 'zod';

export const communicationConditionOptions = [
  { value: 'communicates', label: 'Puede comunicarse' },
  { value: 'unconscious', label: 'Inconsciente' },
  { value: 'comatose', label: 'Comatoso' },
  { value: 'disoriented', label: 'Desorientado' },
  { value: 'non_verbal', label: 'No verbal' },
  { value: 'minor_without_data', label: 'Menor sin datos' },
  { value: 'other', label: 'Otro' },
] as const;

export const identificationStatusOptions = [
  { value: 'pending', label: 'Pendiente' },
  { value: 'partial', label: 'Parcial' },
  { value: 'confirmed', label: 'Confirmado' },
  { value: 'merged', label: 'Fusionado' },
] as const;

export const responsibleTypeOptions = [
  { value: 'family', label: 'Familiar' },
  { value: 'companion', label: 'Acompañante' },
  { value: 'police', label: 'Policía' },
  { value: 'paramedic', label: 'Paramédico' },
  { value: 'emergency_staff', label: 'Personal de emergencia' },
  { value: 'institution', label: 'Institución' },
  { value: 'other', label: 'Otro' },
] as const;

export const communicationConditionLabels = Object.fromEntries(
  communicationConditionOptions.map((option) => [option.value, option.label]),
) as Record<string, string>;

export const identificationStatusLabels = Object.fromEntries(
  identificationStatusOptions.map((option) => [option.value, option.label]),
) as Record<string, string>;

export const responsibleTypeLabels = Object.fromEntries(
  responsibleTypeOptions.map((option) => [option.value, option.label]),
) as Record<string, string>;

const incapacitatingCommunicationConditions = new Set(['unconscious', 'comatose', 'disoriented', 'non_verbal']);

const optionalTrimmedString = z.preprocess(
  (value) => (typeof value === 'string' ? value.trim() : value),
  z.string().optional(),
);

const optionalEstimatedYears = z.preprocess((value) => {
  if (value === '' || value === null || value === undefined || Number.isNaN(value)) {
    return undefined;
  }

  return Number(value);
}, z.number().min(0, 'Edad estimada no puede ser negativa').optional());

export const quickRegistrationSchema = z
  .object({
    // Identificación
    givenName: z.string().trim().min(1, 'Primer nombre es requerido'),
    familyName: z.string().trim().min(1, 'Apellido paterno es requerido'),
    familyName2: optionalTrimmedString,
    gender: z.enum(['M', 'F', 'U'], { required_error: 'Sexo es requerido' }),
    yearsEstimated: optionalEstimatedYears,
    birthdate: optionalTrimmedString,
    identifierType: optionalTrimmedString,
    identifier: optionalTrimmedString,
    nationality: optionalTrimmedString,
    isUnknown: z.boolean().optional(),
    arrivalDateTime: z.string().trim().min(1, 'Fecha y hora de ingreso es requerida'),
    communicationCondition: optionalTrimmedString,
    identificationStatus: z.enum(['pending', 'partial', 'confirmed', 'merged']).optional(),
    administrativeNotes: z.string().trim().max(500, 'Observaciones no puede exceder 500 caracteres').optional(),
    // Ubicación
    district: optionalTrimmedString,
    village: optionalTrimmedString,
    address: optionalTrimmedString,
    // Seguro
    insuranceType: optionalTrimmedString,
    insuranceCode: optionalTrimmedString,
    // Acompañante / responsable
    responsibleType: optionalTrimmedString,
    companionName: optionalTrimmedString,
    companionAge: optionalTrimmedString,
    companionRelationship: optionalTrimmedString,
  })
  .superRefine((data, ctx) => {
    const isIncapacitated =
      !!data.isUnknown ||
      (!!data.communicationCondition && incapacitatingCommunicationConditions.has(data.communicationCondition));

    if (data.isUnknown && !data.communicationCondition) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['communicationCondition'],
        message: 'Condición de comunicación es requerida',
      });
    }

    if (isIncapacitated && !data.responsibleType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['responsibleType'],
        message: 'Tipo de responsable es requerido',
      });
    }

    if (isIncapacitated && !data.companionName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['companionName'],
        message: 'Responsable o acompañante es requerido',
      });
    }
  });

export type QuickRegistrationFormData = z.infer<typeof quickRegistrationSchema>;

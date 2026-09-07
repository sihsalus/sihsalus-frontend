import { zodResolver } from '@hookform/resolvers/zod';
import { parseDate, useConfig } from '@openmrs/esm-framework';
import { type Drug, type DrugOrderBasketItem } from '@openmrs/esm-patient-common-lib';
import { useMemo } from 'react';
import { type UseFormReturn, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useRequireOutpatientQuantity } from '../api';
import { type ConfigObject } from '../config-schema';

export function useDrugOrderForm(initialOrderBasketItem: DrugOrderBasketItem) {
  const medicationOrderFormSchema = useCreateMedicationOrderFormSchema();

  const defaultValues = useMemo(() => {
    const defaultStartDate =
      typeof initialOrderBasketItem?.startDate === 'string'
        ? parseDate(initialOrderBasketItem?.startDate)
        : ((initialOrderBasketItem?.startDate as Date) ?? new Date());

    return drugOrderBasketItemToFormValue(initialOrderBasketItem, defaultStartDate);
  }, [initialOrderBasketItem]);

  const drugOrderForm: UseFormReturn<MedicationOrderFormData> = useForm<MedicationOrderFormData>({
    mode: 'all',
    resolver: zodResolver(medicationOrderFormSchema),
    defaultValues,
  });

  return drugOrderForm;
}

export function drugOrderBasketItemToFormValue(item: DrugOrderBasketItem, startDate: Date): MedicationOrderFormData {
  return {
    drug: item?.drug as Partial<Drug>,
    isFreeTextDosage: item?.isFreeTextDosage ?? false,
    freeTextDosage: item?.freeTextDosage,
    dosage: item?.dosage ?? null,
    unit: item?.unit,
    route: item?.route,
    patientInstructions: item?.patientInstructions ?? '',
    asNeeded: item?.asNeeded ?? false,
    asNeededCondition: item?.asNeededCondition ?? '',
    duration: item?.duration ?? null,
    durationUnit: item?.durationUnit ?? null,
    pillsDispensed: item?.pillsDispensed ?? null,
    quantityUnits: item?.quantityUnits ?? null,
    numRefills: item?.numRefills ?? null,
    indication: item?.indication ?? '',
    frequency: item?.frequency ?? null,
    urgency: item?.urgencyCode ?? item?.urgency ?? 'ROUTINE',
    startDate,
  };
}

export function useCreateMedicationOrderFormSchema() {
  const { t } = useTranslation();
  const { requireOutpatientQuantity } = useRequireOutpatientQuantity();
  const { requireIndication, singleDoseFrequencyUuid } = useConfig<ConfigObject>();

  const schema = useMemo(() => {
    const comboSchema = {
      default: z.boolean().optional(),
      value: z.string(),
      valueCoded: z.string(),
    };

    const frequencySchema = {
      ...comboSchema,
      frequencyPerDay: z.number().nullish(),
    };

    const baseSchemaFields = {
      urgency: z.string().refine((value) => ['ROUTINE', 'STAT', 'ON_SCHEDULED_DATE'].includes(value), {
        message: t('medicationUrgencyRequired', 'Select the prescription urgency'),
      }),
      drug: z
        .object(
          {
            uuid: z.string(),
            concept: z
              .object({
                uuid: z.string(),
              })
              .passthrough(),
            dosageForm: z
              .object({
                uuid: z.string(),
              })
              .passthrough()
              .nullable(),
            strength: z.string().nullable(),
            display: z.string().nullable(),
          },
          {
            message: t('drugRequiredErrorMessage', 'Drug is required'),
          },
        )
        .passthrough(),
      freeTextDosage: z.string().refine((value) => value.trim().length > 0, {
        message: t('freeDosageErrorMessage', 'Add free dosage note'),
      }),
      dosage: z
        .number()
        .nullable()
        .refine((value) => value !== null, {
          message: t('dosageRequiredErrorMessage', 'Dosage is required'),
        })
        .refine((value) => value === null || value > 0, {
          message: t('dosageGreaterThanZeroErrorMessage', 'Dose must be greater than 0'),
        }),
      unit: z
        .object({ ...comboSchema })
        .nullable()
        .refine((value) => Boolean(value), {
          message: t('selectUnitErrorMessage', 'Dose unit is required'),
        }),
      route: z
        .object({ ...comboSchema })
        .nullable()
        .refine((value) => Boolean(value), {
          message: t('selectRouteErrorMessage', 'Route is required'),
        }),
      patientInstructions: z.string().nullable(),
      asNeeded: z.boolean(),
      asNeededCondition: z.string().nullable(),
      duration: z
        .number()
        .nullable()
        .refine((value) => value === null || value > 0, {
          message: t('durationGreaterThanZeroErrorMessage', 'Duration must be greater than 0'),
        }),
      durationUnit: z.object({ ...comboSchema }).nullable(),
      indication: requireIndication
        ? z.string().refine((value) => value.trim().length > 0, {
            message: t('indicationErrorMessage', 'Indication is required'),
          })
        : z.string().nullish(),
      startDate: z.date(),
      frequency: z
        .object({ ...frequencySchema })
        .nullable()
        .refine((value) => Boolean(value), {
          message: t('selectFrequencyErrorMessage', 'Frequency is required'),
        }),
    };

    const outpatientDrugOrderFields = {
      pillsDispensed: z
        .number()
        .nullable()
        .refine(
          (value) => {
            if (requireOutpatientQuantity && (typeof value !== 'number' || value < 1)) {
              return false;
            }
            return true;
          },
          {
            message: t('pillDispensedErrorMessage', 'Quantity to dispense is required'),
          },
        ),
      quantityUnits: z
        .object(comboSchema)
        .nullable()
        .refine(
          (value) => {
            if (requireOutpatientQuantity && !value) {
              return false;
            }
            return true;
          },
          {
            message: t('selectQuantityUnitsErrorMessage', 'Quantity unit is required'),
          },
        ),
      numRefills: z
        .number()
        .nullable()
        .refine(
          (value) => {
            if (requireOutpatientQuantity && (typeof value !== 'number' || value < 0)) {
              return false;
            }
            return true;
          },
          {
            message: t('numRefillsErrorMessage', 'Number of refills is required'),
          },
        ),
    };

    const nonFreeTextDosageSchema = z.object({
      ...baseSchemaFields,
      ...outpatientDrugOrderFields,
      isFreeTextDosage: z.literal(false),
      freeTextDosage: z.string().nullable(),
    });

    const freeTextDosageSchema = z.object({
      ...baseSchemaFields,
      ...outpatientDrugOrderFields,
      isFreeTextDosage: z.literal(true),
      dosage: z.number().nullable(),
      unit: z.object(comboSchema).nullable(),
      route: z.object(comboSchema).nullable(),
      frequency: z.object(frequencySchema).nullable(),
    });

    return z
      .discriminatedUnion('isFreeTextDosage', [nonFreeTextDosageSchema, freeTextDosageSchema])
      .superRefine((data, context) => {
        const hasDuration = typeof data.duration === 'number';
        const hasDurationUnit = Boolean(data.durationUnit);
        const isSingleDose = Boolean(singleDoseFrequencyUuid && data.frequency?.valueCoded === singleDoseFrequencyUuid);

        if (isSingleDose) {
          if (data.urgency === 'STAT' && data.startDate.toDateString() !== new Date().toDateString()) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              message: t(
                'singleDoseStatStartDate',
                'An immediate single dose must start today. Apply the STAT single-dose preset to review this prescription.',
              ),
              path: ['startDate'],
            });
          }
          for (const [path, invalid] of [
            ['duration', hasDuration || hasDurationUnit],
            ['asNeeded', data.asNeeded || Boolean(data.asNeededCondition?.trim())],
            ['numRefills', data.numRefills !== 0],
            ['isFreeTextDosage', data.isFreeTextDosage],
          ] as const) {
            if (invalid) {
              context.addIssue({
                code: z.ZodIssueCode.custom,
                message: t(
                  'singleDoseRegimenError',
                  'A single dose requires structured dosing, no treatment duration, no as-needed use and zero refills.',
                ),
                path: [path],
              });
            }
          }
        }

        if (!isSingleDose && (requireOutpatientQuantity || hasDurationUnit) && !hasDuration) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: t('durationRequiredErrorMessage', 'Treatment duration is required'),
            path: ['duration'],
          });
        }

        if (!isSingleDose && (requireOutpatientQuantity || hasDuration) && !hasDurationUnit) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: t('durationUnitRequiredErrorMessage', 'Duration unit is required'),
            path: ['durationUnit'],
          });
        }

        if (data.asNeeded && !data.asNeededCondition?.trim()) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: t('prnReasonRequiredErrorMessage', 'Specify the reason for as-needed medication'),
            path: ['asNeededCondition'],
          });
        }
      });
  }, [requireIndication, requireOutpatientQuantity, singleDoseFrequencyUuid, t]);

  return schema;
}

export type MedicationOrderFormData = z.infer<ReturnType<typeof useCreateMedicationOrderFormSchema>>;

export function durationToDays(
  duration: number | null,
  durationUnitUuid: string | null,
  durationUnitsDaysMap: Record<string, number>,
): number | null {
  if (duration == null || !durationUnitUuid) {
    return null;
  }
  const multiplier = durationUnitsDaysMap[durationUnitUuid];
  if (multiplier == null) {
    return null;
  }
  return duration * multiplier;
}

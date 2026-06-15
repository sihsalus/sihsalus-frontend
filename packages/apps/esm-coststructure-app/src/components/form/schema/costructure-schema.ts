import { z } from 'zod';

export const costStructureSchema = z.object({
  procedure: z.object({
    conceptId: z.number().positive('Debe seleccionar un procedimiento válido'),
    nameFull: z.string().min(1, 'Debe ingresar un procedimiento válido'),
    code: z.string().optional(),
  }),
  infrastructures: z.array(
    z.object({
      infrastructureId: z.number().positive('Debe seleccionar una infraestructura válida'),
      areaM2: z.number().nonnegative(),
      infrastructureName: z.string(),
      constructionCost: z.number().nonnegative(),
      timePerformanceMinutes: z.number().nonnegative(),
    }),
  ),
  publicServices: z.array(
    z.object({
      ups: z.string(),
      energyConsumption: z.number().nonnegative(),
      waterConsumption: z.number().nonnegative(),
      phoneNetConsumption: z.number().nonnegative(),
      energyInductor: z.number().nonnegative(),
      waterInductor: z.number().nonnegative(),
      phoneNetInductor: z.number().nonnegative(),
      totalCostEnergy: z.number().nonnegative(),
      totalCostWater: z.number().nonnegative(),
      totalCostPhoneNet: z.number().nonnegative(),
      totalCost: z.number().nonnegative(),
      productionProyected: z.number().nonnegative(),
    }),
  ),
  annualServicesCost: z.object({
    annualEnergyCost: z.number().nonnegative(),
    annualWaterCost: z.number().nonnegative(),
    annualPhoneNetCost: z.number().nonnegative(),
    annualAdministrativeCost: z.number().nonnegative(),
    annualGeneralCost: z.number().nonnegative(),
  }),
  humanResourceCost: z.array(
    z.object({
      humanResourceId: z.number().positive('Debe seleccionar un recurso humano válido'),
      quantity: z.number().nonnegative(),
      timeMinutes: z.number().nonnegative(),
      priceMonth: z.number().nonnegative(),
      costMinutes: z.number().nonnegative(),
    }),
  ),
  equipmentCost: z.array(
    z.object({
      equipmentId: z.number().positive('Debe seleccionar equipamiento válido'),
      quantity: z.number().nonnegative(),
      price: z.number().nonnegative(),
      usefullYears: z.number().nonnegative(),
      timeMinutes: z.number().nonnegative(),
    }),
  ),
  supplyCost: z.array(
    z.object({
      supplyId: z.number().positive('Debe seleccionar un insumo válido'),
      acquisitionPrice: z.number().nonnegative(),
      quantityUsed: z.number().nonnegative(),
      timeMinutes: z.number().optional(),
      unitAcquisition: z.string(),
      unitConsumption: z.string(),
      equivalence: z.number().positive(),
      name: z.string(),
      type: z.string(),
      unitCost: z.number().nonnegative(),
    }),
  ),
});

export type CostStructureFormValues = z.infer<typeof costStructureSchema>;

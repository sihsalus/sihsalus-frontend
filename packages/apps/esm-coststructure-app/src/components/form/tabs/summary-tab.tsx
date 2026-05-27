import { type UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { calculateCostEquipment, calculateDepreciationMinutes } from '../../../utils/equipments';
import { calculateCostPerMinuteHumanResource, calculateUnitCostHumanResource } from '../../../utils/humanresource';
import {
  calculateDepreciationByMinutes,
  calculateInfrastructureStandardCost,
  calculateTotalValidConsruction,
} from '../../../utils/infrastructure';
import {
  calculateAsignedCost,
  calculateAsignedCostGeneral,
  calculateUnitCostService,
} from '../../../utils/publicservices';
import { calculateStandarCostSupply } from '../../../utils/supply';
import { type CostStructureFormValues } from '../schema/costructure-schema';

import styles from './tabs.styles.scss';

interface Props {
  form: UseFormReturn<CostStructureFormValues>;
}

export default function SummaryTab({ form }: Props) {
  const { t } = useTranslation();
  const { watch } = form;

  // Datos observados
  const supplyData = watch('supplyCost') || [];
  const infrastructure = watch('infrastructures') || [];
  const humanResource = watch('humanResourceCost') || [];
  const annualServices = watch('annualServicesCost');
  const equipment = watch('equipmentCost') || [];
  const publicServices = watch('publicServices') || [];

  const totalAreaM2 = infrastructure.reduce((acc, curr) => acc + (curr.areaM2 || 0), 0);

  // ===================================================================================
  // RECURSOS HUMANOS
  // ===================================================================================
  const humanResourceSummary = humanResource.reduce((sum, curr) => {
    if (!curr.priceMonth || !curr.timeMinutes || !curr.quantity) return sum;

    const costPerMinute = calculateCostPerMinuteHumanResource(curr.priceMonth);
    const unitCost = calculateUnitCostHumanResource(costPerMinute, curr.timeMinutes, curr.quantity);

    return sum + (unitCost || 0);
  }, 0);

  // ===================================================================================
  // INFRAESTRUCTURA
  // ===================================================================================
  const infrastructureSummary = infrastructure.reduce((sum, curr) => {
    if (!curr.areaM2 || !curr.constructionCost || !curr.timePerformanceMinutes) return sum;

    const validConstruction = calculateTotalValidConsruction(curr.areaM2, curr.constructionCost);
    const depreciation = calculateDepreciationByMinutes(validConstruction);
    const unitCost = calculateInfrastructureStandardCost(depreciation, curr.timePerformanceMinutes);

    return sum + (unitCost || 0);
  }, 0);

  // ===================================================================================
  // EQUIPAMIENTO
  // ===================================================================================
  const equipmentSummary = equipment.reduce((sum, curr) => {
    if (!curr.usefullYears || !curr.price || !curr.timeMinutes || !curr.quantity) return sum;

    const depreciation = calculateDepreciationMinutes(curr.usefullYears, curr.price);
    const unitCost = calculateCostEquipment(depreciation, curr.timeMinutes, curr.quantity);

    return sum + (unitCost || 0);
  }, 0);

  // ===================================================================================
  // SERVICIOS BÁSICOS
  // ===================================================================================
  const basicServicesSummary = (() => {
    if (!publicServices.length) return 0;

    const totalInductorWater = publicServices.reduce((a, c) => a + (c.waterInductor || 0), 0);
    const totalInductorEnergy = publicServices.reduce((a, c) => a + (c.energyInductor || 0), 0);
    const totalInductorPhone = publicServices.reduce((a, c) => a + (c.phoneNetInductor || 0), 0);

    return publicServices.reduce((sum, curr) => {
      const energy = calculateAsignedCost(
        annualServices.annualEnergyCost || 0,
        totalInductorEnergy,
        curr.energyInductor || 0,
      );
      const water = calculateAsignedCost(
        annualServices.annualWaterCost || 0,
        totalInductorWater,
        curr.waterInductor || 0,
      );
      const phone = calculateAsignedCost(
        annualServices.annualPhoneNetCost || 0,
        totalInductorPhone,
        curr.phoneNetInductor || 0,
      );

      const totalAssigned = energy + water + phone;

      const unitCost = curr.productionProyected > 0 ? totalAssigned / curr.productionProyected : 0;

      return sum + (unitCost || 0);
    }, 0);
  })();

  // ===================================================================================
  // SERVICIOS ADMINISTRATIVOS
  // ===================================================================================
  const adminServicesSummary = publicServices.reduce((sum, curr, index) => {
    const infra = infrastructure[index];
    if (!infra || !curr.productionProyected) return sum;

    const adminCost = annualServices.annualAdministrativeCost || 0;
    const asigned = calculateAsignedCostGeneral(adminCost, totalAreaM2, infra.areaM2 || 0);

    const unitCost = calculateUnitCostService(asigned, curr.productionProyected);

    return sum + (unitCost || 0);
  }, 0);

  // ===================================================================================
  // SERVICIOS GENERALES
  // ===================================================================================
  const generalServicesSummary = publicServices.reduce((sum, curr, index) => {
    const infra = infrastructure[index];
    if (!infra || !curr.productionProyected) return sum;

    const generalCost = annualServices.annualGeneralCost || 0;
    const asigned = calculateAsignedCostGeneral(generalCost, totalAreaM2, infra.areaM2 || 0);

    const unitCost = calculateUnitCostService(asigned, curr.productionProyected);

    return sum + (unitCost || 0);
  }, 0);

  // ===================================================================================
  // SUMMARY
  // ===================================================================================
  const supplySummary = supplyData.reduce((sum, curr) => {
    if (!curr.unitCost || !curr.quantityUsed || !curr.timeMinutes) return sum;
    const unitCost = calculateStandarCostSupply(curr.unitCost, curr.quantityUsed, curr.timeMinutes);
    return sum + (unitCost || 0);
  }, 0);

  // ===================================================================================
  // COSTO TOTAL DEL PROCEDIMIENTO
  // ===================================================================================
  const totalCost =
    humanResourceSummary +
    equipmentSummary +
    infrastructureSummary +
    basicServicesSummary +
    adminServicesSummary +
    generalServicesSummary +
    supplySummary;

  return (
    <section className={styles['tab-container']}>
      <div>
        <h4 className="cds--heading-04">{t('costStructureSummary', 'Resumen de estructura de costos')}</h4>
      </div>

      <div className="cds--row">
        <div className="cds--col cds--spacing-03">
          <table className="cds--data-table cds--data-table--compact cds--data-table--zebra">
            <thead>
              <tr>
                <th>{t('humanResourcesCostSoles', 'Recursos Humanos (S/.)')}</th>
                <th>{t('suppliesCostSoles', 'Insumos (S/.)')}</th>
                <th>{t('basicServicesCostSoles', 'Servicios Básicos (S/.)')}</th>
                <th>{t('equipmentCostSoles', 'Equipamiento (S/.)')}</th>
                <th>{t('infrastructureCostSoles', 'Infraestructura (S/.)')}</th>
                <th>{t('administrativeServicesCostSoles', 'Servicios Administrativos (S/.)')}</th>
                <th>{t('generalServicesCostSoles', 'Servicios Generales (S/.)')}</th>
                <th>{t('procedureTotalCostSoles', 'Costo Total del procedimiento (S/.)')}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{humanResourceSummary.toFixed(2)}</td>
                <td>{supplySummary.toFixed(2)}</td>
                <td>{basicServicesSummary.toFixed(2)}</td>
                <td>{equipmentSummary.toFixed(2)}</td>
                <td>{infrastructureSummary.toFixed(2)}</td>
                <td>{adminServicesSummary.toFixed(2)}</td>
                <td>{generalServicesSummary.toFixed(2)}</td>
                <td>{totalCost.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

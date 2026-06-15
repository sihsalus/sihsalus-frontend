import { NumberInput } from '@carbon/react';
import { Controller, type UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { calculateAsignedCostGeneral } from '../../../utils/publicservices';
import NoContent from '../../ui/NoContent/NoContent';
import { type CostStructureFormValues } from '../schema/costructure-schema';

import styles from './tabs.styles.scss';

interface Props {
  form: UseFormReturn<CostStructureFormValues>;
}
export default function GeneralServiceTab({ form }: Props) {
  const { control, watch } = form;
  const { t } = useTranslation();

  const annualServices = watch('annualServicesCost');
  const infrastructures = watch('infrastructures');
  const publicServices = watch('publicServices');
  const totalAreaM2 = infrastructures.reduce((acc, curr) => acc + curr.areaM2, 0);
  return (
    <section className={styles['tab-container']}>
      <div>
        <div className="cds--col">
          <h4 className="cds--heading-04">{t('generalServices', 'General Services')}</h4>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '1rem' }}>
        <Controller
          name={`annualServicesCost.annualAdministrativeCost`}
          control={control}
          render={({ field }) => (
            <NumberInput
              hideSteppers
              label={t('annualAdministrativeCost', 'Annual Administrative Cost')}
              helperText={t('enterAnnualAdministrativeCost', 'Enter the annual administrative cost')}
              id={`annual-administrative-cost`}
              value={field.value}
              onChange={(_, { value }) => field.onChange(Number(value))}
            />
          )}
        />
        <Controller
          name={`annualServicesCost.annualGeneralCost`}
          control={control}
          render={({ field }) => (
            <NumberInput
              hideSteppers
              label={t('annualGeneralCost', 'Annual General Services Cost')}
              helperText={t('enterAnnualGeneralCost', 'Enter the annual general services cost')}
              id={`annual-general-cost`}
              value={field.value}
              onChange={(_, { value }) => field.onChange(Number(value))}
            />
          )}
        />
      </div>
      <hr />
      <div className="cds--row">
        <div className="cds--col cds--spacing-03">
          <table className="cds--data-table cds--data-table--compact cds--data-table--zebra">
            <thead>
              <tr>
                <th>{t('upss', 'Service Production Unit (UPSS)')}</th>
                <th>{t('adminCost', 'Administrative Cost')}</th>
                <th>{t('generalServicesCost', 'General Services Cost')}</th>
                <th>{t('projectedProduction', 'Projected procedure production')}</th>
                <th>{t('adminUnitCostIndirect', 'Indirect Standard Admin Unit Cost')}</th>
                <th>{t('generalUnitCostIndirect', 'Indirect Standard General Unit Cost')}</th>
              </tr>
            </thead>
            <tbody>
              {infrastructures.length > 0 ? (
                infrastructures.map((infrastructure, index) => {
                  const generalCost = annualServices.annualGeneralCost || 0;
                  const administrativeCost = annualServices.annualAdministrativeCost || 0;
                  const asignedGeneralCost = calculateAsignedCostGeneral(
                    generalCost,
                    totalAreaM2,
                    infrastructure.areaM2,
                  );
                  const asignedAdminCost = calculateAsignedCostGeneral(
                    administrativeCost,
                    totalAreaM2,
                    infrastructure.areaM2,
                  );
                  const proyectedProduction = publicServices[index]?.productionProyected;
                  let adminCostUnit = 0;
                  let generalCostUnit = 0;
                  if (proyectedProduction > 0) {
                    adminCostUnit = asignedAdminCost / proyectedProduction;
                    generalCostUnit = asignedGeneralCost / proyectedProduction;
                  }
                  return (
                    <tr key={index}>
                      <td>{infrastructure.infrastructureName || t('notSelected', 'Not selected')}</td>
                      <td>{asignedAdminCost}</td>
                      <td>{asignedGeneralCost}</td>
                      <td>
                        <Controller
                          name={`publicServices.${index}.productionProyected`}
                          control={control}
                          render={({ field }) => (
                            <NumberInput
                              hideSteppers
                              id={`phone-${index}`}
                              value={field.value}
                              onChange={(_, { value }) => {
                                field.onChange(Number(value));
                              }}
                              min={0}
                            />
                          )}
                        />
                      </td>
                      <td>{adminCostUnit}</td>
                      <td>{generalCostUnit}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className={styles['empty-state-container']}>
                    <NoContent
                      title={t('noInfrastructuresSelected', 'No infrastructures selected')}
                      message={t('addSomeInfrastructureFirst', 'Add some infrastructures first')}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

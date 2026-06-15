import { NumberInput } from '@carbon/react';
import { Controller, type UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { calculateAsignedCost, calculateInductor } from '../../../utils/publicservices';
import NoContent from '../../ui/NoContent/NoContent';
import { type CostStructureFormValues } from '../schema/costructure-schema';

import styles from './tabs.styles.scss';

interface Props {
  form: UseFormReturn<CostStructureFormValues>;
}

export default function PublicServicesTab({ form }: Props) {
  const { control, watch, setValue } = form;
  const { t } = useTranslation();

  const infrastructures = watch('infrastructures');
  const publicServices = watch('publicServices');
  const annualServices = watch('annualServicesCost');

  return (
    <section className={styles['tab-container']}>
      <div className="">
        <div className="cds--col">
          <h4 className="cds--heading-04">{t('publicServices', 'Public Services')}</h4>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '1rem' }}>
        <Controller
          name={`annualServicesCost.annualEnergyCost`}
          control={control}
          render={({ field }) => (
            <NumberInput
              hideSteppers
              label={t('annualEnergyCost', 'Annual Energy Cost')}
              helperText={t('enterAnnualEnergyCost', 'Enter the annual energy cost')}
              id={`annual-energy-cost`}
              value={field.value}
              onChange={(_, { value }) => field.onChange(Number(value))}
            />
          )}
        />
        <Controller
          name={`annualServicesCost.annualWaterCost`}
          control={control}
          render={({ field }) => (
            <NumberInput
              hideSteppers
              label={t('annualWaterCost', 'Annual Water Cost')}
              helperText={t('enterAnnualWaterCost', 'Enter the annual water cost')}
              id={`annual-water-cost`}
              value={field.value}
              onChange={(_, { value }) => field.onChange(Number(value))}
            />
          )}
        />
        <Controller
          name={`annualServicesCost.annualPhoneNetCost`}
          control={control}
          render={({ field }) => (
            <NumberInput
              hideSteppers
              label={t('annualPhoneNetCost', 'Annual Phone/Internet Cost')}
              helperText={t('enterAnnualPhoneNetCost', 'Enter the annual phone/internet cost')}
              id={`annual-phonenet-cost`}
              value={field.value}
              onChange={(_, { value }) => field.onChange(Number(value))}
            />
          )}
        />
      </div>
      <div className="cds--row">
        <div className="cds--col cds--spacing-03">
          <table className="cds--data-table cds--data-table--compact cds--data-table--zebra">
            <thead>
              <tr>
                <th>{t('upss', 'Service Production Unit (UPSS)')}</th>
                <th>{t('energyConsumption', 'Energy Consumption')}</th>
                <th>{t('waterConsumption', 'Water Consumption')}</th>
                <th>{t('phoneConsumption', 'Phone Consumption')}</th>
                <th>{t('waterInductors', 'Water Inductors')}</th>
                <th>{t('energyInductors', 'Energy Inductors')}</th>
                <th>{t('phoneInductors', 'Phone Inductors')}</th>
              </tr>
            </thead>

            <tbody>
              {/* Renderizar una fila por cada infraestructura */}
              {infrastructures.length > 0 ? (
                infrastructures.map((infrastructure, index) => (
                  <tr key={index}>
                    <td>{infrastructure.infrastructureName || t('notSelected', 'Not selected')}</td>{' '}
                    {/* Mostrar el nombre de la infraestructura */}
                    {/* Consumo de energía */}
                    <td>
                      <Controller
                        name={`publicServices.${index}.energyConsumption`}
                        control={control}
                        render={({ field }) => (
                          <NumberInput
                            hideSteppers
                            id={`energy-${index}`}
                            value={field.value}
                            onChange={(_, { value }) => {
                              field.onChange(Number(value));
                              setValue(
                                `publicServices.${index}.energyInductor`,
                                calculateInductor(Number(value), infrastructure.areaM2),
                              );
                            }}
                            min={0}
                          />
                        )}
                      />
                    </td>
                    {/* Consumo de agua */}
                    <td>
                      <Controller
                        name={`publicServices.${index}.waterConsumption`}
                        control={control}
                        render={({ field }) => (
                          <NumberInput
                            hideSteppers
                            id={`water-${index}`}
                            value={field.value}
                            onChange={(_, { value }) => {
                              field.onChange(Number(value));
                              setValue(
                                `publicServices.${index}.waterInductor`,
                                calculateInductor(Number(value), infrastructure.areaM2),
                              );
                            }}
                            min={0}
                          />
                        )}
                      />
                    </td>
                    {/* Consumo de teléfono */}
                    <td>
                      <Controller
                        name={`publicServices.${index}.phoneNetConsumption`}
                        control={control}
                        render={({ field }) => (
                          <NumberInput
                            hideSteppers
                            id={`phone-${index}`}
                            value={field.value}
                            onChange={(_, { value }) => {
                              field.onChange(Number(value));
                              setValue(
                                `publicServices.${index}.phoneNetInductor`,
                                calculateInductor(Number(value), infrastructure.areaM2),
                              );
                            }}
                            min={0}
                          />
                        )}
                      />
                    </td>
                    <td>{calculateInductor(publicServices[index]?.energyConsumption ?? 0, infrastructure.areaM2)}</td>
                    <td>{calculateInductor(publicServices[index]?.waterConsumption ?? 0, infrastructure.areaM2)}</td>
                    <td>{calculateInductor(publicServices[index]?.phoneNetConsumption ?? 0, infrastructure.areaM2)}</td>
                    {/* Total de inductores */}
                  </tr>
                ))
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
      <hr />
      <div>
        <div className="cds--col">
          <h4 className="cds--heading-04">{t('annualServiceCosts', 'Annual Service Costs')}</h4>
        </div>
        <div className="cds--row">
          <div className="cds--col cds--spacing-03">
            <table className="cds--data-table cds--data-table--compact cds--data-table--zebra">
              <thead>
                <tr>
                  <th>{t('ups', 'UPS')}</th>
                  <th>{t('energyCost', 'Energy Cost')}</th>
                  <th>{t('waterCost', 'Water Cost')}</th>
                  <th>{t('phoneInternetCost', 'Phone/Internet Cost')}</th>
                  <th>{t('totalAssignedCost', 'Total Assigned Cost')}</th>
                  <th>{t('projectedProduction', 'Projected procedure production')}</th>
                  <th>{t('unitCost', 'Unit Cost (S/.)')}</th>
                </tr>
              </thead>
              <tbody>
                {infrastructures.length > 0 ? (
                  infrastructures.map((infrastructure, index) => {
                    const publicService = publicServices[index];
                    const waterInductor = publicService?.waterInductor ?? 0;
                    const energyInductor = publicService?.energyInductor ?? 0;
                    const phoneNetInductor = publicService?.phoneNetInductor ?? 0;
                    const totalInductorWater = publicServices.reduce((acc, curr) => acc + (curr.waterInductor ?? 0), 0);
                    const totalInductorEnergy = publicServices.reduce(
                      (acc, curr) => acc + (curr.energyInductor ?? 0),
                      0,
                    );
                    const totalInductorPhone = publicServices.reduce(
                      (acc, curr) => acc + (curr.phoneNetInductor ?? 0),
                      0,
                    );
                    const totalCostEnergy = calculateAsignedCost(
                      annualServices.annualEnergyCost,
                      totalInductorEnergy,
                      energyInductor,
                    );
                    const totalCostWater = calculateAsignedCost(
                      annualServices.annualWaterCost,
                      totalInductorWater,
                      waterInductor,
                    );
                    const totalCostPhone = calculateAsignedCost(
                      annualServices.annualPhoneNetCost,
                      totalInductorPhone,
                      phoneNetInductor,
                    );
                    const totalCostAssigned = totalCostEnergy + totalCostWater + totalCostPhone;
                    const costPerUnit =
                      publicService?.productionProyected > 0
                        ? totalCostAssigned / publicService.productionProyected
                        : 0;
                    return (
                      <tr key={index}>
                        <td>{infrastructure.infrastructureName || t('notSelected', 'Not selected')}</td>
                        <td>{totalCostEnergy}</td>
                        <td>{totalCostWater}</td>
                        <td>{totalCostPhone}</td>
                        <td>{totalCostAssigned}</td>
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
                        <td>{costPerUnit}</td>
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
      </div>
    </section>
  );
}

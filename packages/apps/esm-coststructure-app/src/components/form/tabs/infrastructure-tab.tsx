import { Button, NumberInput, Select, SelectItem } from '@carbon/react';
import { Add, TrashCan } from '@carbon/react/icons';
import { Controller, type UseFormReturn, useFieldArray } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import useGetInfrastructure from '../../../hooks/use-get-infrastructure';
import { calculateDepreciationByMinutes, calculateTotalValidConsruction } from '../../../utils/infrastructure';
import NoContent from '../../ui/NoContent/NoContent';
import { type CostStructureFormValues } from '../schema/costructure-schema';

import styles from './tabs.styles.scss';

interface Props {
  form: UseFormReturn<CostStructureFormValues>;
}
export default function InfrastructureTab({ form }: Props) {
  const { t } = useTranslation();

  const { infrastructure: infrastructures } = useGetInfrastructure();
  const { control, setValue, watch } = form;
  const infrastructureRows = watch('infrastructures') || [];
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'infrastructures',
  });

  const { append: publicServiceAppend, remove: publicServiceRemove } = useFieldArray({
    control,
    name: 'publicServices',
  });

  const handleInfrastructureChange = (index: number, field: { onChange: (val: number) => void }, id: string) => {
    field.onChange(Number(id));
    const infra = infrastructures.find((i) => i.id === Number(id));
    if (infra) {
      setValue(`infrastructures.${index}.areaM2`, infra.areaM2);
      setValue(`infrastructures.${index}.constructionCost`, infra.constructionCost);
      setValue(`infrastructures.${index}.infrastructureName`, infra.locationName);
    }
  };

  const handleCreateRow = () => {
    append({
      infrastructureId: 0,
      areaM2: 0,
      constructionCost: 0,
      timePerformanceMinutes: 0,
      infrastructureName: '',
    });
    publicServiceAppend({
      ups: '',
      energyConsumption: 0,
      waterConsumption: 0,
      phoneNetConsumption: 0,
      energyInductor: 0,
      waterInductor: 0,
      phoneNetInductor: 0,
      totalCostEnergy: 0,
      totalCostWater: 0,
      totalCostPhoneNet: 0,
      totalCost: 0,
      productionProyected: 0,
    });
  };

  return (
    <section className={styles['tab-container']}>
      <div>
        <div className="cds--col">
          <h4 className="cds--heading-04">{t('infrastructure', 'Infraestructura')}</h4>
        </div>
        <div className="cds--col" style={{ textAlign: 'right' }}>
          <Button kind="primary" size="md" onClick={handleCreateRow}>
            <Add size={16} />
            {t('addInfrastructure', 'Agregar Infraestructura')}
          </Button>
        </div>
      </div>
      {/* Tabla editable */}
      <div className="cds--row">
        <div className="cds--col cds--spacing-03">
          <table className="cds--data-table cds--data-table--compact cds--data-table--zebra">
            <thead>
              <tr>
                <th>{t('ups', 'UPS')}</th>
                <th>{t('areaM2', 'Área (m²)')}</th>
                <th>{t('constructionCost', 'Costo Construcción (S/.)')}</th>
                <th>{t('totalConstructionValue', 'Valor Total de Construcción de UPSS(S/.)')}</th>
                <th>{t('depreciationPerMinuteUps', 'Valor de depreciación de UPS por Minuto(S/.)')}</th>
                <th>{t('performanceTimeMinutes', 'Tiempo de Rendimiento de UPSS (min)')}</th>
                <th>{t('standardCost', 'Costo Estandar (S/.)')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {fields.length > 0 ? (
                fields.map((row, index) => {
                  const infrastructure = infrastructureRows[index];
                  const totalConstruction = calculateTotalValidConsruction(
                    infrastructure?.areaM2 || 0,
                    infrastructure?.constructionCost || 0,
                  );
                  const depreciationPerMinute = calculateDepreciationByMinutes(totalConstruction);
                  const standardCost = depreciationPerMinute * (infrastructure?.timePerformanceMinutes || 0);

                  return (
                    <tr key={row.id}>
                      <td>
                        <Controller
                          name={`infrastructures.${index}.infrastructureId`}
                          control={control}
                          render={({ field }) => (
                            <Select
                              id={`infrastructure-select-${index}`}
                              key={row.id}
                              {...field}
                              onChange={(e) => handleInfrastructureChange(index, field, e.target.value)}
                              labelText=""
                            >
                              <SelectItem text={t('selectInfrastructure', 'Seleccione infraestructura')} value="" />
                              {infrastructures.map((infra) => (
                                <SelectItem key={infra.id} text={infra.locationName} value={infra.id.toString()} />
                              ))}
                            </Select>
                          )}
                        />
                      </td>

                      <td>
                        <Controller
                          name={`infrastructures.${index}.areaM2`}
                          control={control}
                          render={({ field }) => (
                            <NumberInput
                              hideSteppers
                              id={`area-${index}`}
                              value={field.value}
                              readOnly
                              label=""
                              disabled
                            />
                          )}
                        />
                      </td>

                      <td>
                        <Controller
                          name={`infrastructures.${index}.constructionCost`}
                          control={control}
                          render={({ field }) => (
                            <NumberInput hideSteppers id={`cost-${index}`} value={field.value} label="" readOnly />
                          )}
                        />
                      </td>
                      <td>{totalConstruction}</td>
                      <td>{depreciationPerMinute}</td>
                      <td>
                        <Controller
                          name={`infrastructures.${index}.timePerformanceMinutes`}
                          control={control}
                          render={({ field }) => (
                            <NumberInput
                              hideSteppers
                              id={`time-${index}`}
                              value={field.value}
                              label=""
                              onChange={(_, { value }) => field.onChange(Number(value))}
                            />
                          )}
                        />
                      </td>
                      <td>{standardCost}</td>
                      <td>
                        <TrashCan
                          size={16}
                          onClick={() => {
                            remove(index);
                            publicServiceRemove(index);
                          }}
                        />
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className={styles['empty-state-container']}>
                    <NoContent
                      title={t('noInfrastructures', 'No hay Infraestructuras añadidas')}
                      message={t('addSomeInfrastructure', 'Añada alguna Infraestructura')}
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

import { Button, NumberInput, Select, SelectItem } from '@carbon/react';
import { Add } from '@carbon/react/icons';
import { Controller, type UseFormReturn, useFieldArray } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import useGetHumanResource from '../../../hooks/use-get-humanresource';
import { calculateCostPerMinuteHumanResource, calculateUnitCostHumanResource } from '../../../utils/humanresource';
import NoContent from '../../ui/NoContent/NoContent';
import { type CostStructureFormValues } from '../schema/costructure-schema';

import styles from './tabs.styles.scss';

interface Props {
  form: UseFormReturn<CostStructureFormValues>;
}
export default function HumanResourceTab({ form }: Props) {
  const { control, watch } = form;
  const { t } = useTranslation();
  const { fields, append } = useFieldArray({
    control,
    name: 'humanResourceCost',
  });

  const { humanresource } = useGetHumanResource();
  const handleCreateRow = () => {
    append({
      humanResourceId: 0,
      costMinutes: 0,
      priceMonth: 0,
      quantity: 0,
      timeMinutes: 0,
    });
  };

  const humanresourceData = watch('humanResourceCost');

  return (
    <section className={styles['tab-container']}>
      <div>
        <div className="cds--col">
          <h4 className="cds--heading-04">{t('humanResources', 'Recursos Humanos')}</h4>
        </div>
        <div className="cds--col" style={{ textAlign: 'right' }}>
          <Button kind="primary" size="md" onClick={handleCreateRow}>
            <Add size={16} />
            {t('addHumanResource', 'Agregar Recurso Humano')}
          </Button>
        </div>
      </div>
      {/* Tabla editable */}
      <div className="cds--row">
        <div className="cds--col cds--spacing-03">
          <table className="cds--data-table cds--data-table--compact cds--data-table--zebra">
            <thead>
              <tr>
                <th>{t('specialty', 'Especialidad')}</th>
                <th>{t('quantity', 'Cantidad')}</th>
                <th>{t('participationTimeMinutes', 'Tiempo participacion (minutos)')}</th>
                <th>{t('monthlyRemuneration', 'Remuneración mensual (S/.)')}</th>
                <th>{t('costPerMinute', 'Costo por Minuto (S/.)')}</th>
                <th>{t('unitCost', 'Costo Unitario (S/.)')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {fields.length > 0 ? (
                fields.map((row, index) => {
                  const costPerMinute = calculateCostPerMinuteHumanResource(humanresourceData[index].priceMonth);
                  const unitCost = calculateUnitCostHumanResource(
                    costPerMinute,
                    humanresourceData[index].timeMinutes,
                    humanresourceData[index].quantity,
                  );
                  return (
                    <tr key={row.id}>
                      <td>
                        <Controller
                          name={`humanResourceCost.${index}.humanResourceId`}
                          control={control}
                          render={({ field }) => (
                            <Select
                              id={`human-resource-select-${index}`}
                              key={row.id}
                              {...field}
                              onChange={(event) => field.onChange(Number(event.target.value))}
                              labelText=""
                            >
                              <SelectItem text={t('selectHumanResource', 'Seleccione Recurso Humano')} value="" />
                              {humanresource.map((rrh) => (
                                <SelectItem key={rrh.id} text={rrh.speciality} value={rrh.id.toString()} />
                              ))}
                            </Select>
                          )}
                        />
                      </td>
                      <td>
                        <Controller
                          name={`humanResourceCost.${index}.quantity`}
                          control={control}
                          render={({ field }) => (
                            <NumberInput hideSteppers id={`quantity-${index}`} value={field.value} {...field} />
                          )}
                        />
                      </td>
                      <td>
                        <Controller
                          name={`humanResourceCost.${index}.timeMinutes`}
                          control={control}
                          render={({ field }) => (
                            <NumberInput hideSteppers id={`timeMinutes-${index}`} value={field.value} {...field} />
                          )}
                        />
                      </td>
                      <td>
                        <Controller
                          name={`humanResourceCost.${index}.priceMonth`}
                          control={control}
                          render={({ field }) => (
                            <NumberInput hideSteppers id={`priceMonth-${index}`} value={field.value} {...field} />
                          )}
                        />
                      </td>
                      <td>{costPerMinute}</td>
                      <td>{unitCost}</td>
                      <td></td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className={styles['empty-state-container']}>
                    <NoContent
                      title={t('noHumanResources', 'No hay Recursos Humanos añadidos')}
                      message={t('addSomeHumanResources', 'Añada algunos Recursos Humanos')}
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

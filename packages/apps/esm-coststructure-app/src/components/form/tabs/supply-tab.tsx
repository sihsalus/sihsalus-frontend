import { Button, NumberInput, Select, SelectItem, TextInput } from '@carbon/react';
import { Add, TrashCan } from '@carbon/react/icons';
import { Controller, type UseFormReturn, useFieldArray } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import useGetSupply from '../../../hooks/use-get-supply';
import { calculateStandardCostSupply, calculateUnitCostSupply } from '../../../utils/supply';
import NoContent from '../../ui/NoContent/NoContent';
import { type CostStructureFormValues } from '../schema/coststructure-schema';

import styles from './tabs.styles.scss';

interface Props {
  form: UseFormReturn<CostStructureFormValues>;
}

export default function SupplyTab({ form }: Props) {
  const { control, setValue, watch } = form;
  const { t } = useTranslation();

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'supplyCost',
  });
  const { supply, isLoading } = useGetSupply();
  const supplyData = watch('supplyCost');

  const handleSupplyChange = (index: number, field: { onChange: (val: number) => void }, id: string) => {
    field.onChange(Number(id));
    const selectedSupply = supply.find((sup) => sup.id === Number(id));
    if (selectedSupply) {
      setValue(`supplyCost.${index}.unitAcquisition`, selectedSupply.unitAcquisition);
      setValue(`supplyCost.${index}.unitConsumption`, selectedSupply.unitConsumption);
      setValue(`supplyCost.${index}.equivalence`, selectedSupply.equivalence);
      setValue(`supplyCost.${index}.name`, selectedSupply.name);
      setValue(`supplyCost.${index}.type`, selectedSupply.supplyType);
      const acquisitionPrice = watch(`supplyCost.${index}.acquisitionPrice`);
      setValue(`supplyCost.${index}.unitCost`, calculateUnitCostSupply(acquisitionPrice, selectedSupply.equivalence));
    }
  };

  const handleCreateRow = () => {
    append({
      acquisitionPrice: 0,
      equivalence: 0,
      quantityUsed: 0,
      supplyId: 0,
      unitAcquisition: '',
      unitConsumption: '',
      name: t('notSelected', 'Sin seleccionar'),
      type: '',
      unitCost: 0,
    });
  };

  if (isLoading) return <div>{t('loadingSupplies', 'Cargando insumos...')}</div>;
  return (
    <section className={styles['tab-container']}>
      <div>
        <div className="cds--col">
          <h4 className="cds--heading-04">{t('suppliesAndMedicines', 'Insumos y Medicamentos')}</h4>
        </div>
        <div className="cds--col" style={{ textAlign: 'right' }}>
          <Button kind="primary" size="md" onClick={handleCreateRow}>
            <Add size={16} />
            {t('addSupply', 'Agregar Insumo')}
          </Button>
        </div>
      </div>
      {/* Tabla editable */}
      <div className="cds--row">
        <div className="cds--col cds--spacing-03">
          <table className="cds--data-table cds--data-table--compact cds--data-table--zebra">
            <thead>
              <tr>
                <th>{t('suppliesAndMaterials', 'Insumos y Materiales')}</th>
                <th>{t('acquisitionUnit', 'Unidad de Adquisición')}</th>
                <th>{t('consumptionUnit', 'Unidad de Consumo')}</th>
                <th>{t('consumptionEquivalence', 'Equivalencia de consumo')}</th>
                <th>{t('acquisitionPrice', 'Precio de Adquisición')}</th>
                <th>{t('unitCost', 'Costo Unitario (S/.)')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {fields.length > 0 ? (
                fields.map((row, index) => {
                  return (
                    <tr key={row.id}>
                      <td>
                        <Controller
                          name={`supplyCost.${index}.supplyId`}
                          control={control}
                          render={({ field }) => (
                            <Select
                              id={`supplyId-${index}`}
                              key={row.id}
                              {...field}
                              labelText=""
                              onChange={(e) => handleSupplyChange(index, field, e.target.value)}
                            >
                              <SelectItem
                                text={t('selectSupplyOrMedicine', 'Seleccione Insumo o Medicamento')}
                                value=""
                              />
                              {supply.map((sup) => (
                                <SelectItem key={sup.id} text={sup.name} value={sup.id.toString()} />
                              ))}
                            </Select>
                          )}
                        />
                      </td>
                      <td>
                        <Controller
                          name={`supplyCost.${index}.unitAcquisition`}
                          control={control}
                          render={({ field }) => (
                            <TextInput
                              readOnly
                              labelText=""
                              id={`unitAcquisition-${index}`}
                              value={field.value}
                              {...field}
                            />
                          )}
                        />
                      </td>
                      <td>
                        <Controller
                          name={`supplyCost.${index}.unitConsumption`}
                          control={control}
                          render={({ field }) => (
                            <TextInput
                              readOnly
                              labelText=""
                              id={`unitConsumption-${index}`}
                              value={field.value}
                              {...field}
                            />
                          )}
                        />
                      </td>
                      <td>
                        <Controller
                          name={`supplyCost.${index}.equivalence`}
                          control={control}
                          render={({ field }) => (
                            <NumberInput
                              readOnly
                              hideSteppers
                              id={`equivalence-${index}`}
                              value={field.value}
                              {...field}
                            />
                          )}
                        />
                      </td>
                      <td>
                        <Controller
                          name={`supplyCost.${index}.acquisitionPrice`}
                          control={control}
                          render={({ field }) => (
                            <NumberInput
                              hideSteppers
                              id={`acquisitionPrice-${index}`}
                              value={field.value}
                              {...field}
                              onChange={(e) => {
                                const value = Number(e.currentTarget.value);
                                field.onChange(value);

                                const eq = supplyData[index].equivalence;
                                const unitCost = calculateUnitCostSupply(value, eq);

                                setValue(`supplyCost.${index}.unitCost`, unitCost);
                              }}
                            />
                          )}
                        />
                      </td>
                      <td>
                        <Controller
                          name={`supplyCost.${index}.unitCost`}
                          control={control}
                          render={({ field }) => (
                            <NumberInput
                              hideSteppers
                              readOnly
                              id={`unitCost-${index}`}
                              value={field.value}
                              {...field}
                            />
                          )}
                        />
                      </td>
                      <td>
                        <TrashCan size={16} onClick={() => remove(index)} />
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className={styles['empty-state-container']}>
                    <NoContent
                      title={t('noSupplies', 'No hay insumos añadidos')}
                      message={t('addSomeSupplies', 'Añada algunos insumos o medicamentos')}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="cds--row">
        <div className="cds--col cds--spacing-03">
          <table className="cds--data-table cds--data-table--compact cds--data-table--zebra">
            <thead>
              <tr>
                <th>{t('suppliesAndMaterials', 'Insumos y Materiales')}</th>
                <th>{t('timeMinutes', 'Tiempo (minutos)')}</th>
                <th>{t('quantity', 'Cantidad')}</th>
                <th>{t('unitCost', 'Costo Unitario')}</th>
                <th>{t('standardCost', 'Costo Estandar (S/.)')}</th>
              </tr>
            </thead>
            <tbody>
              {supplyData && supplyData.length > 0 ? (
                supplyData.map((sup, index) => {
                  return (
                    <tr key={index}>
                      <td>{sup.name}</td>
                      <td>
                        <Controller
                          name={`supplyCost.${index}.timeMinutes`}
                          control={control}
                          render={({ field }) => (
                            <NumberInput hideSteppers id={`timeMinutes-${index}`} value={field.value} {...field} />
                          )}
                        />
                      </td>
                      <td>
                        <Controller
                          name={`supplyCost.${index}.quantityUsed`}
                          control={control}
                          render={({ field }) => (
                            <NumberInput hideSteppers id={`quantityUsed-${index}`} value={field.value} {...field} />
                          )}
                        />
                      </td>
                      <td>{sup.unitCost}</td>
                      <td>{calculateStandardCostSupply(sup.unitCost, sup.quantityUsed, sup.timeMinutes).toFixed(2)}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className={styles['empty-state-container']}>
                    <NoContent
                      title={t('noSupplies', 'No hay insumos añadidos')}
                      message={t('addSomeSupplies', 'Añada algunos insumos o medicamentos')}
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

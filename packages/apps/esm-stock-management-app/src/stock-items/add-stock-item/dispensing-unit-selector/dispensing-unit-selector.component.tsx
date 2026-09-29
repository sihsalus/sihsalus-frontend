import { ComboBox, TextInputSkeleton } from '@carbon/react';
import { useConfig } from '@openmrs/esm-framework';
import { type ReactNode } from 'react';
import { type Control, Controller, type FieldPath, type FieldValues } from 'react-hook-form';
import { type ConfigObject } from '../../../config-schema';
import { type Concept } from '../../../core/api/types/concept/Concept';
import { useConcept } from '../../../stock-lookups/stock-lookups.resource';

interface DispensingUnitSelectorProps<T extends FieldValues, C, O> {
  control: Control<T, C, O>;
  controllerName: FieldPath<T>;
  dispensingUnitUuid?: string;
  invalid?: boolean;
  invalidText?: ReactNode;
  name: string;
  onDispensingUnitChange?: (unit: Concept) => void;
  placeholder?: string;
  title?: string;
}

const DispensingUnitSelector = <T extends FieldValues, C, O>(props: DispensingUnitSelectorProps<T, C, O>) => {
  const { dispensingUnitsUUID } = useConfig<ConfigObject>();
  const {
    items: { answers: dispensingUnits },
    isLoading,
  } = useConcept(dispensingUnitsUUID);

  if (isLoading) {
    return <TextInputSkeleton />;
  }

  return (
    <Controller
      control={props.control}
      name={props.controllerName}
      render={({ field: { onChange, value, ref } }) => (
        <ComboBox
          id={props.name}
          name={props.name}
          items={dispensingUnits || []}
          selectedItem={dispensingUnits?.find((p) => p.uuid === value) ?? null}
          invalid={props.invalid}
          invalidText={props.invalidText}
          itemToString={(item?: Concept) => item?.display ?? ''}
          onChange={(data: { selectedItem: Concept | null }) => {
            if (data.selectedItem) {
              props.onDispensingUnitChange?.(data.selectedItem);
              onChange(data.selectedItem.uuid);
            } else {
              onChange('');
            }
          }}
          placeholder={props.placeholder}
          ref={ref}
          size="md"
          titleText={props.title}
        />
      )}
    />
  );
};

export default DispensingUnitSelector;

import { ComboBox, type ComboBoxProps } from '@carbon/react';
import { type Control, Controller, type FieldPath, type FieldValues } from 'react-hook-form';

interface ControlledComboBoxProps<T extends FieldValues, C, O, ItemType>
  extends Omit<ComboBoxProps<ItemType>, 'onChange' | 'id' | 'ref' | 'value'> {
  controllerName: FieldPath<T>;
  name: string;
  control: Control<T, C, O>;
  onChange?: (e: { selectedItem: ItemType | null | undefined }) => void;
}

const ControlledComboBox = <T extends FieldValues, C, O, ItemType = unknown>(
  props: ControlledComboBoxProps<T, C, O, ItemType>,
) => {
  const { controllerName, name, control, onChange: onChangeProp, ...comboBoxProps } = props;

  return (
    <Controller
      name={controllerName}
      control={control}
      render={({ field: { onChange, value, ref } }) => (
        <ComboBox
          {...comboBoxProps}
          onChange={(e: { selectedItem: ItemType | null | undefined }) => {
            onChange(e.selectedItem);

            // Fire prop change
            if (onChangeProp) {
              onChangeProp(e);
            }
          }}
          id={name}
          ref={ref}
          value={typeof value === 'string' || typeof value === 'number' ? value : undefined}
        />
      )}
    />
  );
};

export default ControlledComboBox;

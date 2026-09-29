import { TextInput } from '@carbon/react';
import { type TextInputProps } from '@carbon/react/lib/components/TextInput/TextInput';
import { type ChangeEvent } from 'react';
import { type Control, Controller, type FieldPath, type FieldValues } from 'react-hook-form';

interface ControlledTextInputProps<T extends FieldValues, C, O> extends TextInputProps {
  controllerName: FieldPath<T>;
  name: string;
  control: Control<T, C, O>;
}

const ControlledTextInput = <T extends FieldValues, C, O>(props: ControlledTextInputProps<T, C, O>) => {
  return (
    <Controller
      name={props.controllerName}
      control={props.control}
      render={({ field: { onChange, value, ref } }) => (
        <TextInput
          {...props}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            onChange(e.target.value);

            // Fire prop change
            if (props.onChange) {
              props.onChange(e);
            }
          }}
          id={props.id}
          ref={ref}
          value={value ?? props.value}
        />
      )}
    />
  );
};

export default ControlledTextInput;

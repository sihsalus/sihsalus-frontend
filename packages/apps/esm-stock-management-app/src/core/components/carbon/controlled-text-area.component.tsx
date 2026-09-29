import { TextArea } from '@carbon/react';
import { type TextAreaProps } from '@carbon/react/lib/components/TextArea/TextArea';
import { type ChangeEvent } from 'react';
import { type Control, Controller, type FieldPath, type FieldValues } from 'react-hook-form';

interface ControlledTextAreaProps<T extends FieldValues, C, O> extends TextAreaProps {
  controllerName: FieldPath<T>;
  name: string;
  control: Control<T, C, O>;
}

const ControlledTextArea = <T extends FieldValues, C, O>(props: ControlledTextAreaProps<T, C, O>) => {
  return (
    <Controller
      name={props.controllerName}
      control={props.control}
      render={({ field: { onChange, value, ref } }) => (
        <TextArea
          {...props}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
            onChange(e.target.value);

            // Fire prop change
            if (props.onChange) {
              props.onChange(e);
            }
          }}
          id={props.name}
          ref={ref}
          value={value}
        />
      )}
    />
  );
};

export default ControlledTextArea;

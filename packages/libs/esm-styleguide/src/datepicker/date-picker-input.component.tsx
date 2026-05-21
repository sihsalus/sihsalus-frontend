import { createCalendar } from '@internationalized/date';
import { useDateField } from '@react-aria/datepicker';
import { useDateFieldState } from '@react-stately/datepicker';
import { cloneElement, forwardRef, useCallback, useContext, useRef } from 'react';
import {
  DateFieldContext,
  DateFieldStateContext,
  type DateInputProps,
  DatePickerStateContext,
  Group,
  GroupContext,
  Input,
  InputContext,
  Provider,
  useContextProps,
  useLocale,
} from 'react-aria-components';

interface OpenmrsDateInputProps {
  id?: string;
}

/**
 * This is just the standard React Aria Components DatePickerInput with an added `onClick` handler to open
 * the calendar when the group is clicked. This is used to emulate Carbon's behaviour in the DatePicker.
 */
export const DatePickerInput = /*#__PURE__*/ forwardRef<HTMLDivElement, DateInputProps & OpenmrsDateInputProps>(
  function DatePickerInput(props, ref) {
    const datePickerState = useContext(DatePickerStateContext)!;
    const [dateFieldProps, fieldRef] = useContextProps({ slot: props.slot }, ref, DateFieldContext);
    const { locale } = useLocale();
    const state = useDateFieldState({
      ...dateFieldProps,
      locale,
      createCalendar,
    });

    const inputRef = useRef<HTMLInputElement>(null);
    const { fieldProps, inputProps } = useDateField({ ...dateFieldProps, inputRef }, state, fieldRef);

    const onClick = useCallback(() => {
      if (!state.isDisabled) {
        datePickerState.toggle();
      }
    }, [state.isDisabled, datePickerState.toggle]);

    return (
      <Provider
        values={[
          [DateFieldStateContext, state],
          [InputContext, { ...inputProps, ref: inputRef }],
          [GroupContext, { ...fieldProps, ref: fieldRef, isInvalid: state.isInvalid }],
        ]}
      >
        <Group
          {...props}
          id={props.id}
          ref={ref}
          slot={props.slot || undefined}
          className={props.className}
          isDisabled={state.isDisabled}
          isInvalid={state.isInvalid}
          onClick={onClick}
        >
          {state.segments.map((segment, i) => cloneElement(props.children(segment), { key: i }))}
        </Group>
        <Input />
      </Provider>
    );
  },
);

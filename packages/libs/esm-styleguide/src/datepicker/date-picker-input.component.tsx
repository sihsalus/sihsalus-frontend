import { createCalendar } from '@internationalized/date';
import { useDateField } from '@react-aria/datepicker';
import { useDateFieldState } from '@react-stately/datepicker';
import { cloneElement, forwardRef, type MouseEvent as ReactMouseEvent, useCallback, useRef } from 'react';
import {
  DateFieldContext,
  DateFieldStateContext,
  type DateInputProps,
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
 * This is the standard React Aria Components DatePickerInput with Carbon-compatible focus behaviour.
 * Clicking the input focuses its first editable segment so a date can be entered from the keyboard;
 * the adjacent calendar button remains responsible for opening the calendar.
 */
export const DatePickerInput = /*#__PURE__*/ forwardRef<HTMLDivElement, DateInputProps & OpenmrsDateInputProps>(
  function DatePickerInput(props, ref) {
    const [dateFieldProps, fieldRef] = useContextProps({ slot: props.slot }, ref, DateFieldContext);
    const { locale } = useLocale();
    const state = useDateFieldState({
      ...dateFieldProps,
      locale,
      createCalendar,
    });

    const inputRef = useRef<HTMLInputElement>(null);
    const { fieldProps, inputProps } = useDateField({ ...dateFieldProps, inputRef }, state, fieldRef);

    const onClick = useCallback(
      (event: ReactMouseEvent<HTMLDivElement>) => {
        if (!state.isDisabled) {
          event.currentTarget.querySelector<HTMLElement>('[data-type]:not([data-readonly])')?.focus();
        }
      },
      [state.isDisabled],
    );

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

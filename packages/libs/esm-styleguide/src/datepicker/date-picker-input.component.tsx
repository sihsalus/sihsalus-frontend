import { forwardRef, type MouseEvent as ReactMouseEvent, useCallback, useContext } from 'react';
import {
  DateInput,
  type DateInputProps,
  DatePickerStateContext,
  DateRangePickerStateContext,
} from 'react-aria-components';

interface OpenmrsDateInputProps {
  id?: string;
}

/**
 * Thin wrapper around React Aria's DateInput. It preserves React Aria's internal
 * date field wiring and only adds Carbon-like behavior: clicking the input group
 * opens the calendar popover.
 */
export const DatePickerInput = /*#__PURE__*/ forwardRef<HTMLDivElement, DateInputProps & OpenmrsDateInputProps>(
  function DatePickerInput({ onClick, ...props }, ref) {
    const datePickerState = useContext(DatePickerStateContext);
    const dateRangePickerState = useContext(DateRangePickerStateContext);
    const pickerState = datePickerState ?? dateRangePickerState;
    const isDisabled = Boolean((props as { isDisabled?: boolean }).isDisabled);

    const handleClick = useCallback(
      (event: ReactMouseEvent<HTMLDivElement>) => {
        onClick?.(event);
        if (!event.defaultPrevented && !isDisabled) {
          pickerState?.toggle();
        }
      },
      [isDisabled, onClick, pickerState],
    );

    return <DateInput {...props} ref={ref} slot={props.slot || undefined} onClick={handleClick} />;
  },
);

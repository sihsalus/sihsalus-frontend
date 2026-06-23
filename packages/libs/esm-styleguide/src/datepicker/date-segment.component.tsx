import {
  type ForwardedRef,
  forwardRef,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
} from 'react';
import { type DateSegmentProps, DateSegment as ReactAriaDateSegment } from 'react-aria-components';

/**
 * This component wraps React Aria's DateSegment and prevents segment interactions
 * from bubbling to the parent date input group, which opens the calendar popover.
 */
export const DateSegment = /*#__PURE__*/ forwardRef(function DateSegment(
  { className, ...props }: DateSegmentProps,
  ref: ForwardedRef<HTMLSpanElement>,
) {
  const stopPropagation = useCallback(
    (event: ReactMouseEvent<HTMLSpanElement> | ReactPointerEvent<HTMLSpanElement>) => {
      event.stopPropagation();
    },
    [],
  );

  return (
    <ReactAriaDateSegment
      {...props}
      ref={ref}
      className={className}
      onClick={stopPropagation}
      onPointerDown={stopPropagation}
    />
  );
});

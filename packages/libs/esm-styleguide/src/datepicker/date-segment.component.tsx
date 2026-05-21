import { useDateSegment } from '@react-aria/datepicker';
import { filterDOMProps } from '@react-aria/utils';
import { type ForwardedRef, forwardRef, type MouseEvent as ReactMouseEvent, useCallback, useContext } from 'react';
import { mergeProps, useFocusRing, useHover, useObjectRef } from 'react-aria';
import { DateFieldStateContext, type DateSegmentProps } from 'react-aria-components';
import { useRenderProps } from './hooks';

/**
 * This component represents a part of the displayed date in the date picker.
 *
 * This is lightly-modified from the react-aria-components DateSegment component. It prevents click events
 * from propagating to the parent `DatePickerInput` so that the calendar doesn't open when editing a date
 * segment.
 */
export const DateSegment = /*#__PURE__*/ forwardRef(function DateSegment(
  { segment, ...otherProps }: DateSegmentProps,
  ref: ForwardedRef<HTMLDivElement>,
) {
  const state = useContext(DateFieldStateContext)!;
  const domRef = useObjectRef(ref);
  const { segmentProps } = useDateSegment(segment, state, domRef);
  const { focusProps, isFocused, isFocusVisible } = useFocusRing();
  const { hoverProps, isHovered } = useHover({
    ...otherProps,
    isDisabled: state.isDisabled || segment.type === 'literal',
  });
  const renderProps = useRenderProps({
    ...otherProps,
    values: {
      ...segment,
      isReadOnly: !segment.isEditable,
      isInvalid: state.isInvalid,
      isDisabled: state.isDisabled,
      isHovered,
      isFocused,
      isFocusVisible,
    },
    defaultChildren: segment.text,
  });

  const onClick = useCallback((event: ReactMouseEvent<HTMLSpanElement, MouseEvent>) => {
    event.stopPropagation();
  }, []);

  return (
    // Segment props from React Aria include the keyboard semantics for this interactive span.
    // biome-ignore lint/a11y/noStaticElementInteractions: React Aria controls the accessible role and handlers.
    <span
      {...mergeProps(
        filterDOMProps(otherProps as unknown as Parameters<typeof filterDOMProps>[0]),
        segmentProps,
        focusProps,
        hoverProps,
      )}
      {...renderProps}
      ref={domRef}
      style={segmentProps.style}
      data-placeholder={segment.isPlaceholder || undefined}
      data-invalid={state.isInvalid || undefined}
      data-readonly={!segment.isEditable || undefined}
      data-disabled={state.isDisabled || undefined}
      data-type={segment.type}
      data-hovered={isHovered || undefined}
      data-focused={isFocused || undefined}
      data-focus-visible={isFocusVisible || undefined}
      onClick={onClick}
    />
  );
});

/** @module @category Navigation */

import { interpolateUrl, navigate, type TemplateParams } from '@openmrs/esm-navigation';
import { type AnchorHTMLAttributes, type MouseEvent, type PropsWithChildren, useEffect } from 'react';

function handleClick(
  event: MouseEvent,
  to: string,
  templateParams?: TemplateParams,
  onBeforeNavigate?: (event: MouseEvent) => void,
) {
  // Left click without modifiers (normal navigation)
  if (event.button === 0 && !event.ctrlKey && !event.shiftKey && !event.altKey && !event.metaKey) {
    event.preventDefault();
    onBeforeNavigate?.(event);
    navigate({ to, templateParams });
  }

  // Left click with Ctrl key (or Cmd key on Mac) - Open in new tab
  if (event.button === 0 && (event.ctrlKey || event.metaKey)) {
    onBeforeNavigate?.(event);
  }

  // Left click with Shift key - Open in new window
  if (event.button === 0 && event.shiftKey) {
    onBeforeNavigate?.(event);
  }

  // Middle click - Open in new background tab
  if (event.button === 1) {
    onBeforeNavigate?.(event);
  }
}

/** @noInheritDoc */
export interface ConfigurableLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  /** The target path or URL. Supports interpolation. See [[navigate]] */
  to: string;
  /** A dictionary of values to interpolate into the URL, in addition to the default keys `openmrsBase` and `openmrsSpaBase`. */
  templateParams?: TemplateParams;
  /** A callback to be called just before navigation occurs */
  onBeforeNavigate?: (event: MouseEvent) => void;
}

/**
 * A React link component which calls {@link navigate} when clicked
 */
export function ConfigurableLink({
  to,
  templateParams,
  onBeforeNavigate,
  children,
  ...otherProps
}: PropsWithChildren<ConfigurableLinkProps>) {
  const { className, ...anchorProps } = otherProps;
  const linkClassName = typeof className === 'string' ? className : undefined;

  useEffect(() => {
    if (anchorProps.href) {
      console.warn(
        `ConfigurableLink does not support the href prop. Use the 'to' prop instead. The provided href value is '${anchorProps.href}'`,
      );
    }
    if (anchorProps.onClick) {
      console.warn(
        `ConfigurableLink does not support the onClick prop. Use the 'onBeforeNavigate' prop instead. The 'to' prop of the offending link is ${to}`,
      );
    }
  }, [to, anchorProps.onClick, anchorProps.href]);
  return (
    <a
      onClick={(event) => handleClick(event, to, templateParams, onBeforeNavigate)}
      href={interpolateUrl(to, templateParams)}
      className={linkClassName}
      {...anchorProps}
    >
      {children}
    </a>
  );
}

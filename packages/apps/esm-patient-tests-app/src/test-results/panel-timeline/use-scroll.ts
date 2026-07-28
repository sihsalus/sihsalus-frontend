import * as React from 'react';

import { makeThrottled } from '../helpers';

const useScrollIndicator = (xThreshold: number, yThreshold: number): [boolean, boolean, React.Ref<HTMLElement>] => {
  const [xIsScrolled, setXIsScrolled] = React.useState(false);
  const [yIsScrolled, setYIsScrolled] = React.useState(false);
  const [element, setElement] = React.useState<HTMLElement | null>(null);

  React.useEffect(() => {
    if (!element) {
      return;
    }
    const scrollHandler = makeThrottled(() => {
      setXIsScrolled(element.scrollLeft > xThreshold);
      setYIsScrolled(element.scrollTop > yThreshold);
    }, 200);

    element.addEventListener('scroll', scrollHandler);
    return () => element.removeEventListener('scroll', scrollHandler);
  }, [element, xThreshold, yThreshold]);

  const ref = React.useCallback((node: HTMLElement | null) => {
    setElement(node);
  }, []);

  return [xIsScrolled, yIsScrolled, ref];
};

export default useScrollIndicator;

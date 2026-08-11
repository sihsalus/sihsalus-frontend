import { useEffect, useState } from 'react';

const mobileChartMediaQuery = '(max-width: 42rem)';

export function useIsMobileChartLayout() {
  const [isMobileChartLayout, setIsMobileChartLayout] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(mobileChartMediaQuery);
    const handleChange = () => setIsMobileChartLayout(mediaQuery.matches);

    handleChange();
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return isMobileChartLayout;
}

import { Analytics, ChartLineData, Dashboard, Trophy } from '@carbon/react/icons';
import type { ComponentType } from 'react';

export interface IndicadoresNavIconProps {
  className?: string;
  size?: number | string;
}

export interface IndicadoresNavItem {
  /** Path relative to the module basename (`/openmrs/spa/indicators`). */
  path: string;
  labelKey: string;
  defaultLabel: string;
  icon: ComponentType<IndicadoresNavIconProps>;
}

/**
 * The four sections of the module, in product order. These paths must match the
 * route table in `root.component.tsx` (pinned by
 * `indicadores-nav.extension.test.tsx`).
 */
export const indicadoresNavigation: Array<IndicadoresNavItem> = [
  { path: '/', labelKey: 'panel', defaultLabel: 'Panel', icon: Dashboard },
  { path: '/indicadores', labelKey: 'indicators', defaultLabel: 'Indicadores', icon: ChartLineData },
  { path: '/resultados', labelKey: 'results', defaultLabel: 'Resultados', icon: Analytics },
  { path: '/metas', labelKey: 'metasTitle', defaultLabel: 'Metas', icon: Trophy },
];

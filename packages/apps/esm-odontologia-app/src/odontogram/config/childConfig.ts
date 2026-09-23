import type { OdontogramConfig, ToothConfig } from '../types/odontogram';
import { adultConfig } from './adultConfig';

/**
 * Primary tooth order recovered from Mauricio Arenales' delivery:
 * MauArenales/react-odontogram-v2, mauricio@bc00f0fa6d6120fdc3d493737ff57fbd1f7dd9ab.
 * Root silhouettes and crown subdivisions follow the NTS 188-MINSA/DGIESP-2022 annex (page 22).
 * The renderer, findings catalog and editing state are shared with permanent teeth.
 */
const upper: ToothConfig[] = [
  { id: 55, position: 'upper', type: 'molar', zones: 8, rootDesign: 'default' },
  { id: 54, position: 'upper', type: 'molar', zones: 7, rootDesign: 'default' },
  { id: 53, position: 'upper', type: 'canino', zones: 4, rootDesign: 'design2' },
  { id: 52, position: 'upper', type: 'incisivo', zones: 4, rootDesign: 'design2' },
  { id: 51, position: 'upper', type: 'incisivo', zones: 4, rootDesign: 'design2' },
  { id: 61, position: 'upper', type: 'incisivo', zones: 4, rootDesign: 'design2' },
  { id: 62, position: 'upper', type: 'incisivo', zones: 4, rootDesign: 'design2' },
  { id: 63, position: 'upper', type: 'canino', zones: 4, rootDesign: 'design2' },
  { id: 64, position: 'upper', type: 'molar', zones: 7, rootDesign: 'default' },
  { id: 65, position: 'upper', type: 'molar', zones: 8, rootDesign: 'default' },
];

const lower: ToothConfig[] = [
  { id: 85, position: 'lower', type: 'molar', zones: 10, rootDesign: 'twoRoots' },
  { id: 84, position: 'lower', type: 'molar', zones: 8, rootDesign: 'twoRoots' },
  { id: 83, position: 'lower', type: 'canino', zones: 4, rootDesign: 'design2' },
  { id: 82, position: 'lower', type: 'incisivo', zones: 4, rootDesign: 'design2' },
  { id: 81, position: 'lower', type: 'incisivo', zones: 4, rootDesign: 'design2' },
  { id: 71, position: 'lower', type: 'incisivo', zones: 4, rootDesign: 'design2' },
  { id: 72, position: 'lower', type: 'incisivo', zones: 4, rootDesign: 'design2' },
  { id: 73, position: 'lower', type: 'canino', zones: 4, rootDesign: 'design2' },
  { id: 74, position: 'lower', type: 'molar', zones: 8, rootDesign: 'twoRoots' },
  { id: 75, position: 'lower', type: 'molar', zones: 10, rootDesign: 'twoRoots' },
];

export const childConfig: OdontogramConfig = {
  type: 'child',
  name: 'Odontograma de dentición temporal',
  teeth: { upper, lower },
  spacingFindingIds: adultConfig.spacingFindingIds,
  findingOptions: adultConfig.findingOptions,
};

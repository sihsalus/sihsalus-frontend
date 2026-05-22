/**
 * TeethArch — arcada dental unificada (superior o inferior).
 *
 * Reemplaza AdultUpperTeeth y AdultLowerTeeth eliminando la duplicación masiva.
 * Obtiene dientes y hallazgos del Context (no de stores globales).
 *
 * Renderiza tres secciones:
 *   1. Detalles / leyendas de diente (ToothDetails + SpaceBetweenLegends)
 *   2. Filas de hallazgos de spacing (SpacingFinding genérico)
 *   3. Visualizaciones de diente (ToothVisualization + SpaceBetweenTeeth)
 *
 * Para la arcada inferior el orden se invierte (teeth → findings → details).
 */

import React, { useMemo } from 'react';
import { useOdontogramContext } from '../providers/OdontogramProvider';
import MainSectionOnTheCanvas from './MainSectionOnTheCanvas';
import SpaceBetweenLegends from './spacing/SpaceBetweenLegends';
import SpaceBetweenTeeth from './spacing/SpaceBetweenTeeth';
import SpacingFinding from './spacing/SpacingFinding';
import ToothColumn from './ToothColumn';
import ToothDetails from './ToothDetails';
import ToothVisualization from './ToothVisualization';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TeethArchProps {
  position: 'upper' | 'lower';
}

interface AdjacentPair {
  leftId: number;
  rightId: number;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'flex-end',
};

const ROW_STYLE_LOWER: React.CSSProperties = {
  ...ROW_STYLE,
  alignItems: 'flex-start',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const TeethArch: React.FC<TeethArchProps> = ({ position }) => {
  const { config, data, formSelection } = useOdontogramContext();

  // Teeth for this arch (from config, order already correct)
  const teeth = config.teeth[position];

  // Adjacent pairs (between consecutive teeth)
  const pairs: AdjacentPair[] = useMemo(
    () =>
      teeth.slice(0, -1).map((t, i) => ({
        leftId: t.id,
        rightId: teeth[i + 1].id,
      })),
    [teeth],
  );

  // Which spacing finding IDs that have data OR are currently selected
  const visibleSpacingRows = useMemo(() => {
    return config.spacingFindingIds.filter((fId) => {
      // Findings 6 and 7 are shown in the teeth row, not as separate rows
      if (fId === 6 || fId === 7) return false;

      // Show if currently selected
      if (formSelection.selectedFindingId === fId) return true;

      // Show if there is any data registered for this finding on this position
      const spaces = data.spacingFindings[fId] || [];
      return spaces.some((space) => {
        // Check this space belongs to a tooth on this arch
        const belongsToArch = teeth.some((t) => t.id === space.leftToothId || t.id === space.rightToothId);
        return belongsToArch && space.findings.length > 0;
      });
    });
  }, [config.spacingFindingIds, formSelection.selectedFindingId, data.spacingFindings, teeth]);

  // Order spacing rows for lower arch: reversed
  const orderedSpacingRows = position === 'lower' ? [...visibleSpacingRows].reverse() : visibleSpacingRows;

  // ---- Row: Tooth Details / Legends ----
  const detailsRow = (
    <div style={ROW_STYLE}>
      {teeth.map((tooth, index) => (
        <React.Fragment key={tooth.id}>
          <ToothDetails idTooth={tooth.id} initialText="" legend={String(tooth.id)} position={position} />
          {index < pairs.length && (
            <SpaceBetweenLegends
              leftToothId={pairs[index].leftId}
              rightToothId={pairs[index].rightId}
              position={position}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );

  // ---- Row: Spacing findings ----
  const findingRows = orderedSpacingRows.map((findingId) => (
    <div key={findingId} style={ROW_STYLE}>
      {teeth.map((tooth, index) => (
        <React.Fragment key={tooth.id}>
          <MainSectionOnTheCanvas idTooth={tooth.id} optionId={findingId} />
          {index < pairs.length && (
            <SpacingFinding
              findingId={findingId}
              leftToothId={pairs[index].leftId}
              rightToothId={pairs[index].rightId}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  ));

  // ---- Row: Tooth Visualization ----
  const visualizationRow = (
    <div style={position === 'lower' ? ROW_STYLE_LOWER : ROW_STYLE}>
      {teeth.map((tooth, index) => (
        <React.Fragment key={tooth.id}>
          <ToothColumn toothId={tooth.id}>
            <ToothVisualization idTooth={tooth.id} zones={tooth.zones} design={tooth.rootDesign} position={position} />
          </ToothColumn>
          {index < pairs.length && (
            <SpaceBetweenTeeth leftToothId={pairs[index].leftId} rightToothId={pairs[index].rightId} />
          )}
        </React.Fragment>
      ))}
    </div>
  );

  // Upper: details → findings → visualization
  // Lower: visualization → findings → details
  if (position === 'upper') {
    return (
      <>
        {detailsRow}
        {findingRows}
        {visualizationRow}
      </>
    );
  }

  return (
    <>
      {visualizationRow}
      {findingRows}
      {detailsRow}
    </>
  );
};

export default TeethArch;

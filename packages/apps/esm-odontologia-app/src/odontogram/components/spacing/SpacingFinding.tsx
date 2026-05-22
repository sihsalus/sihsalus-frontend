/**
 * Componente genérico para renderizar un espacio entre dientes
 * para cualquier hallazgo de spacing.
 *
 * Reemplaza los 10+ componentes SpacingBetweenFinding{N} duplicados.
 * Usa el Context en vez de stores globales.
 */

import React from 'react';
import { getSpacingDesignComponentByPosition, isOrientationAgnosticFinding } from '../../config/designMapping';
import { isRowFinding } from '../../logic/findingDesignLogic';
import { useOdontogramContext } from '../../providers/OdontogramProvider';
import './SpaceBetweenStyles.css';

// Findings that should NOT show gray highlighting in spacing cells
const NO_HIGHLIGHT_SPACING = new Set([13, 24, 25]);

interface SpacingFindingProps {
  /** ID del hallazgo de spacing */
  findingId: number;
  /** ID del diente izquierdo del espacio */
  leftToothId: number;
  /** ID del diente derecho del espacio */
  rightToothId: number;
  /** Ancho del SVG */
  width?: number;
  /** Alto del SVG */
  height?: number;
}

const SpacingFinding: React.FC<SpacingFindingProps> = ({
  findingId,
  leftToothId,
  rightToothId,
  width = 20,
  height = 20,
}) => {
  const { data, config, formSelection, spacingActions, toothActions, readOnly, getToothConfig, showToast } =
    useOdontogramContext();

  const { selectedFindingId, selectedColor, selectedSuboption, isComplete } = formSelection;

  // ¿Este espacio pertenece a un diente inferior?
  const toothConfig = getToothConfig(leftToothId);
  const isLower = toothConfig?.position === 'lower';

  // Obtener los datos de spacing para este hallazgo
  const spaces = data.spacingFindings[findingId] || [];
  const space = spaces.find((s) => s.leftToothId === leftToothId && s.rightToothId === rightToothId);

  // Obtener el hallazgo activo en este espacio (si existe)
  const activeFinding = space?.findings.find((f) => f.findingId === findingId);
  const storedColor = activeFinding?.color;
  const dynamicDesign = activeFinding?.designNumber;

  // ¿Está seleccionado este hallazgo en el formulario?
  const isSelected = selectedFindingId === findingId;

  const handleClick = () => {
    if (readOnly) return;
    if (!isComplete || !isSelected || !selectedColor) {
      if (selectedFindingId && !isComplete) {
        const opt = config.findingOptions.find((o) => o.id === selectedFindingId);
        const needsColor = (opt?.colores?.length ?? 0) > 0 && !selectedColor;
        const needsSub = (opt?.subopciones?.length ?? 0) > 0 && !selectedSuboption;
        const parts: string[] = [];
        if (needsSub) parts.push('tipo');
        if (needsColor) parts.push('color');
        if (parts.length) showToast(`Seleccione ${parts.join(' y ')} para "${opt?.nombre}"`);
      } else if (!selectedFindingId) {
        showToast('Seleccione un hallazgo clínico en el formulario');
      }
      return;
    }

    // Row findings (31, etc.) use registerToothFinding which handles
    // applying to entire row + spacing cascade
    if (isRowFinding(findingId)) {
      toothActions.registerToothFinding({
        toothId: leftToothId,
        findingId,
        color: selectedColor,
      });
      return;
    }

    spacingActions.toggleSpacingFinding({
      findingId,
      leftToothId,
      rightToothId,
      color: selectedColor,
    });
  };

  // Renderizar el diseño visual del hallazgo
  const renderDesign = () => {
    if (!storedColor || !dynamicDesign) return null;

    const DesignComponent = getSpacingDesignComponentByPosition(findingId, dynamicDesign);
    if (!DesignComponent) return null;

    const designNode = <DesignComponent strokeColor={storedColor.name} />;
    // Lower-arch spacings are derived from the upper canon by mirroring
    // vertically (single source of truth for design assets). Orientation-
    // agnostic findings (e.g. 26 with the "S" glyph) skip the mirror so the
    // letter stays right-side-up.
    if (isLower && !isOrientationAgnosticFinding(findingId)) {
      return <g transform={`scale(1,-1) translate(0,-${height})`}>{designNode}</g>;
    }
    return designNode;
  };

  return (
    <svg
      width={width}
      height={height}
      onClick={handleClick}
      style={{ cursor: readOnly ? 'default' : 'pointer' }}
      className={isSelected && !readOnly ? 'interactive-svg' : ''}
    >
      {(() => {
        const showHighlight = isSelected && !readOnly && !NO_HIGHLIGHT_SPACING.has(findingId);
        return (
          <rect
            width={width}
            height={height}
            fill={showHighlight ? 'lightgray' : 'white'}
            stroke={showHighlight ? '#a8a8a8' : 'none'}
            strokeWidth={showHighlight ? 0.3 : 0}
          />
        );
      })()}
      {renderDesign()}
    </svg>
  );
};

export default SpacingFinding;

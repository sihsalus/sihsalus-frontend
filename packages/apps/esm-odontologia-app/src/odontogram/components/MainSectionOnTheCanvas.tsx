import React, { useEffect, useState } from 'react';
import './ToothDetails.css';
import './spacing/SpaceBetweenStyles.css';
import { getDesignComponentByPosition, isOrientationAgnosticFinding } from '../config/designMapping';
import { ODONTOGRAM_CONFIG } from '../config/odontogramConfig';
import { useOdontogramContext } from '../providers/OdontogramProvider';
import type { FindingDesign } from '../types/odontogram';
import DesignSelector from './DesignSelector';

interface MainSectionOnTheCanvasProps {
  idTooth: number;
  optionId: number;
}

const MainSectionOnTheCanvas: React.FC<MainSectionOnTheCanvasProps> = ({ idTooth, optionId }) => {
  const [showDesignSelector, setShowDesignSelector] = useState(false);

  const { data, config, formSelection, toothActions, readOnly, showToast } = useOdontogramContext();

  const { selectedFindingId, selectedColor, selectedSuboption, isComplete } = formSelection;

  // Close the design picker when the finding changes or the form goes read-only.
  // Without this, switching from finding 13 to another finding leaves stale state
  // (showDesignSelector=true) that pops the modal back open the next time the
  // user re-selects finding 13.
  // biome-ignore lint/correctness/useExhaustiveDependencies: The picker must close whenever these external selection values change.
  useEffect(() => {
    setShowDesignSelector(false);
  }, [selectedFindingId, readOnly]);

  // Obtener el diente
  const tooth = data.teeth.find((t) => t.toothId === idTooth);

  // Obtener información del hallazgo seleccionado
  const selectedItem = config.findingOptions.find((op) => op.id === selectedFindingId);

  // Obtener la config del diente para saber posición
  const toothConfig =
    config.teeth.upper.find((t) => t.id === idTooth) || config.teeth.lower.find((t) => t.id === idTooth);
  const isLowerTeeth = toothConfig?.position === 'lower';

  // Buscar el hallazgo registrado en el diente para esta opción
  const currentFinding = tooth?.findings.find((f) => f.findingId === optionId);

  // ¿Está seleccionada esta opción?
  const isSelected = selectedFindingId === optionId;

  // Hallazgo 13 (Giroversión) tiene DesignSelector especial
  const isHallazgo13 = selectedFindingId === 13 && optionId === 13;

  // Hallazgos que SOLO van en spacing (no en el componente principal 60px)
  const spacingOnlyFindings = [26];
  const isSpacingOnly = spacingOnlyFindings.includes(optionId);

  const handleClick = () => {
    if (readOnly) return;
    if (!isComplete || !isSelected) {
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

    // Finding 26 only renders in SpacingFinding cells, not in tooth cells
    if (isSpacingOnly) return;

    // Para hallazgo 13 con diseños múltiples, mostrar selector
    if (isHallazgo13 && selectedItem?.designs && selectedItem.designs.length > 0) {
      setShowDesignSelector(true);
      return;
    }

    // Para todos los demás, toggle directo
    if (!selectedColor) return;

    // Row findings and others: always use registerToothFinding (it handles toggle + row cascade)
    toothActions.registerToothFinding({
      toothId: idTooth,
      findingId: optionId,
      color: selectedColor,
      subOptionId: selectedSuboption?.id,
    });
  };

  // registerToothFinding handles replace vs toggle-off:
  // same design → toggle off, different → replace, new → add
  const handleDesignSelect = (design: FindingDesign) => {
    if (readOnly || !selectedColor) return;

    toothActions.registerToothFinding({
      toothId: idTooth,
      findingId: optionId,
      color: selectedColor,
      subOptionId: selectedSuboption?.id,
      designNumber: design.number,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleClick();
    }
  };

  const renderDesign = () => {
    // Spacing-only findings should not render in the 60px tooth cell
    if (isSpacingOnly) return null;
    if (!currentFinding?.color || !currentFinding?.designNumber) {
      return null;
    }

    const DesignComponent = getDesignComponentByPosition(optionId, currentFinding.designNumber);
    if (!DesignComponent) return null;

    const designNode = <DesignComponent strokeColor={currentFinding.color.name} />;
    // Lower-arch designs are derived from the upper canon by mirroring
    // vertically — keeps a single source of truth for design assets.
    // Orientation-agnostic findings (e.g. 26 with the "S" glyph) are exempt:
    // mirroring them would flip the letter upside-down.
    if (isLowerTeeth && !isOrientationAgnosticFinding(optionId)) {
      return <g transform={`scale(1,-1) translate(0,-${ODONTOGRAM_CONFIG.dimensions.toothHeight})`}>{designNode}</g>;
    }
    return designNode;
  };

  return (
    <>
      <svg
        width={ODONTOGRAM_CONFIG.dimensions.toothWidth}
        height={ODONTOGRAM_CONFIG.dimensions.toothHeight}
        onClick={handleClick}
        className="tooth-details-legend interactive-svg"
        viewBox={`0 0 ${ODONTOGRAM_CONFIG.dimensions.toothWidth} ${ODONTOGRAM_CONFIG.dimensions.toothHeight}`}
        role={ODONTOGRAM_CONFIG.accessibility.role}
        tabIndex={ODONTOGRAM_CONFIG.accessibility.tabIndex}
        aria-label={`Sección de hallazgo ${optionId} para diente ${idTooth}`}
        onKeyDown={handleKeyDown}
        style={ODONTOGRAM_CONFIG.styles.interactiveSvg}
      >
        <rect
          width={ODONTOGRAM_CONFIG.dimensions.toothWidth}
          height={ODONTOGRAM_CONFIG.dimensions.toothHeight}
          fill={isSelected && !isSpacingOnly ? ODONTOGRAM_CONFIG.colors.selected : ODONTOGRAM_CONFIG.colors.default}
          stroke={isSelected && !isSpacingOnly ? '#a8a8a8' : 'none'}
          strokeWidth={isSelected && !isSpacingOnly ? 0.3 : 0}
        />
        {renderDesign()}
      </svg>

      {isHallazgo13 && (
        <DesignSelector
          isOpen={showDesignSelector}
          onClose={() => setShowDesignSelector(false)}
          designs={selectedItem?.designs || []}
          selectedColor={selectedColor}
          findingName={selectedItem?.nombre || 'Giroversión'}
          toothId={idTooth}
          toothZones={4}
          onDesignSelect={handleDesignSelect}
          existingFindings={tooth?.findings.filter((f) => f.findingId === 13) || []}
          rootDesign={toothConfig?.rootDesign}
          position={isLowerTeeth ? 'lower' : 'upper'}
        />
      )}
    </>
  );
};

export default MainSectionOnTheCanvas;

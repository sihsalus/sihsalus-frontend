/**
 * Espacio entre las visualizaciones de dientes (entre los SVG de dientes).
 * Maneja los hallazgos 6 (Diastema) y 7 (Edéntulo total) que se renderizan
 * en el espacio vertical entre dientes.
 */

import React from 'react';
import { Finding6Design1, Finding7Design2 } from '../../designs/figuras';
import { useOdontogramContext } from '../../providers/OdontogramProvider';
import './SpaceBetweenStyles.css';

interface SpaceBetweenTeethProps {
  leftToothId: number;
  rightToothId: number;
}

const SpaceBetweenTeeth: React.FC<SpaceBetweenTeethProps> = ({ leftToothId, rightToothId }) => {
  const { data, config, formSelection, spacingActions, toothActions, readOnly, showToast } = useOdontogramContext();

  const { selectedFindingId, selectedColor, selectedSuboption, isComplete } = formSelection;

  // Hallazgos que se renderizan en este espacio
  const FINDING_IDS = [6, 7];
  const isSelected = FINDING_IDS.includes(selectedFindingId!);

  // Obtener datos de finding 7
  const spaces7 = data.spacingFindings[7] || [];
  const space7 = spaces7.find((s) => s.leftToothId === leftToothId && s.rightToothId === rightToothId);
  const finding7 = space7?.findings.find((f) => f.findingId === 7);

  // Obtener datos de finding 6
  const spaces6 = data.spacingFindings[6] || [];
  const space6 = spaces6.find((s) => s.leftToothId === leftToothId && s.rightToothId === rightToothId);
  const findings6 = space6?.findings.filter((f) => f.findingId === 6) || [];

  const handleClick = () => {
    if (readOnly) return;
    if (!isComplete || !FINDING_IDS.includes(selectedFindingId!) || !selectedColor) {
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

    // Finding 7 is a row finding — use registerToothFinding which handles
    // applying to entire row + spacing cascade
    if (selectedFindingId === 7) {
      toothActions.registerToothFinding({
        toothId: leftToothId,
        findingId: 7,
        color: selectedColor,
      });
      return;
    }

    spacingActions.toggleSpacingFinding({
      findingId: selectedFindingId!,
      leftToothId,
      rightToothId,
      color: selectedColor,
    });
  };

  return (
    <svg
      width="20"
      height="60"
      onClick={handleClick}
      style={{ cursor: readOnly ? 'default' : isSelected ? 'pointer' : 'default' }}
      className={isSelected && !readOnly ? 'interactive-svg' : ''}
    >
      {(() => {
        const showHighlight = isSelected && !readOnly;
        return (
          <rect
            width="20"
            height="60"
            fill={showHighlight ? 'lightgray' : 'white'}
            opacity="0.45"
            stroke={showHighlight ? '#a8a8a8' : 'none'}
            strokeWidth={showHighlight ? 0.3 : 0}
          />
        );
      })()}

      {/* Finding 7 - Edéntulo total */}
      {finding7?.color && finding7?.designNumber && <Finding7Design2 strokeColor={finding7.color.name} />}

      {/* Finding 6 - Diastema */}
      {findings6.map((finding) =>
        finding.designNumber && finding.color ? (
          <Finding6Design1 key={finding.id} strokeColor={finding.color.name} />
        ) : null,
      )}
    </svg>
  );
};

export default SpaceBetweenTeeth;

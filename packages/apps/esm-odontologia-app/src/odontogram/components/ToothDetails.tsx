import React from 'react';
import './ToothDetails.css';
import './spacing/SpaceBetweenStyles.css';
import {
  EllipseDesignLeft,
  EllipseDesignLeftAndRight,
  EllipseDesignRight,
  Finding12Design1,
  Finding21Design1,
} from '../designs/figuras';
import { useOdontogramContext } from '../providers/OdontogramProvider';
import type { ToothFinding } from '../types/odontogram';
import { COLOR_CSS } from './constants';

interface ToothDetailsProps {
  idTooth: number;
  initialText?: string; // kept for API compat, ignored — notes come from data
  legend?: string;
  position?: 'upper' | 'lower';
}

/** Pick a font size that lets the abbreviation fit inside the 60×60 box.
 *  Most clinical codes are 1-3 chars (CT, MB, CDP) and stay at 11px.
 *  Longer ones like "Fluorosis" or "DAO" shrink progressively. */
function getAnnotationFontSize(text: string): string {
  const len = text.length;
  if (len <= 3) return '11px';
  if (len <= 5) return '10px';
  if (len <= 7) return '9px';
  return '8px';
}

// Se manejan los hallazgos 11, 12 y 21
const ToothDetails: React.FC<ToothDetailsProps> = ({ idTooth, legend = 'Leyenda', position = 'upper' }) => {
  const { data, config: ctxConfig, formSelection, toothActions, readOnly, showToast } = useOdontogramContext();

  const { selectedFindingId, selectedSuboption, selectedColor, isComplete } = formSelection;
  const predefinedMarkedOptions = [11, 12, 21];

  // Obtener el diente
  const tooth = data.teeth.find((t) => t.toothId === idTooth);

  // Color mapping for annotation text

  // Group annotations by findingId for "/" display
  const groupedAnnotations = React.useMemo(() => {
    const annotations = tooth?.annotations ?? [];
    const groups: { findingId: number; items: typeof annotations }[] = [];
    const map = new Map<number, typeof annotations>();
    for (const ann of annotations) {
      let arr = map.get(ann.findingId);
      if (!arr) {
        arr = [];
        map.set(ann.findingId, arr);
        groups.push({ findingId: ann.findingId, items: arr });
      }
      arr.push(ann);
    }
    return groups;
  }, [tooth?.annotations]);

  // Buscar los hallazgos específicos
  const Finding11 = tooth?.findings.find((f) => f.findingId === 11);
  const Finding12 = tooth?.findings.find((f) => f.findingId === 12);
  const Finding21 = tooth?.findings.find((f) => f.findingId === 21);

  const handleLegendClick = () => {
    if (readOnly) return;
    if (!isComplete || !predefinedMarkedOptions.includes(selectedFindingId!)) {
      if (selectedFindingId && !isComplete) {
        const opt = ctxConfig.findingOptions.find((o) => o.id === selectedFindingId);
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
    if (!selectedColor) return;

    // Always use registerToothFinding for finding 11 to trigger cascade
    // (tooth-to-tooth adjacency + legend space recalculation)
    toothActions.registerToothFinding({
      toothId: idTooth,
      findingId: selectedFindingId!,
      color: selectedColor,
      subOptionId: selectedSuboption?.id,
    });
  };

  // Determinar la clase CSS para el SVG
  const svgClassName = 'tooth-details-legend interactive-svg';

  const renderDesignForFinding = (optionId: number, finding: ToothFinding) => {
    switch (optionId) {
      case 11:
        return (
          <>
            {finding.designNumber === 1 && <EllipseDesignLeft strokeColor={finding.color.name} />}
            {finding.designNumber === 2 && <EllipseDesignRight strokeColor={finding.color.name} />}
            {finding.designNumber === 3 && <EllipseDesignLeftAndRight strokeColor={finding.color.name} />}
          </>
        );
      case 12:
        return finding.designNumber === 1 ? <Finding12Design1 strokeColor={finding.color.name} /> : null;
      case 21:
        return finding.designNumber === 1 ? <Finding21Design1 strokeColor={finding.color.name} /> : null;
      default:
        return null;
    }
  };

  return (
    <div className={`tooth-details-container ${position === 'lower' ? 'tooth-details-container--lower' : ''}`}>
      {/* Annotations box — auto-generated abbreviations with color */}
      <div className="tooth-details-box">
        <div className="tooth-details-annotations">
          {groupedAnnotations.map((group) => (
            <div key={group.findingId} className="tooth-annotation-group">
              {group.items.map((ann, i) => (
                <React.Fragment key={`${ann.findingId}-${ann.text}-${i}`}>
                  {i > 0 && <span className="tooth-annotation-sep">/</span>}
                  <span
                    className="tooth-annotation"
                    style={{
                      color: COLOR_CSS[ann.color] ?? ann.color,
                      fontSize: getAnnotationFontSize(ann.text),
                    }}
                    title={ann.text}
                  >
                    {ann.text}
                  </span>
                </React.Fragment>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Legend - identificador de diente */}
      <svg
        width="60"
        height="30"
        onClick={handleLegendClick}
        className={svgClassName}
        style={{ cursor: 'pointer' }}
        viewBox="0 0 60 30"
      >
        {/* Fondo con sombreado dependiendo de la opción seleccionada */}
        <rect
          width="60"
          height="30"
          fill={
            selectedFindingId != null && predefinedMarkedOptions.includes(selectedFindingId) ? 'lightgray' : 'white'
          }
        />

        <text x="30" y="20" fontSize="13" fill="black" textAnchor="middle" className="tooth-details-legend-text">
          {legend}
        </text>

        {/* Renderiza los diseños de cada hallazgo usando un enfoque más modular */}

        {/* Hallazgo 11 */}
        {Finding11?.color && Finding11?.designNumber && <>{renderDesignForFinding(11, Finding11)}</>}

        {/* Hallazgo 12 */}
        {Finding12?.color && Finding12?.designNumber && <>{renderDesignForFinding(12, Finding12)}</>}
        {Finding21?.color && Finding21?.designNumber && <>{renderDesignForFinding(21, Finding21)}</>}
      </svg>
    </div>
  );
};

export default ToothDetails;

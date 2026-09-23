import React from 'react';
import { useTranslation } from 'react-i18next';
import { isMultiDesignFinding } from '../logic/findingDesignLogic';
import { useOdontogramContext } from '../providers/OdontogramProvider';
import type { FindingDesign, ToothRootDesign } from '../types/odontogram';
import { TOOTH_DESIGN_COMPONENT_MAP } from './constants';
import DesignSelector from './DesignSelector';
import Tooth from './Tooth';
import ToothDesigns from './ToothDesigns';
import styles from './ToothVisualization.module.scss';

interface ToothVisualizationProps {
  idTooth: number;
  zones?: number;
  design?: ToothRootDesign;
  position?: 'upper' | 'lower';
}

const ToothVisualization = ({
  idTooth,
  zones = 8,
  design = 'default',
  position = 'upper',
}: ToothVisualizationProps) => {
  const { t } = useTranslation();
  const [showDesignSelector, setShowDesignSelector] = React.useState(false);
  const toothButtonRef = React.useRef<HTMLButtonElement>(null);

  const { data, config, formSelection, toothActions, readOnly, showToast } = useOdontogramContext();
  const { selectedFindingId, selectedSuboption, selectedColor, isComplete } = formSelection;

  // Close the design picker if the finding changes or the form goes read-only.
  // Otherwise the modal stays mounted showing designs/preview that no longer
  // match what's selected in the form.
  // biome-ignore lint/correctness/useExhaustiveDependencies: The picker must close whenever these external selection values change.
  React.useEffect(() => {
    setShowDesignSelector(false);
  }, [selectedFindingId, readOnly]);

  // Opciones predefinidas que activan el marcado
  const predefinedMarkedOptions = [
    3, 4, 8, 20, 23, 38, 7, 28, 37, 36, 10, 5, 16, 27, 34, 35, 9, 14, 15, 17, 18, 19, 22, 29, 33,
  ];

  // Obtener el diente
  const tooth = data.teeth.find((item) => item.toothId === idTooth);

  // Obtener las zonas del diente: prop zones ya viene de config, use it as-is
  const toothZones = zones || 4;

  // Obtener información del hallazgo seleccionado
  const selectedItem = config.findingOptions.find((op) => op.id === selectedFindingId);

  // Función para gestionar los hallazgos
  const handleFindingToggle = () => {
    if (readOnly) return;
    if (!isComplete || !selectedFindingId || !predefinedMarkedOptions.includes(selectedFindingId)) {
      if (selectedFindingId && !isComplete) {
        const opt = config.findingOptions.find((o) => o.id === selectedFindingId);
        const needsColor = (opt?.colores?.length ?? 0) > 0 && !selectedColor;
        const needsSub = (opt?.subopciones?.length ?? 0) > 0 && !selectedSuboption;
        const values = { findingName: opt?.nombre };
        if (needsSub && needsColor) {
          showToast(t('selectFindingTypeAndColor', 'Seleccione tipo y color para "{{findingName}}"', values));
        } else if (needsSub) {
          showToast(t('selectFindingType', 'Seleccione tipo para "{{findingName}}"', values));
        } else if (needsColor) {
          showToast(t('selectFindingColor', 'Seleccione color para "{{findingName}}"', values));
        }
      } else if (!selectedFindingId) {
        showToast(t('selectFindingFirst', 'Seleccione un hallazgo clínico en el formulario'));
      }
      return;
    }

    // Filtrar diseños según las zonas del diente
    const filteredDesigns: FindingDesign[] =
      selectedItem?.designs?.filter((design) => {
        if (!design.zones) return true;
        if (Array.isArray(design.zones)) return design.zones.includes(toothZones);
        return design.zones === toothZones;
      }) || [];

    // Si el hallazgo tiene diseños disponibles para este tipo de diente, mostrar selector
    if (filteredDesigns.length > 0) {
      setShowDesignSelector(true);
      return;
    }

    // Si no tiene diseños compatibles, proceder con la lógica normal (sin diseño)
    // For all non-design findings (including row findings like 7),
    // always use registerToothFinding which handles row/toggle logic properly.
    toothActions.registerToothFinding({
      toothId: idTooth,
      findingId: selectedFindingId,
      subOptionId: selectedSuboption?.id,
      color: selectedColor!,
    });
  };

  // Función para manejar la selección de diseño
  // registerToothFinding handles replace vs toggle-off logic:
  // - same design → toggle off
  // - different design → replace
  // - no existing → add
  const handleDesignSelect = (design: FindingDesign) => {
    if (readOnly || !selectedFindingId) return;

    toothActions.registerToothFinding({
      toothId: idTooth,
      findingId: selectedFindingId,
      subOptionId: selectedSuboption?.id,
      color: selectedColor!,
      designNumber: design.number,
    });
  };

  // Findings that are rendered OUTSIDE the tooth body and must NOT be drawn here:
  //   11 (Fusión), 12 (Geminación), 21 — rendered on the legend svg by ToothDetails
  //   13 (Giroversión)               — rendered in the FindingRow by MainSectionOnTheCanvas
  // They live in TOOTH_DESIGN_COMPONENT_MAP because their design components are
  // shared, but iterating the whole map without this filter caused duplicates
  // appearing on the tooth body in addition to their proper location.
  const TOOTH_BODY_EXCLUDED = new Set<number>([11, 12, 13, 21]);

  // Renderizar todos los hallazgos
  const renderAllFindings = () => {
    if (!tooth?.findings || tooth.findings.length === 0) {
      return null;
    }

    return tooth.findings.map((finding, index: number) => {
      if (TOOTH_BODY_EXCLUDED.has(finding.findingId)) {
        return null;
      }

      const findingKey = String(finding.findingId);
      const designKey = String(finding.designNumber);
      const designComponents = TOOTH_DESIGN_COMPONENT_MAP[findingKey];
      if (!designComponents) {
        return null;
      }

      const DesignComponent = designComponents[designKey];
      if (!DesignComponent) {
        return null;
      }

      return (
        <g key={`finding-${finding.id || index}`}>
          <DesignComponent strokeColor={finding.color?.name || 'black'} />
        </g>
      );
    });
  };

  // Definir altura SVG para la transformación
  const SVG_HEIGHT = 120;
  const transform = position === 'lower' ? `scale(1,-1) translate(0,-${SVG_HEIGHT})` : undefined;

  // Obtener hallazgos existentes para el hallazgo actual
  const existingFindings = tooth?.findings.filter((f) => f.findingId === selectedFindingId) || [];

  // Filtrar diseños según las zonas del diente
  const filteredDesigns =
    selectedItem?.designs?.filter((design) => {
      if (!design.zones) return true;
      if (Array.isArray(design.zones)) return design.zones.includes(toothZones);
      return design.zones === toothZones;
    }) || [];

  // Determine if multi-design (modal stays open)
  const isMultiDesign = selectedFindingId ? isMultiDesignFinding(selectedFindingId) : false;

  return (
    <>
      <button
        ref={toothButtonRef}
        type="button"
        className={styles.toothButton}
        aria-label={t('toothWithId', 'Diente {{toothId}}', { toothId: idTooth })}
        disabled={readOnly}
        onClick={handleFindingToggle}
      >
        <svg width="60" height="120" aria-hidden="true" focusable="false">
          <g transform={transform}>
            <ToothDesigns design={design as 'default' | 'design2' | 'design3' | 'design4'} />
            <Tooth zones={toothZones} />
            {/* Renderizar todos los hallazgos */}
            {renderAllFindings()}
            {/* Re-stroke zone lines on top so colored fill designs don't hide the
              tooth's anatomy. */}
            <Tooth zones={toothZones} strokesOnly />
            {/* Sombreado cuando se selecciona una opción predefinida */}
            {selectedFindingId != null && predefinedMarkedOptions.includes(selectedFindingId) && (
              <rect width="60" height="120" fill="lightgray" opacity="0.45" pointerEvents="none" />
            )}
          </g>
        </svg>
      </button>

      {/* Selector de diseños */}
      <DesignSelector
        isOpen={showDesignSelector}
        launcherButtonRef={toothButtonRef}
        onClose={() => setShowDesignSelector(false)}
        designs={filteredDesigns}
        selectedColor={selectedColor}
        findingName={selectedItem?.nombre || ''}
        toothId={idTooth}
        toothZones={toothZones}
        onDesignSelect={handleDesignSelect}
        existingFindings={existingFindings}
        keepOpen={isMultiDesign}
        suboptions={selectedItem?.subopciones}
        rootDesign={design}
        position={position}
      />
    </>
  );
};

export default ToothVisualization;

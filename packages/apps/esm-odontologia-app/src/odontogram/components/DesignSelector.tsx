import { Modal, Tag } from '@carbon/react';
import { CheckmarkFilled } from '@carbon/react/icons';
import React from 'react';
import {
  Finding5Design1,
  Finding5Design2,
  Finding5Design3,
  Finding5Design4,
  Finding5Design5,
  Finding5Design6,
  Finding5Design7,
  Finding5Design8,
  Finding5Design9,
  Finding5Design10,
  Finding5Design11,
  Finding5Design12,
  Finding5Design13,
  Finding5Design14,
  Finding8Design1,
  Finding8Design2,
  Finding8Design3,
  Finding10Design1,
  Finding10Design2,
  Finding10Design3,
  Finding10Design4,
  Finding10Design5,
  Finding10Design6,
  Finding10Design7,
  Finding10Design8,
  Finding13Design1,
  Finding13Design2,
  Finding27Design9,
  Finding35Design1,
  Finding35Design2,
  Finding35Design3,
  Finding35Design4,
  Finding35Design5,
  Finding35Design6,
  Finding35Design7,
  Finding35Design8,
  Finding35Design9,
  Finding35Design10,
  Finding35Design11,
  Finding35Design12,
  Finding35Design13,
  Finding35Design14,
  Finding36Design1,
  Finding36Design2,
  Finding37Design1,
  Finding37Design2,
  Finding37Design3,
  Finding37Design4,
  Finding37Design5,
} from '../designs/figuras';
import type { FindingColor, FindingDesign, ToothFinding, ToothRootDesign } from '../types/odontogram';
import { COLOR_CSS } from './constants';
import styles from './DesignSelector.module.scss';
import Tooth from './Tooth';
import ToothDesigns from './ToothDesigns';

const TOOTH_SVG_HEIGHT = 120;

// Mapeo de nombres de componentes a componentes reales
const designComponentMap = {
  Finding8Design1: Finding8Design1,
  Finding8Design2: Finding8Design2,
  Finding8Design3: Finding8Design3,
  Finding37Design1: Finding37Design1,
  Finding37Design2: Finding37Design2,
  Finding37Design3: Finding37Design3,
  Finding37Design4: Finding37Design4,
  Finding37Design5: Finding37Design5,
  Finding36Design1: Finding36Design1,
  Finding36Design2: Finding36Design2,
  Finding10Design1: Finding10Design1,
  Finding10Design2: Finding10Design2,
  Finding10Design3: Finding10Design3,
  Finding10Design4: Finding10Design4,
  Finding10Design5: Finding10Design5,
  Finding10Design6: Finding10Design6,
  Finding10Design7: Finding10Design7,
  Finding10Design8: Finding10Design8,
  Finding5Design1: Finding5Design1,
  Finding5Design2: Finding5Design2,
  Finding5Design3: Finding5Design3,
  Finding5Design4: Finding5Design4,
  Finding5Design5: Finding5Design5,
  Finding5Design6: Finding5Design6,
  Finding5Design7: Finding5Design7,
  Finding5Design8: Finding5Design8,
  Finding5Design9: Finding5Design9,
  Finding5Design10: Finding5Design10,
  Finding5Design11: Finding5Design11,
  Finding5Design12: Finding5Design12,
  Finding5Design13: Finding5Design13,
  Finding5Design14: Finding5Design14,
  Finding16Design1: Finding5Design1,
  Finding16Design2: Finding5Design2,
  Finding16Design3: Finding5Design3,
  Finding16Design4: Finding5Design4,
  Finding16Design5: Finding5Design5,
  Finding16Design6: Finding5Design6,
  Finding16Design7: Finding5Design7,
  Finding16Design8: Finding5Design8,
  Finding16Design9: Finding5Design9,
  Finding16Design10: Finding5Design10,
  Finding16Design11: Finding5Design11,
  Finding16Design12: Finding5Design12,
  Finding16Design13: Finding5Design13,
  Finding16Design14: Finding5Design14,
  Finding27Design1: Finding5Design1,
  Finding27Design2: Finding5Design2,
  Finding27Design3: Finding5Design3,
  Finding27Design4: Finding5Design4,
  Finding27Design5: Finding5Design5,
  Finding27Design6: Finding5Design6,
  Finding27Design7: Finding5Design7,
  Finding27Design8: Finding5Design8,
  Finding27Design9: Finding27Design9,
  Finding34Design1: Finding5Design1,
  Finding34Design2: Finding5Design2,
  Finding34Design3: Finding5Design3,
  Finding34Design4: Finding5Design4,
  Finding34Design5: Finding5Design5,
  Finding34Design6: Finding5Design6,
  Finding34Design7: Finding5Design7,
  Finding34Design8: Finding5Design8,
  Finding34Design9: Finding5Design9,
  Finding34Design10: Finding5Design10,
  Finding34Design11: Finding5Design11,
  Finding34Design12: Finding5Design12,
  Finding34Design13: Finding5Design13,
  Finding34Design14: Finding5Design14,
  Finding35Design1: Finding35Design1,
  Finding35Design2: Finding35Design2,
  Finding35Design3: Finding35Design3,
  Finding35Design4: Finding35Design4,
  Finding35Design5: Finding35Design5,
  Finding35Design6: Finding35Design6,
  Finding35Design7: Finding35Design7,
  Finding35Design8: Finding35Design8,
  Finding35Design9: Finding35Design9,
  Finding35Design10: Finding35Design10,
  Finding35Design11: Finding35Design11,
  Finding35Design12: Finding35Design12,
  Finding35Design13: Finding35Design13,
  Finding35Design14: Finding35Design14,
  Finding13Design1: Finding13Design1,
  Finding13Design2: Finding13Design2,
};

interface DesignSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  designs: FindingDesign[];
  selectedColor: FindingColor | null;
  findingName: string;
  toothId: string | number;
  toothZones: number;
  onDesignSelect: (design: FindingDesign) => void;
  existingFindings?: ToothFinding[];
  /** When true, the modal stays open after selecting a design (for multi-design findings). */
  keepOpen?: boolean;
  /** Suboptions config to show Tipo label on applied designs */
  suboptions?: { id: number; nombre: string }[];
  /** Tooth root design variant — drives the upper part of the preview svg */
  rootDesign?: ToothRootDesign;
  /** Tooth arch position — lower teeth render the preview vertically flipped */
  position?: 'upper' | 'lower';
}

const DesignSelector: React.FC<DesignSelectorProps> = ({
  isOpen,
  onClose,
  designs,
  selectedColor,
  findingName,
  toothId,
  toothZones,
  onDesignSelect,
  existingFindings = [],
  keepOpen = false,
  suboptions,
  rootDesign = 'default',
  position = 'upper',
}) => {
  const toothTransform = position === 'lower' ? `scale(1,-1) translate(0,-${TOOTH_SVG_HEIGHT})` : undefined;
  const handleDesignClick = (design: FindingDesign) => {
    onDesignSelect(design);
    if (!keepOpen) {
      onClose();
    }
  };

  const colorLabel = selectedColor?.name === 'red' ? 'Rojo' : selectedColor?.name === 'blue' ? 'Azul' : 'Negro';
  const colorTagType: 'red' | 'blue' | 'gray' =
    selectedColor?.name === 'red' ? 'red' : selectedColor?.name === 'blue' ? 'blue' : 'gray';

  return (
    <Modal
      open={isOpen}
      passiveModal
      onRequestClose={onClose}
      modalHeading={`Seleccionar diseño para ${findingName}`}
      size="lg"
      selectorPrimaryFocus="#design-selector-header"
      className={styles.modal}
    >
      <div
        className={styles.header}
        id="design-selector-header"
        tabIndex={-1}
        style={
          selectedColor
            ? ({ '--accent-color': COLOR_CSS[selectedColor.name] ?? selectedColor.name } as React.CSSProperties)
            : undefined
        }
      >
        <div className={styles.previewTooth} role="img" aria-label="Vista previa del hallazgo en el diente">
          <svg width="60" height={TOOTH_SVG_HEIGHT}>
            <g transform={toothTransform}>
              <ToothDesigns design={rootDesign} />
              <Tooth zones={toothZones} />
              {existingFindings.map((finding) => {
                if (!finding.designNumber) return null;
                const designConfig = designs.find((d) => d.number === finding.designNumber);
                if (!designConfig) return null;
                const Component = designComponentMap[designConfig.componente as keyof typeof designComponentMap];
                if (!Component) return null;
                return (
                  <g key={finding.id}>
                    <Component strokeColor={finding.color?.name || 'black'} />
                  </g>
                );
              })}
              <Tooth zones={toothZones} strokesOnly />
            </g>
          </svg>
        </div>
        <div className={styles.headerInfo}>
          <span className={styles.headerInfoLabel}>Vista previa</span>
          <div className={styles.headerInfoTags}>
            <Tag type="gray" size="md">{`Diente ${toothId}`}</Tag>
            <Tag type={colorTagType} size="md">{`Color: ${colorLabel}`}</Tag>
          </div>
        </div>
      </div>

      <p className={styles.hint}>
        {keepOpen
          ? 'Selecciona los diseños que desees aplicar. Haz click en uno aplicado para quitarlo.'
          : 'Selecciona un diseño para aplicar o eliminar el hallazgo.'}
      </p>

      <div className={styles.designsGrid}>
        {designs.map((design) => {
          const DesignComponent = designComponentMap[design.componente as keyof typeof designComponentMap];

          if (!DesignComponent) {
            return (
              <div key={design.number} className={styles.designMissing}>
                Componente no encontrado: {design.componente}
              </div>
            );
          }

          const appliedFinding = existingFindings.find((finding) => finding.designNumber === design.number);
          const isApplied = !!appliedFinding;
          const appliedTipo =
            isApplied && suboptions && appliedFinding?.subOptionId != null
              ? suboptions.find((s) => s.id === appliedFinding.subOptionId)?.nombre
              : undefined;
          const previewColor = selectedColor?.name || 'black';

          return (
            <button
              key={design.number}
              type="button"
              className={`${styles.designTile} ${isApplied ? styles.designTileApplied : ''}`}
              onClick={() => handleDesignClick(design)}
              aria-pressed={isApplied}
            >
              <div className={styles.designSvgWrap}>
                <svg width="60" height={TOOTH_SVG_HEIGHT}>
                  <g transform={toothTransform}>
                    <ToothDesigns design={rootDesign} />
                    <Tooth zones={toothZones} />
                    <DesignComponent strokeColor={previewColor} />
                    <Tooth zones={toothZones} strokesOnly />
                  </g>
                </svg>
              </div>

              <div className={styles.designLabel}>{`Diseño ${design.number}`}</div>

              {isApplied && (
                <>
                  <CheckmarkFilled size={20} className={styles.designAppliedIcon} />
                  <div className={styles.designTags}>
                    <Tag type="green" size="sm">
                      Aplicado
                    </Tag>
                    {appliedTipo && <Tag type="gray" size="sm">{`Tipo: ${appliedTipo}`}</Tag>}
                  </div>
                </>
              )}
            </button>
          );
        })}
      </div>
    </Modal>
  );
};

export default DesignSelector;

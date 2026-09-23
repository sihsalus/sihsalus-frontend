import { FeatureFlags, Modal, Tag } from '@carbon/react';
import { CheckmarkFilled } from '@carbon/react/icons';
import React from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { FindingColor, FindingDesign, ToothFinding, ToothRootDesign } from '../types/odontogram';
import { COLOR_CSS, COLOR_LABEL, DESIGN_COMPONENT_MAP } from './constants';
import styles from './DesignSelector.module.scss';
import Tooth from './Tooth';
import ToothDesigns from './ToothDesigns';

const TOOTH_SVG_HEIGHT = 120;

interface DesignSelectorProps {
  isOpen: boolean;
  launcherButtonRef?: React.RefObject<HTMLButtonElement>;
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
  launcherButtonRef,
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
  const { t } = useTranslation();
  const toothTransform = position === 'lower' ? `scale(1,-1) translate(0,-${TOOTH_SVG_HEIGHT})` : undefined;
  const handleDesignClick = (design: FindingDesign) => {
    onDesignSelect(design);
    if (!keepOpen) {
      onClose();
    }
  };

  const colorName = selectedColor?.name ?? 'black';
  const colorLabel = t(colorName, COLOR_LABEL[colorName] ?? colorName);
  const colorTagType: 'red' | 'blue' | 'gray' =
    selectedColor?.name === 'red' ? 'red' : selectedColor?.name === 'blue' ? 'blue' : 'gray';

  // Render via createPortal targeted directly at `document.body`. The Modal
  // is rendered from inside ToothVisualization, which lives inside the
  // <foreignObject> of the responsive SVG wrapper. Without an explicit portal
  // out, the Modal's positioning (position: fixed centering) gets confused by
  // the SVG containing-block context. Forcing body as target guarantees the
  // modal is laid out relative to the viewport, centered correctly, and full
  // coverage with backdrop regardless of how the odontogram is scaled.
  if (typeof document === 'undefined') return null;

  const modalNode = (
    <Modal
      open={isOpen}
      launcherButtonRef={launcherButtonRef}
      passiveModal
      closeButtonLabel={t('close', 'Cerrar')}
      onRequestClose={onClose}
      modalHeading={t('selectDesignForFinding', 'Seleccionar diseño para {{findingName}}', { findingName })}
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
        <div
          className={styles.previewTooth}
          role="img"
          aria-label={t('findingPreviewOnTooth', 'Vista previa del hallazgo en el diente')}
        >
          <svg width="60" height={TOOTH_SVG_HEIGHT}>
            <g transform={toothTransform}>
              <ToothDesigns design={rootDesign} />
              <Tooth zones={toothZones} />
              {existingFindings.map((finding) => {
                if (!finding.designNumber) return null;
                const designConfig = designs.find((d) => d.number === finding.designNumber);
                if (!designConfig) return null;
                const Component = DESIGN_COMPONENT_MAP[designConfig.componente];
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
          <span className={styles.headerInfoLabel}>{t('preview', 'Vista previa')}</span>
          <div className={styles.headerInfoTags}>
            <Tag type="gray" size="md">
              {t('toothWithId', 'Diente {{toothId}}', { toothId })}
            </Tag>
            <Tag type={colorTagType} size="md">
              {t('colorWithName', 'Color: {{name}}', { name: colorLabel })}
            </Tag>
          </div>
        </div>
      </div>

      <p className={styles.hint}>
        {keepOpen
          ? t(
              'designSelector.keepOpenHint',
              'Selecciona los diseños que desees aplicar. Haz click en uno aplicado para quitarlo.',
            )
          : t('designSelector.singleSelectHint', 'Selecciona un diseño para aplicar o eliminar el hallazgo.')}
      </p>

      <div className={styles.designsGrid}>
        {designs.map((design) => {
          const DesignComponent = DESIGN_COMPONENT_MAP[design.componente];

          if (!DesignComponent) {
            return (
              <div key={design.number} className={styles.designMissing}>
                {t('designUnavailable', 'Este diseño no está disponible.')}
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

              <div className={styles.designLabel}>
                {t('designWithNumber', 'Diseño {{designNumber}}', { designNumber: design.number })}
              </div>

              {isApplied && (
                <>
                  <CheckmarkFilled size={20} className={styles.designAppliedIcon} />
                  <div className={styles.designTags}>
                    <Tag type="green" size="sm">
                      {t('applied', 'Aplicado')}
                    </Tag>
                    {appliedTipo && (
                      <Tag type="gray" size="sm">
                        {t('typeWithName', 'Tipo: {{name}}', { name: appliedTipo })}
                      </Tag>
                    )}
                  </div>
                </>
              )}
            </button>
          );
        })}
      </div>
    </Modal>
  );

  return createPortal(<FeatureFlags enableFocusWrapWithoutSentinels>{modalNode}</FeatureFlags>, document.body);
};

export default DesignSelector;

import { Button, Modal, Search } from '@carbon/react';
import { Checkmark, ChevronDown, Close, Information } from '@carbon/react/icons';
import { useCallback, useMemo, useState } from 'react';
import { useOdontogramContext } from '../providers/OdontogramProvider';
import type { FindingColor, FindingOptionConfig, FindingSuboption } from '../types/odontogram';
import { COLOR_CSS, COLOR_LABEL } from './constants';
import styles from './FormDentalClinicalFindings.module.scss';

// ─── Datos de referencia de siglas clínicas por hallazgo ─────────────────────
interface SiglaEntry {
  sigla: string;
  significado: string;
}
interface SiglaGroup {
  hallazgo: string;
  nota?: string;
  siglas: SiglaEntry[];
}

const SIGLAS_MAP: Record<number, SiglaGroup> = {
  3: {
    hallazgo: 'Corona',
    nota: 'En especificaciones: detallar color del metal u otras características.',
    siglas: [
      { sigla: 'CM', significado: 'Corona Metálica' },
      { sigla: 'CF', significado: 'Corona Fenestrada' },
      { sigla: 'CMC', significado: 'Corona Metal Cerámica' },
      { sigla: 'CV', significado: 'Corona Veneer' },
      { sigla: 'CLM', significado: 'Corona Libre de Metal' },
    ],
  },
  4: {
    hallazgo: 'Corona Temporal',
    siglas: [{ sigla: 'CT', significado: 'Corona Temporal' }],
  },
  5: {
    hallazgo: 'Defectos de Desarrollo del Esmalte (DDE)',
    nota: 'Colocar siglas en rojo. Fluorosis: detallar en especificaciones con clasificación.',
    siglas: [
      { sigla: 'O', significado: 'Opacidades' },
      { sigla: 'PE', significado: 'Pigmentación' },
      { sigla: 'Fluorosis', significado: 'Detallar en especificaciones' },
    ],
  },
  9: {
    hallazgo: 'Fosas y Fisuras Profundas',
    siglas: [{ sigla: 'FFP', significado: 'Fosas y Fisuras Profundas' }],
  },
  13: {
    hallazgo: 'Giroversión',
    nota: 'Flecha curva azul en sentido de rotación a nivel oclusal.',
    siglas: [],
  },
  14: {
    hallazgo: 'Impactación',
    siglas: [{ sigla: 'I', significado: 'Impactación' }],
  },
  15: {
    hallazgo: 'Implante Dental',
    siglas: [{ sigla: 'IMP', significado: 'Implante Dental' }],
  },
  16: {
    hallazgo: 'Lesión de Caries Dental',
    siglas: [
      { sigla: 'MB', significado: 'Mancha Blanca' },
      { sigla: 'CE', significado: 'Caries en Esmalte' },
      { sigla: 'CD', significado: 'Caries en Dentina' },
      { sigla: 'CDP', significado: 'Compromiso Pulpar' },
    ],
  },
  17: {
    hallazgo: 'Macrodoncia',
    siglas: [{ sigla: 'MAC', significado: 'Macrodoncia' }],
  },
  18: {
    hallazgo: 'Microdoncia',
    siglas: [{ sigla: 'MIC', significado: 'Microdoncia' }],
  },
  19: {
    hallazgo: 'Movilidad Patológica',
    nota: 'Colocar M + número de grado.',
    siglas: [
      { sigla: 'M1', significado: 'Movilidad grado 1' },
      { sigla: 'M2', significado: 'Movilidad grado 2' },
      { sigla: 'M3', significado: 'Movilidad grado 3' },
    ],
  },
  20: {
    hallazgo: 'Pieza Dentaria Ausente',
    siglas: [
      { sigla: 'DNE', significado: 'No Erupcionado' },
      { sigla: 'DEX', significado: 'Extracción por Caries' },
      { sigla: 'DAO', significado: 'Ausente por Otra Causa' },
    ],
  },
  22: {
    hallazgo: 'Pieza Ectópica',
    siglas: [{ sigla: 'E', significado: 'Ectópica' }],
  },
  23: {
    hallazgo: 'Pieza en Erupción',
    nota: 'Flecha en zigzag azul dirigida al plano oclusal.',
    siglas: [],
  },
  24: {
    hallazgo: 'Pieza Extruida',
    nota: 'Flecha recta vertical azul hacia externo.',
    siglas: [],
  },
  25: {
    hallazgo: 'Pieza Intruida',
    nota: 'Flecha recta vertical azul hacia incisal/oclusal.',
    siglas: [],
  },
  27: {
    hallazgo: 'Pulpotomía',
    nota: 'Azul: buen estado. Rojo: mal estado.',
    siglas: [{ sigla: 'PP', significado: 'Pulpotomía' }],
  },
  28: {
    hallazgo: 'Pulpectomía',
    siglas: [{ sigla: 'PC', significado: 'Pulpectomía' }],
  },
  29: {
    hallazgo: 'Posición Anormal Dentaria',
    nota: 'Siglas en azul.',
    siglas: [
      { sigla: 'M', significado: 'Mesializado' },
      { sigla: 'D', significado: 'Distalizado' },
      { sigla: 'V', significado: 'Vestibularizado' },
      { sigla: 'P', significado: 'Palatinizado' },
      { sigla: 'L', significado: 'Lingualizado' },
    ],
  },
  33: {
    hallazgo: 'Remanente Radicular',
    siglas: [{ sigla: 'RR', significado: 'Remanente Radicular' }],
  },
  34: {
    hallazgo: 'Restauración Definitiva',
    nota: 'Azul: buen estado. Rojo: mal estado.',
    siglas: [
      { sigla: 'AM', significado: 'Amalgama' },
      { sigla: 'R', significado: 'Resina' },
      { sigla: 'IV', significado: 'Ionómero' },
      { sigla: 'IM', significado: 'Incrustación Metálica' },
      { sigla: 'IE', significado: 'Incrustación Estética' },
      { sigla: 'C', significado: 'Carilla' },
    ],
  },
  36: {
    hallazgo: 'Sellantes',
    siglas: [{ sigla: 'S', significado: 'Sellantes' }],
  },
  37: {
    hallazgo: 'Superficie Desgastada',
    nota: 'Sigla en rojo.',
    siglas: [{ sigla: 'DES', significado: 'Superficie Desgastada' }],
  },
  38: {
    hallazgo: 'Tratamiento de Conducto',
    nota: 'Azul: buen estado. Rojo: mal estado.',
    siglas: [
      { sigla: 'TC', significado: 'Tratamiento de Conductos' },
      { sigla: 'PC', significado: 'Pulpectomía' },
    ],
  },
};

const FormDentalClinicalFindings = () => {
  const { config, formSelection, formActions } = useOdontogramContext();

  const opciones = config.findingOptions;
  const selectedOption = formSelection.selectedFindingId;
  const selectedColor = formSelection.selectedColor;
  const selectedSuboption = formSelection.selectedSuboption;
  const selectedItem = useMemo<FindingOptionConfig | null>(
    () => opciones.find((op) => op.id === selectedOption) ?? null,
    [opciones, selectedOption],
  );

  const [showInfo, setShowInfo] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');

  const norm = useCallback((s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''), []);

  const filteredOpciones = useMemo(() => {
    const q = norm(pickerQuery.trim());
    if (!q) return opciones;
    return opciones.filter((op) => norm(op.nombre).includes(q));
  }, [opciones, pickerQuery, norm]);

  const closePicker = useCallback(() => {
    setPickerOpen(false);
    setPickerQuery('');
  }, []);

  const handleSelectFinding = useCallback(
    (item: FindingOptionConfig | null) => {
      formActions.selectFinding(item?.id ?? null);
      closePicker();
    },
    [formActions, closePicker],
  );

  const handleSelectColor = useCallback((c: FindingColor) => formActions.selectColor(c), [formActions]);

  const handleSelectSuboption = useCallback(
    (sub: FindingSuboption) => formActions.selectSuboption(selectedSuboption?.id === sub.id ? null : sub),
    [formActions, selectedSuboption],
  );

  const docsGroup = selectedOption != null ? SIGLAS_MAP[selectedOption] : null;

  return (
    <div className={styles.formContainer}>
      <div className={styles.formGrid}>
        {/* Hallazgo */}
        <div className={`${styles.field} ${styles.fieldFinding}`}>
          <span className={styles.fieldLabel}>Hallazgo</span>
          <button
            type="button"
            className={`${styles.findingTrigger} ${selectedItem ? styles.findingTriggerFilled : ''}`}
            onClick={() => setPickerOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={pickerOpen}
          >
            <span className={styles.findingTriggerText}>
              {selectedItem ? selectedItem.nombre : 'Seleccionar hallazgo…'}
            </span>
            {selectedItem && (
              <span
                className={styles.findingTriggerClear}
                role="button"
                tabIndex={0}
                aria-label="Limpiar hallazgo"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelectFinding(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSelectFinding(null);
                  }
                }}
              >
                <Close size={16} />
              </span>
            )}
            <ChevronDown size={16} className={styles.findingTriggerChevron} />
          </button>
        </div>

        {/* Tipo */}
        {selectedItem && (selectedItem.subopciones?.length ?? 0) > 0 && (
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Tipo</span>
            <div className={styles.subOptionRow} role="group" aria-label="Tipo">
              {selectedItem.subopciones!.map((sub: FindingSuboption) => {
                const isActive = selectedSuboption?.id === sub.id;
                return (
                  <button
                    key={sub.id}
                    type="button"
                    className={`${styles.subOptionChip} ${isActive ? styles.subOptionChipActive : ''}`}
                    onClick={() => handleSelectSuboption(sub)}
                    aria-pressed={isActive}
                    title={sub.descripcion ?? sub.nombre}
                  >
                    {sub.nombre}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Color */}
        {selectedItem && (selectedItem.colores?.length ?? 0) > 0 && (
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Color</span>
            <div className={styles.colorRow}>
              {selectedItem.colores.map((color: FindingColor) => {
                const isActive = selectedColor?.name === color.name;
                const label = COLOR_LABEL[color.name] ?? color.name;
                return (
                  <button
                    key={color.id}
                    type="button"
                    className={`${styles.colorSwatch} ${isActive ? styles.colorSwatchActive : ''}`}
                    onClick={() => handleSelectColor(color)}
                    aria-label={label}
                    aria-pressed={isActive}
                    title={label}
                  >
                    <span
                      className={styles.colorDot}
                      style={{ backgroundColor: COLOR_CSS[color.name] ?? '#888' }}
                      aria-hidden
                    />
                    <span>{label}</span>
                    {isActive && <Checkmark size={16} className={styles.colorCheck} />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Documentación */}
        {docsGroup && (
          <div className={styles.fieldDocs}>
            <Button kind="ghost" size="md" renderIcon={Information} onClick={() => setShowInfo(true)}>
              Documentación
            </Button>
          </div>
        )}
      </div>

      <Modal
        open={pickerOpen}
        passiveModal
        modalHeading="Seleccionar hallazgo"
        onRequestClose={closePicker}
        size="lg"
        selectorPrimaryFocus="#finding-picker-search"
      >
        <div className={styles.pickerSearchWrap}>
          <Search
            id="finding-picker-search"
            labelText="Buscar hallazgo"
            placeholder="Buscar hallazgo por nombre…"
            size="lg"
            value={pickerQuery}
            onChange={(e) => setPickerQuery(e.target.value)}
            onClear={() => setPickerQuery('')}
          />
        </div>
        <div className={styles.pickerGrid}>
          {filteredOpciones.map((op) => {
            const isSelected = op.id === selectedOption;
            return (
              <button
                key={op.id}
                type="button"
                className={`${styles.pickerTile} ${isSelected ? styles.pickerTileSelected : ''}`}
                onClick={() => handleSelectFinding(op)}
                aria-pressed={isSelected}
              >
                <span className={styles.pickerTileName}>{op.nombre}</span>
                {isSelected && <Checkmark size={16} className={styles.pickerTileCheck} />}
              </button>
            );
          })}
          {filteredOpciones.length === 0 && (
            <p className={styles.pickerEmpty}>Sin coincidencias para «{pickerQuery}»</p>
          )}
        </div>
      </Modal>

      {showInfo && docsGroup && (
        <Modal open passiveModal modalHeading={docsGroup.hallazgo} onRequestClose={() => setShowInfo(false)} size="sm">
          {docsGroup.nota && <p className={styles.docsNote}>{docsGroup.nota}</p>}
          {docsGroup.siglas.length > 0 && (
            <table className={styles.docsTable}>
              <tbody>
                {docsGroup.siglas.map((s) => (
                  <tr key={s.sigla}>
                    <td className={styles.docsCode}>{s.sigla}</td>
                    <td className={styles.docsDesc}>{s.significado}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Modal>
      )}
    </div>
  );
};

export default FormDentalClinicalFindings;

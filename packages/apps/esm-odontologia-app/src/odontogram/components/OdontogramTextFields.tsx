import { Modal, TextArea } from '@carbon/react';
import { Information } from '@carbon/react/icons';
import React, { useState } from 'react';
import type { OdontogramData } from '../types/odontogram';
import styles from './OdontogramTextFields.module.scss';

interface OdontogramTextFieldsProps {
  data: OdontogramData;
  onChange: (data: OdontogramData) => void;
  readOnly?: boolean;
}

type HelpKey = 'especificaciones' | 'observaciones';

interface HelpContent {
  heading: string;
  intro: string;
  examples: string[];
}

// Guía concisa para los dos campos libres. Ambos son OPCIONALES — sólo se
// llenan cuando hay algo que el odontograma gráfico no puede expresar (en
// Especificaciones) o algo relevante del encuentro clínico (en Observaciones).
const HELP_CONTENT: Record<HelpKey, HelpContent> = {
  especificaciones: {
    heading: '¿Qué va en "Especificaciones"?',
    intro:
      'Aclaraciones por pieza que el dibujo del odontograma no puede mostrar: severidad de un hallazgo, material de una restauración, clasificación de una fractura, grado de movilidad, o cualquier dato clínico que necesite quedar escrito sobre una pieza específica.',
    examples: [
      'Pieza 3.6: caries profunda próxima a pulpa, probable compromiso pulpar',
      'Pieza 1.6: restauración oclusal en amalgama, en buen estado',
    ],
  },
  observaciones: {
    heading: '¿Qué va en "Observaciones"?',
    intro:
      'Notas sobre la atención en general, no atadas a una pieza específica: síntomas referidos por el paciente, condiciones que afectaron la consulta, derivaciones a otros especialistas, indicaciones dadas al paciente o contexto médico relevante.',
    examples: [
      'Paciente refiere dolor espontáneo nocturno en sector posterior inferior derecho',
      'Se deriva a ortodoncia por apiñamiento severo anterosuperior',
    ],
  },
};

const OdontogramTextFields: React.FC<OdontogramTextFieldsProps> = ({ data, onChange, readOnly = false }) => {
  const [helpKey, setHelpKey] = useState<HelpKey | null>(null);

  const renderLabel = (label: string, key: HelpKey) => (
    <span className={styles.labelRow}>
      <span>
        {label} <span className={styles.optionalTag}>(opcional)</span>
      </span>
      <button
        type="button"
        className={styles.helpButton}
        onClick={() => setHelpKey(key)}
        aria-label={`Qué va en ${label}`}
      >
        <Information size={16} aria-hidden />
      </button>
    </span>
  );

  const content = helpKey ? HELP_CONTENT[helpKey] : null;

  return (
    <>
      <div className={styles.container}>
        <TextArea
          id="odon-especificaciones"
          labelText={renderLabel('Especificaciones', 'especificaciones')}
          value={data.especificaciones ?? ''}
          onChange={(e) => onChange({ ...data, especificaciones: e.target.value })}
          disabled={readOnly}
          rows={3}
          placeholder="Detalles que el gráfico no puede expresar (severidad, material, etc.)"
        />
        <TextArea
          id="odon-observaciones"
          labelText={renderLabel('Observaciones', 'observaciones')}
          value={data.observaciones ?? ''}
          onChange={(e) => onChange({ ...data, observaciones: e.target.value })}
          disabled={readOnly}
          rows={3}
          placeholder="Contexto de la atención no vinculado a piezas específicas"
        />
      </div>

      {content && (
        <Modal open passiveModal modalHeading={content.heading} onRequestClose={() => setHelpKey(null)} size="sm">
          <p className={styles.helpIntro}>{content.intro}</p>
          <p className={styles.helpExamplesLabel}>Ejemplos</p>
          <ul className={styles.helpExamplesList}>
            {content.examples.map((example) => (
              <li key={example} className={styles.helpExample}>
                {example}
              </li>
            ))}
          </ul>
        </Modal>
      )}
    </>
  );
};

export default OdontogramTextFields;

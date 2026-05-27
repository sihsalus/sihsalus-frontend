import { Modal, TextArea } from '@carbon/react';
import { Information } from '@carbon/react/icons';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
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

const OdontogramTextFields: React.FC<OdontogramTextFieldsProps> = ({ data, onChange, readOnly = false }) => {
  const { t } = useTranslation();
  const [helpKey, setHelpKey] = useState<HelpKey | null>(null);
  const helpContent: Record<HelpKey, HelpContent> = {
    especificaciones: {
      heading: t('odontogramSpecificationsHelpHeading', '¿Qué va en "Especificaciones"?'),
      intro: t(
        'odontogramSpecificationsHelpIntro',
        'Aclaraciones por pieza que el dibujo del odontograma no puede mostrar: severidad de un hallazgo, material de una restauración, clasificación de una fractura, grado de movilidad, o cualquier dato clínico que necesite quedar escrito sobre una pieza específica.',
      ),
      examples: [
        t(
          'odontogramSpecificationsHelpExampleCaries',
          'Pieza 3.6: caries profunda próxima a pulpa, probable compromiso pulpar',
        ),
        t(
          'odontogramSpecificationsHelpExampleRestoration',
          'Pieza 1.6: restauración oclusal en amalgama, en buen estado',
        ),
      ],
    },
    observaciones: {
      heading: t('odontogramObservationsHelpHeading', '¿Qué va en "Observaciones"?'),
      intro: t(
        'odontogramObservationsHelpIntro',
        'Notas sobre la atención en general, no atadas a una pieza específica: síntomas referidos por el paciente, condiciones que afectaron la consulta, derivaciones a otros especialistas, indicaciones dadas al paciente o contexto médico relevante.',
      ),
      examples: [
        t(
          'odontogramObservationsHelpExamplePain',
          'Paciente refiere dolor espontáneo nocturno en sector posterior inferior derecho',
        ),
        t('odontogramObservationsHelpExampleReferral', 'Se deriva a ortodoncia por apiñamiento severo anterosuperior'),
      ],
    },
  };

  const renderLabel = (label: string, key: HelpKey) => (
    <span className={styles.labelRow}>
      <span>
        {label} <span className={styles.optionalTag}>{t('optionalInParentheses', '(opcional)')}</span>
      </span>
      <button
        type="button"
        className={styles.helpButton}
        onClick={() => setHelpKey(key)}
        aria-label={t('odontogramFieldHelpAriaLabel', 'Qué va en {{label}}', { label })}
      >
        <Information size={16} aria-hidden />
      </button>
    </span>
  );

  const content = helpKey ? helpContent[helpKey] : null;

  return (
    <>
      <div className={styles.container}>
        <TextArea
          id="odon-especificaciones"
          labelText={renderLabel(t('specifications', 'Especificaciones'), 'especificaciones')}
          value={data.especificaciones ?? ''}
          onChange={(e) => onChange({ ...data, especificaciones: e.target.value })}
          disabled={readOnly}
          rows={3}
          placeholder={t(
            'odontogramSpecificationsPlaceholder',
            'Detalles que el gráfico no puede expresar (severidad, material, etc.)',
          )}
        />
        <TextArea
          id="odon-observaciones"
          labelText={renderLabel(t('observations', 'Observaciones'), 'observaciones')}
          value={data.observaciones ?? ''}
          onChange={(e) => onChange({ ...data, observaciones: e.target.value })}
          disabled={readOnly}
          rows={3}
          placeholder={t(
            'odontogramObservationsPlaceholder',
            'Contexto de la atención no vinculado a piezas específicas',
          )}
        />
      </div>

      {content && (
        <Modal open passiveModal modalHeading={content.heading} onRequestClose={() => setHelpKey(null)} size="sm">
          <p className={styles.helpIntro}>{content.intro}</p>
          <p className={styles.helpExamplesLabel}>{t('examples', 'Ejemplos')}</p>
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

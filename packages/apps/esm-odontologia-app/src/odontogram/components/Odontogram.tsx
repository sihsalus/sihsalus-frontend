/**
 * Componente público del Odontograma.
 *
 * Envuelve todo el árbol en un OdontogramProvider (estado por instancia)
 * y renderiza la UI: formulario de hallazgos, arcada superior e inferior.
 *
 * Uso:
 * ```tsx
 * <Odontogram config={adultConfig} data={data} onChange={setData} />
 * ```
 */

import React from 'react';
import { OdontogramProvider } from '../providers/OdontogramProvider';
import FormDentalClinicalFindings from './FormDentalClinicalFindings';
import OdontogramTextFields from './OdontogramTextFields';
import TeethArch from './TeethArch';
import './AdultOdontogram.css';

import type { OdontogramConfig, OdontogramData } from '../types/odontogram';

export interface OdontogramProps {
  /** Structural config (adult / child) */
  config: OdontogramConfig;
  /** Current data (controlled) */
  data: OdontogramData;
  /** Callback when data changes */
  onChange: (data: OdontogramData) => void;
  /** Disables all interactions */
  readOnly?: boolean;
  /** Optional title */
  title?: string;
  /** Optional description */
  description?: string;
}

const Odontogram: React.FC<OdontogramProps> = ({ config, data, onChange, readOnly = false, title, description }) => {
  return (
    <OdontogramProvider config={config} data={data} onChange={onChange} readOnly={readOnly}>
      <div className="adult-odontogram-container">
        {(title || description) && (
          <div className="odontogram-header">
            {title && <h2>{title}</h2>}
            {description && <p>{description}</p>}
          </div>
        )}

        <div className="odontogram-content">
          {/* Formulario de hallazgos clínicos */}
          {!readOnly && (
            <div className="form-section">
              <FormDentalClinicalFindings />
            </div>
          )}

          {/* Visualización del odontograma — los teeth tienen ancho natural
              de 1260px. Para containers más narrows, `overflow-x: auto` en
              `.teeth-visualization` (ver AdultOdontogram.css) permite scroll
              horizontal sin recurrir a CSS transform que rompía el layout
              box altura. */}
          <div className="teeth-visualization">
            <div className="upper-teeth-section">
              <TeethArch position="upper" />
            </div>

            <div className="lower-teeth-section">
              <TeethArch position="lower" />
            </div>
          </div>

          {/* Campos de texto que SIEMPRE viajan con el odontograma.
              Junto con `teeth`, `spacingFindings` y `legendSpaces` conforman el
              payload completo de OdontogramData. La capa de integración (backend
              OpenMRS) debe persistir los tres como una unidad clínica.
              Viven dentro de `.odontogram-content` para heredar el flex gap
              de 10px que separa cada bloque uniformemente. */}
          <OdontogramTextFields data={data} onChange={onChange} readOnly={readOnly} />
        </div>
      </div>
    </OdontogramProvider>
  );
};

export default Odontogram;

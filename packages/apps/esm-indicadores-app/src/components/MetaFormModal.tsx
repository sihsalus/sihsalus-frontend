import { Modal, NumberInput, Select, SelectItem } from '@carbon/react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { IndicadorDetail, IndicadorMeta, IndicadorMetaCreatePayload } from '../api/types';

interface MetaFormModalProps {
  isOpen: boolean;
  indicators: Array<IndicadorDetail>;
  initialMeta?: IndicadorMeta | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (payload: IndicadorMetaCreatePayload) => Promise<void>;
}

const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

function findVersionIndicator(indicators: Array<IndicadorDetail>, versionId?: string): IndicadorDetail | undefined {
  if (!versionId) {
    return undefined;
  }
  return indicators.find((indicator) => indicator.versiones.some((version) => version.id === versionId));
}

const MetaFormModal: React.FC<MetaFormModalProps> = ({
  isOpen,
  indicators,
  initialMeta,
  isSubmitting,
  onClose,
  onSubmit,
}) => {
  const { t } = useTranslation();

  const initialIndicator = useMemo(
    () => findVersionIndicator(indicators, initialMeta?.indicador_version_id),
    [indicators, initialMeta?.indicador_version_id],
  );

  const [selectedIndicatorId, setSelectedIndicatorId] = useState<string>(initialIndicator?.id ?? '');
  const [selectedVersionId, setSelectedVersionId] = useState<string>(initialMeta?.indicador_version_id ?? '');
  const [anio, setAnio] = useState<number | ''>(initialMeta?.anio ?? '');
  const [valorMeta, setValorMeta] = useState<number | ''>(initialMeta?.valor_meta ?? '');
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const indicator = findVersionIndicator(indicators, initialMeta?.indicador_version_id);
    setSelectedIndicatorId(indicator?.id ?? '');
    setSelectedVersionId(initialMeta?.indicador_version_id ?? '');
    setAnio(initialMeta?.anio ?? '');
    setValorMeta(initialMeta?.valor_meta ?? '');
    setValidationError(null);
  }, [isOpen, indicators, initialMeta]);

  const selectedIndicator = useMemo(
    () => indicators.find((indicator) => indicator.id === selectedIndicatorId),
    [indicators, selectedIndicatorId],
  );

  const versiones = selectedIndicator?.versiones ?? [];

  useEffect(() => {
    if (selectedIndicatorId && selectedVersionId) {
      const stillAvailable = versiones.some((version) => version.id === selectedVersionId);
      if (!stillAvailable) {
        setSelectedVersionId('');
      }
    }
  }, [selectedIndicatorId, selectedVersionId, versiones]);

  const validate = (): string | null => {
    if (!selectedIndicatorId) {
      return t('metaValidationIndicator', 'Seleccioná un indicador.');
    }
    if (!selectedVersionId) {
      return t('metaValidationVersion', 'Seleccioná una versión.');
    }
    if (anio === '' || !Number.isInteger(anio) || anio < MIN_YEAR || anio > MAX_YEAR) {
      return t('metaValidationYear', 'El año debe estar entre {{minYear}} y {{maxYear}}.', {
        minYear: MIN_YEAR,
        maxYear: MAX_YEAR,
      });
    }
    if (valorMeta === '' || Number(valorMeta) < 0) {
      return t('metaValidationValue', 'La meta no puede ser negativa.');
    }
    return null;
  };

  const handleSubmit = async () => {
    setValidationError(null);
    const error = validate();
    if (error) {
      setValidationError(error);
      return;
    }
    await onSubmit({
      indicador_version_id: selectedVersionId,
      anio: Number(anio),
      valor_meta: Number(valorMeta),
    });
  };

  const primaryButton = isSubmitting ? (
    <span>{t('saving', 'Guardando...')}</span>
  ) : (
    t('save', 'Guardar')
  );

  return (
    <Modal
      open={isOpen}
      modalHeading={initialMeta ? t('editMeta', 'Editar meta') : t('newMeta', 'Nueva meta')}
      primaryButtonText={primaryButton}
      primaryButtonDisabled={isSubmitting}
      secondaryButtonText={t('cancel', 'Cancelar')}
      onRequestClose={onClose}
      onRequestSubmit={handleSubmit}
    >
      <div style={{ display: 'grid', gap: '1.25rem' }}>
        {validationError ? (
          <div role="alert" style={{ color: '#da1e28' }}>
            {validationError}
          </div>
        ) : null}

        <Select
          id="meta-indicador"
          labelText={t('indicator', 'Indicador')}
          value={selectedIndicatorId}
          onChange={(event) => setSelectedIndicatorId(event.target.value)}
          disabled={isSubmitting}
        >
          <SelectItem value="" text={t('selectIndicator', 'Seleccioná un indicador')} />
          {indicators.map((indicator) => (
            <SelectItem key={indicator.id} value={indicator.id} text={indicator.nombre} />
          ))}
        </Select>

        <Select
          id="meta-version"
          labelText={t('version', 'Versión')}
          value={selectedVersionId}
          onChange={(event) => setSelectedVersionId(event.target.value)}
          disabled={!selectedIndicatorId || isSubmitting}
        >
          <SelectItem value="" text={t('selectVersion', 'Seleccioná una versión')} />
          {versiones.map((version) => (
            <SelectItem key={version.id} value={version.id} text={String(version.version)} />
          ))}
        </Select>

        <NumberInput
          id="meta-anio"
          label={t('year', 'Año')}
          min={MIN_YEAR}
          max={MAX_YEAR}
          value={anio}
          onChange={(_event, { value }) => {
            setAnio(typeof value === 'number' ? value : value === '' ? '' : Number(value));
          }}
          disabled={isSubmitting}
          allowEmpty
        />

        <NumberInput
          id="meta-valor"
          label={t('targetValue', 'Valor de la meta')}
          min={0}
          value={valorMeta}
          onChange={(_event, { value }) => {
            setValorMeta(typeof value === 'number' ? value : value === '' ? '' : Number(value));
          }}
          disabled={isSubmitting}
          allowEmpty
        />
      </div>
    </Modal>
  );
};

export default MetaFormModal;

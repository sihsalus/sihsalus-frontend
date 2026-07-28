import { ComboBox, InlineLoading, InlineNotification, Modal, NumberInput, Select, SelectItem } from '@carbon/react';
import { getUserFacingErrorMessage } from '@openmrs/esm-framework';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { Indicador, IndicadorMeta, IndicadorMetaCreatePayload, IndicadorVersion } from '../api/types';
import { indicatorsErrorMessageOptions } from '../features/indicadores/error-handling';
import { useIndicador, useIndicadores } from '../features/indicadores/hooks';
import styles from '../indicators-dashboard.module.scss';

interface MetaFormModalProps {
  isOpen: boolean;
  initialMeta?: IndicadorMeta | null;
  initialIndicatorId?: string;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (payload: IndicadorMetaCreatePayload, indicatorId: string) => Promise<void>;
}

const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

const MetaFormModal: React.FC<MetaFormModalProps> = ({
  isOpen,
  initialMeta,
  initialIndicatorId,
  isSubmitting,
  onClose,
  onSubmit,
}) => {
  const { t } = useTranslation();
  const { data: indicadoresData } = useIndicadores(1, 100);
  const indicators = indicadoresData?.items ?? [];

  const initialIndicator = useMemo(
    () => indicators.find((indicator) => indicator.id === initialIndicatorId),
    [indicators, initialIndicatorId],
  );

  const [selectedIndicator, setSelectedIndicator] = useState<Indicador | null>(initialIndicator ?? null);
  const [selectedVersionId, setSelectedVersionId] = useState<string>(initialMeta?.indicador_version_id ?? '');
  const [anio, setAnio] = useState<number | ''>(initialMeta?.anio ?? '');
  const [valorMeta, setValorMeta] = useState<number | ''>(initialMeta?.valor_meta ?? '');
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const initializationKeyRef = useRef<string | null>(null);
  const initialIndicatorHydrationKeyRef = useRef<string | null>(null);
  const submitLockRef = useRef(false);
  const {
    data: selectedIndicatorDetail,
    isLoading: versionsLoading,
    error: versionsError,
  } = useIndicador(selectedIndicator?.id ?? '');

  useEffect(() => {
    if (!isOpen) {
      initializationKeyRef.current = null;
      return;
    }

    const initializationKey = `${initialMeta?.id ?? 'new'}:${initialIndicatorId ?? ''}`;
    if (initializationKeyRef.current === initializationKey) {
      return;
    }

    initializationKeyRef.current = initializationKey;
    initialIndicatorHydrationKeyRef.current = initialIndicatorId ? null : initializationKey;
    setSelectedIndicator(null);
    setSelectedVersionId(initialMeta?.indicador_version_id ?? '');
    setAnio(initialMeta?.anio ?? '');
    setValorMeta(initialMeta?.valor_meta ?? '');
    setValidationMessage(null);
  }, [
    initialIndicatorId,
    initialMeta?.anio,
    initialMeta?.id,
    initialMeta?.indicador_version_id,
    initialMeta?.valor_meta,
    isOpen,
  ]);

  useEffect(() => {
    if (!isOpen || !initialIndicator) {
      return;
    }

    const initializationKey = `${initialMeta?.id ?? 'new'}:${initialIndicatorId ?? ''}`;
    if (initialIndicatorHydrationKeyRef.current === initializationKey) {
      return;
    }

    initialIndicatorHydrationKeyRef.current = initializationKey;
    setSelectedIndicator(initialIndicator);
  }, [initialIndicator, initialIndicatorId, initialMeta?.id, isOpen]);

  const latestVersion = useMemo(
    () =>
      selectedIndicatorDetail?.versiones.reduce(
        (latest, version) => (!latest || version.version > latest.version ? version : latest),
        undefined as IndicadorVersion | undefined,
      ),
    [selectedIndicatorDetail],
  );
  const versionOptions = initialMeta
    ? [{ id: initialMeta.indicador_version_id, version: initialMeta.version_numero }]
    : latestVersion
      ? [{ id: latestVersion.id, version: latestVersion.version }]
      : [];

  useEffect(() => {
    if (!selectedIndicator) {
      setSelectedVersionId('');
      return;
    }
    if (!selectedIndicatorDetail) {
      return;
    }
    setSelectedVersionId(initialMeta?.indicador_version_id ?? latestVersion?.id ?? '');
  }, [initialMeta?.indicador_version_id, latestVersion, selectedIndicator, selectedIndicatorDetail]);

  const validate = (): string | null => {
    if (!selectedIndicator) {
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
    if (valorMeta === '' || !Number.isFinite(valorMeta) || Number(valorMeta) < 0) {
      return t('metaValidationValue', 'La meta no puede ser negativa.');
    }
    return null;
  };

  const handleSubmit = async () => {
    if (isSubmitting || submitLockRef.current) {
      return;
    }

    setValidationMessage(null);
    const error = validate();
    if (error) {
      setValidationMessage(error);
      return;
    }
    if (!selectedIndicator) {
      return;
    }
    submitLockRef.current = true;
    try {
      await onSubmit(
        {
          indicador_version_id: selectedVersionId,
          anio: Number(anio),
          valor_meta: Number(valorMeta),
        },
        selectedIndicator.id,
      );
    } finally {
      submitLockRef.current = false;
    }
  };

  const primaryButton = isSubmitting ? <span>{t('saving', 'Guardando...')}</span> : t('save', 'Guardar');

  return (
    <Modal
      open={isOpen}
      modalHeading={initialMeta ? t('editMeta', 'Editar meta') : t('newMeta', 'Nueva meta')}
      primaryButtonText={primaryButton}
      primaryButtonDisabled={isSubmitting || versionsLoading || Boolean(versionsError)}
      secondaryButtonText={t('cancel', 'Cancelar')}
      onRequestClose={onClose}
      onRequestSubmit={handleSubmit}
    >
      <div className={styles.modalBody}>
        {validationMessage ? (
          <div role="alert" className={styles.validationError}>
            {validationMessage}
          </div>
        ) : null}
        {versionsError ? (
          <InlineNotification
            kind="error"
            title={t('versionsLoadFailed', 'No se pudieron cargar las versiones')}
            subtitle={getUserFacingErrorMessage(
              versionsError,
              t('retryLater', 'Intentá nuevamente.'),
              indicatorsErrorMessageOptions,
            )}
            lowContrast
            hideCloseButton
          />
        ) : null}

        <ComboBox
          id="meta-indicador"
          titleText={t('indicator', 'Indicador')}
          items={indicators}
          itemToString={(item?: Indicador) => item?.nombre ?? ''}
          selectedItem={selectedIndicator}
          onChange={(data: { selectedItem: Indicador | null | undefined }) => {
            setSelectedIndicator(data.selectedItem ?? null);
            setSelectedVersionId('');
          }}
          placeholder={t('selectIndicator', 'Seleccioná un indicador')}
          disabled={Boolean(initialMeta) || isSubmitting}
        />

        {versionsLoading ? <InlineLoading description={t('loadingVersions', 'Cargando versiones...')} /> : null}

        <Select
          id="meta-version"
          labelText={initialMeta ? t('metaVersion', 'Versión de la meta') : t('currentVersion', 'Versión vigente')}
          value={selectedVersionId}
          onChange={(event) => setSelectedVersionId(event.target.value)}
          disabled
        >
          <SelectItem value="" text={t('selectVersion', 'Seleccioná una versión')} />
          {versionOptions.map((version) => (
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
          disabled={Boolean(initialMeta) || isSubmitting}
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

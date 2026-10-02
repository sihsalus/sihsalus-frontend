import { Button, Select, SelectItem, TextArea, TextInput, Tile } from '@carbon/react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type {
  DefinicionIndicadorForm,
  IndicadorFormValues,
  IndicadorUpdatePayload,
  Sexo,
  TipoDiagnostico,
} from '../api/types';
import styles from '../indicators-dashboard.module.scss';
import DiagnosticoSearchSelector from './DiagnosticoSearchSelector';
import EncounterTypeSearchSelector from './EncounterTypeSearchSelector';
import LocationSearchSelector from './LocationSearchSelector';
import OrdenSearchSelector from './OrdenSearchSelector';

type FormMode = 'create' | 'edit' | 'version';

interface IndicadorFormProps {
  mode: FormMode;
  defaultValues?: Partial<IndicadorFormValues>;
  initialMetadata?: Pick<IndicadorUpdatePayload, 'nombre' | 'descripcion'>;
  isSubmitting?: boolean;
  serverError?: string | null;
  onSubmit: (payload: {
    metadata: IndicadorUpdatePayload;
    definicion?: DefinicionIndicadorForm;
  }) => Promise<void> | void;
}

const defaultValues: IndicadorFormValues = {
  nombre: '',
  descripcion: '',
  tipo: 'conteo_atenciones',
  selectedLocations: [],
  minimoOcurrencias: '1',
  filtroClinico: 'ninguno',
  selectedDiagnosticos: [],
  diagnosticoTipo: '',
  selectedOrdenes: [],
  selectedEncounterTypes: [],
  sexo: '',
  minAnios: '',
  minMeses: '',
  minDias: '',
  maxAnios: '',
  maxMeses: '',
  maxDias: '',
};

function parseNumber(value: string) {
  if (!value.trim()) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

// Normalizes an age bound (expressed in a single unit — validated upstream)
// to days so min and max can be compared even when they use different units.
// Approximations (365 days/year, 30 days/month) are intentional: this is a UX
// guard, not a calendar-precision calculation — the backend owns the real
// boundary semantics.
const DAYS_PER_YEAR = 365;
const DAYS_PER_MONTH = 30;

function ageToDays(anios: string, meses: string, dias: string): number | undefined {
  const years = parseNumber(anios);
  const months = parseNumber(meses);
  const days = parseNumber(dias);
  if (years !== undefined) {
    return years * DAYS_PER_YEAR;
  }
  if (months !== undefined) {
    return months * DAYS_PER_MONTH;
  }
  if (days !== undefined) {
    return days;
  }
  return undefined;
}

function buildDefinicion(values: IndicadorFormValues): DefinicionIndicadorForm {
  const locationUuids = values.selectedLocations.map((item) => item.uuid);
  const diagnosticoUuids = values.selectedDiagnosticos.map((item) => item.uuid);
  const ordenUuids = values.selectedOrdenes.map((item) => item.uuid);
  const encounterTypeUuids = values.selectedEncounterTypes.map((item) => item.uuid);
  const minimoOcurrencias = parseNumber(values.minimoOcurrencias);
  const diagnosticos =
    values.filtroClinico === 'diagnosticos' && diagnosticoUuids.length
      ? [
          {
            concepto_uuids: diagnosticoUuids,
            tipo_diagnostico: (values.diagnosticoTipo || undefined) as TipoDiagnostico | undefined,
          },
        ]
      : undefined;
  const ordenes =
    values.filtroClinico === 'ordenes' && ordenUuids.length
      ? ordenUuids.map((concepto_uuid) => ({ concepto_uuid }))
      : undefined;
  const hasEvento =
    locationUuids.length > 0 ||
    encounterTypeUuids.length > 0 ||
    Boolean(diagnosticos?.length) ||
    Boolean(ordenes?.length) ||
    (minimoOcurrencias !== undefined && minimoOcurrencias !== 1);

  const evento = hasEvento
    ? {
        location_uuids: locationUuids.length ? locationUuids : undefined,
        minimo_ocurrencias: minimoOcurrencias !== 1 ? minimoOcurrencias : undefined,
        encounter_type_uuids: encounterTypeUuids.length ? encounterTypeUuids : undefined,
        diagnosticos,
        ordenes,
      }
    : undefined;

  const poblacion = {
    min_anios: parseNumber(values.minAnios),
    min_meses: parseNumber(values.minMeses),
    min_dias: parseNumber(values.minDias),
    max_anios_excl: parseNumber(values.maxAnios),
    max_meses_excl: parseNumber(values.maxMeses),
    max_dias: parseNumber(values.maxDias),
    sexo: (values.sexo || undefined) as Sexo | undefined,
  };

  const hasPoblacion = Object.values(poblacion).some((value) => value !== undefined);

  return {
    tipo: values.tipo,
    ...(evento ? { evento } : {}),
    ...(hasPoblacion ? { poblacion } : {}),
  };
}

const IndicadorForm: React.FC<IndicadorFormProps> = ({
  mode,
  defaultValues: initialValues,
  initialMetadata,
  isSubmitting,
  serverError,
  onSubmit,
}) => {
  const { t } = useTranslation();
  const [values, setValues] = useState<IndicadorFormValues>({
    ...defaultValues,
    ...initialValues,
    nombre: initialMetadata?.nombre ?? initialValues?.nombre ?? '',
    descripcion: initialMetadata?.descripcion ?? initialValues?.descripcion ?? '',
  });
  const [validationError, setValidationError] = useState<string | null>(null);

  const isEditMode = mode === 'edit';
  const isVersionMode = mode === 'version';

  const helperText = useMemo(() => {
    if (isEditMode) {
      return t(
        'editModeHelperText',
        'En edición solo se modifica nombre y descripción. Para cambiar la definición, crea una nueva versión.',
      );
    }

    return t(
      'createModeHelperText',
      'Use los buscadores para agregar servicios, diagnósticos y órdenes sin escribir UUIDs manualmente.',
    );
  }, [isEditMode, t]);

  const updateField = <K extends keyof IndicadorFormValues>(field: K, nextValue: IndicadorFormValues[K]) => {
    setValues((current) => ({ ...current, [field]: nextValue }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setValidationError(null);

    if (!values.nombre.trim() && !isVersionMode) {
      setValidationError(t('nameRequired', 'El nombre es obligatorio.'));
      return;
    }

    if (values.filtroClinico === 'diagnosticos' && !values.selectedDiagnosticos.length) {
      setValidationError(t('diagnosisFilterRequired', 'Ingrese al menos un diagnóstico para ese filtro clínico.'));
      return;
    }

    if (values.filtroClinico === 'ordenes' && !values.selectedOrdenes.length) {
      setValidationError(t('orderFilterRequired', 'Ingrese al menos una orden para ese filtro clínico.'));
      return;
    }

    if (values.tipo === 'conteo_pacientes_ventana' && !values.selectedEncounterTypes.length) {
      setValidationError(
        t('encounterTypesRequired', 'Ingrese al menos un tipo de encuentro para el conteo en ventana.'),
      );
      return;
    }

    const minimoOcurrencias = parseNumber(values.minimoOcurrencias);
    if (
      values.minimoOcurrencias.trim() &&
      (minimoOcurrencias === undefined || !Number.isInteger(minimoOcurrencias) || minimoOcurrencias < 1)
    ) {
      setValidationError(
        t('minOccurrencesInvalid', 'El mínimo de ocurrencias debe ser un número entero mayor o igual a 1.'),
      );
      return;
    }

    const minimumAgeValues = [values.minDias, values.minMeses, values.minAnios].filter((value) => value.trim());
    if (minimumAgeValues.length > 1) {
      setValidationError(t('minAgeSingleUnit', 'Ingrese la edad mínima en una sola unidad: días, meses o años.'));
      return;
    }

    const maximumAgeValues = [values.maxDias, values.maxMeses, values.maxAnios].filter((value) => value.trim());
    if (maximumAgeValues.length > 1) {
      setValidationError(t('maxAgeSingleUnit', 'Ingrese la edad máxima en una sola unidad: días, meses o años.'));
      return;
    }

    const ageValues = [...minimumAgeValues, ...maximumAgeValues].map(parseNumber);
    if (ageValues.some((value) => value === undefined || !Number.isInteger(value) || value < 0)) {
      setValidationError(t('agesInvalid', 'Las edades deben ser números enteros mayores o iguales a 0.'));
      return;
    }

    const minDays = ageToDays(values.minAnios, values.minMeses, values.minDias);
    const maxDays = ageToDays(values.maxAnios, values.maxMeses, values.maxDias);
    if (minDays !== undefined && maxDays !== undefined && minDays > maxDays) {
      setValidationError(t('minAgeExceedsMax', 'La edad mínima no puede ser mayor que la edad máxima.'));
      return;
    }

    const metadata: IndicadorUpdatePayload = {
      nombre: (isVersionMode ? initialMetadata?.nombre : values.nombre)?.trim() ?? '',
      descripcion: (isVersionMode ? initialMetadata?.descripcion : values.descripcion)?.trim() || null,
    };

    await onSubmit({
      metadata,
      definicion: isEditMode ? undefined : buildDefinicion(values),
    });
  };

  return (
    <form onSubmit={handleSubmit} className={styles.formStack}>
      <Tile className={styles.infoTile}>{helperText}</Tile>
      {serverError ? <div className={styles.errorBanner}>{serverError}</div> : null}
      {validationError ? <div className={styles.errorBanner}>{validationError}</div> : null}

      {!isVersionMode ? (
        <section className={styles.formSectionCard}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>{t('generalInfo', 'Información general')}</h3>
            <p className={styles.sectionHint}>
              {t('generalInfoHint', 'Nombre visible y descripción operativa del indicador.')}
            </p>
          </div>
          <div className={styles.formGrid}>
            <TextInput
              id="nombre"
              labelText={t('name', 'Nombre')}
              value={values.nombre}
              onChange={(event) => updateField('nombre', event.target.value)}
              disabled={isSubmitting}
            />
            <TextArea
              id="descripcion"
              labelText={t('description', 'Descripción')}
              value={values.descripcion}
              onChange={(event) => updateField('descripcion', event.target.value)}
              disabled={isSubmitting}
            />
          </div>
        </section>
      ) : null}

      {!isEditMode ? (
        <>
          <section className={styles.formSectionCard}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>{t('type', 'Tipo')}</h3>
              <p className={styles.sectionHint}>
                {t('typeHint', 'Define qué se cuenta. Las mediciones son siempre mensuales.')}
              </p>
            </div>
            <div className={styles.formColumns}>
              <Select
                id="tipo"
                labelText={t('type', 'Tipo')}
                value={values.tipo}
                onChange={(event) => updateField('tipo', event.target.value as IndicadorFormValues['tipo'])}
              >
                <SelectItem value="conteo_atenciones" text={t('countEncounters', 'Conteo de atenciones')} />
                <SelectItem value="conteo_pacientes" text={t('countPatients', 'Conteo de pacientes')} />
                <SelectItem
                  value="conteo_pacientes_ventana"
                  text={t('countPatientsWindow', 'Conteo de pacientes en ventana etaria')}
                />
              </Select>
            </div>
          </section>

          <section className={styles.formSectionCard}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>{t('attentionSection', 'Atención')}</h3>
              <p className={styles.sectionHint}>
                {t(
                  'attentionHint',
                  'Acote el origen clínico del cálculo: servicios, frecuencia mínima y filtro clínico.',
                )}
              </p>
            </div>
            <div className={styles.formGrid}>
              <LocationSearchSelector
                selectedItems={values.selectedLocations}
                onChange={(items) => updateField('selectedLocations', items)}
              />
              <TextInput
                id="minimo-ocurrencias"
                labelText={t('minimumOccurrences', 'Mínimo de ocurrencias')}
                type="number"
                value={values.minimoOcurrencias}
                onChange={(event) => updateField('minimoOcurrencias', event.target.value)}
              />
            </div>
            <div className={styles.filterSwitches}>
              <Button
                kind={values.filtroClinico === 'ninguno' ? 'primary' : 'secondary'}
                size="sm"
                type="button"
                onClick={() => updateField('filtroClinico', 'ninguno')}
              >
                {t('noClinicalFilter', 'Sin filtro clínico')}
              </Button>
              <Button
                kind={values.filtroClinico === 'diagnosticos' ? 'primary' : 'secondary'}
                size="sm"
                type="button"
                onClick={() => updateField('filtroClinico', 'diagnosticos')}
              >
                {t('diagnostics', 'Diagnósticos')}
              </Button>
              <Button
                kind={values.filtroClinico === 'ordenes' ? 'primary' : 'secondary'}
                size="sm"
                type="button"
                onClick={() => updateField('filtroClinico', 'ordenes')}
              >
                {t('orders', 'Órdenes')}
              </Button>
            </div>
            {values.filtroClinico === 'diagnosticos' ? (
              <div className={styles.formColumns}>
                <DiagnosticoSearchSelector
                  selectedItems={values.selectedDiagnosticos}
                  onChange={(items) => updateField('selectedDiagnosticos', items)}
                />
                <Select
                  id="tipo-diagnostico"
                  labelText={t('diagnosisType', 'Tipo de diagnóstico')}
                  value={values.diagnosticoTipo}
                  onChange={(event) =>
                    updateField('diagnosticoTipo', event.target.value as IndicadorFormValues['diagnosticoTipo'])
                  }
                >
                  <SelectItem value="" text={t('unspecified', 'Sin especificar')} />
                  <SelectItem value="definitivo" text={t('definitive', 'Definitivo')} />
                  <SelectItem value="presuntivo" text={t('presumptive', 'Presuntivo')} />
                </Select>
              </div>
            ) : null}
            {values.filtroClinico === 'ordenes' ? (
              <OrdenSearchSelector
                selectedItems={values.selectedOrdenes}
                onChange={(items) => updateField('selectedOrdenes', items)}
              />
            ) : null}
            {values.tipo === 'conteo_pacientes_ventana' ? (
              <EncounterTypeSearchSelector
                selectedItems={values.selectedEncounterTypes}
                onChange={(items) => updateField('selectedEncounterTypes', items)}
              />
            ) : null}
          </section>

          <section className={styles.formSectionCard}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>{t('populationSection', 'Población')}</h3>
              <p className={styles.sectionHint}>
                {t('populationHint', 'Filtre por sexo y rango etario si el indicador lo requiere.')}
              </p>
            </div>
            <div className={styles.populationLayout}>
              <Select
                id="sexo"
                labelText={t('sex', 'Sexo')}
                value={values.sexo}
                onChange={(event) => updateField('sexo', event.target.value as IndicadorFormValues['sexo'])}
              >
                <SelectItem value="" text={t('noFilter', 'Sin filtro')} />
                <SelectItem value="F" text={t('female', 'Femenino')} />
                <SelectItem value="M" text={t('male', 'Masculino')} />
              </Select>
              <div className={styles.ageBlock}>
                <div className={styles.ageBlockHeader}>
                  <span className={styles.sectionMiniTitle}>{t('minAge', 'Edad mínima')}</span>
                  <span className={styles.mutedText}>{t('minAgeHint', 'Complete solo lo necesario.')}</span>
                </div>
                <div className={styles.ageGrid}>
                  <TextInput
                    id="min-anios"
                    labelText={t('minAgeYears', 'Edad mínima años')}
                    type="number"
                    value={values.minAnios}
                    onChange={(event) => updateField('minAnios', event.target.value)}
                  />
                  <TextInput
                    id="min-meses"
                    labelText={t('minAgeMonths', 'Edad mínima meses')}
                    type="number"
                    value={values.minMeses}
                    onChange={(event) => updateField('minMeses', event.target.value)}
                  />
                  <TextInput
                    id="min-dias"
                    labelText={t('minAgeDays', 'Edad mínima días')}
                    type="number"
                    value={values.minDias}
                    onChange={(event) => updateField('minDias', event.target.value)}
                  />
                </div>
              </div>
              <div className={styles.ageBlock}>
                <div className={styles.ageBlockHeader}>
                  <span className={styles.sectionMiniTitle}>{t('maxAge', 'Edad máxima')}</span>
                  <span className={styles.mutedText}>
                    {t('maxAgeHint', 'Se interpreta como límite superior del rango.')}
                  </span>
                </div>
                <div className={styles.ageGrid}>
                  <TextInput
                    id="max-anios"
                    labelText={t('maxAgeYears', 'Edad máxima años')}
                    type="number"
                    value={values.maxAnios}
                    onChange={(event) => updateField('maxAnios', event.target.value)}
                  />
                  <TextInput
                    id="max-meses"
                    labelText={t('maxAgeMonths', 'Edad máxima meses')}
                    type="number"
                    value={values.maxMeses}
                    onChange={(event) => updateField('maxMeses', event.target.value)}
                  />
                  <TextInput
                    id="max-dias"
                    labelText={t('maxAgeDays', 'Edad máxima días')}
                    type="number"
                    value={values.maxDias}
                    onChange={(event) => updateField('maxDias', event.target.value)}
                  />
                </div>
              </div>
            </div>
          </section>
        </>
      ) : null}

      <div className={styles.formFooter}>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? t('saving', 'Guardando...')
            : mode === 'version'
              ? t('createVersionBtn', 'Crear versión')
              : t('save', 'Guardar')}
        </Button>
      </div>
    </form>
  );
};

export default IndicadorForm;

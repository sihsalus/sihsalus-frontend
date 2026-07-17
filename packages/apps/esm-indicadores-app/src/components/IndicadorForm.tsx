import { Button, Select, SelectItem, TextArea, TextInput, Tile } from '@carbon/react';
import React, { useMemo, useState } from 'react';

import type {
  DefinicionIndicadorForm,
  IndicadorFormValues,
  IndicadorUpdatePayload,
  Sexo,
  TipoDiagnostico,
} from '../api/types';
import styles from '../indicators-dashboard.module.scss';
import DiagnosticoSearchSelector from './DiagnosticoSearchSelector';
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

function buildDefinicion(values: IndicadorFormValues): DefinicionIndicadorForm {
  const locationUuids = values.selectedLocations.map((item) => item.uuid);
  const diagnosticoUuids = values.selectedDiagnosticos.map((item) => item.uuid);
  const ordenUuids = values.selectedOrdenes.map((item) => item.uuid);
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
    Boolean(diagnosticos?.length) ||
    Boolean(ordenes?.length) ||
    (minimoOcurrencias !== undefined && minimoOcurrencias !== 1);

  const evento = hasEvento
    ? {
        location_uuids: locationUuids.length ? locationUuids : undefined,
        minimo_ocurrencias: minimoOcurrencias !== 1 ? minimoOcurrencias : undefined,
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
      return 'En edición solo se modifica nombre y descripción. Para cambiar la definición, crea una nueva versión.';
    }

    return 'Usá los buscadores para agregar servicios, diagnósticos y órdenes sin escribir UUIDs manualmente.';
  }, [isEditMode]);

  const updateField = <K extends keyof IndicadorFormValues>(field: K, nextValue: IndicadorFormValues[K]) => {
    setValues((current) => ({ ...current, [field]: nextValue }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setValidationError(null);

    if (!values.nombre.trim() && !isVersionMode) {
      setValidationError('El nombre es obligatorio.');
      return;
    }

    if (values.filtroClinico === 'diagnosticos' && !values.selectedDiagnosticos.length) {
      setValidationError('Ingresá al menos un diagnóstico para ese filtro clínico.');
      return;
    }

    if (values.filtroClinico === 'ordenes' && !values.selectedOrdenes.length) {
      setValidationError('Ingresá al menos una orden para ese filtro clínico.');
      return;
    }

    const minimoOcurrencias = parseNumber(values.minimoOcurrencias);
    if (
      values.minimoOcurrencias.trim() &&
      (minimoOcurrencias === undefined || !Number.isInteger(minimoOcurrencias) || minimoOcurrencias < 1)
    ) {
      setValidationError('El mínimo de ocurrencias debe ser un número entero mayor o igual a 1.');
      return;
    }

    const minimumAgeValues = [values.minDias, values.minMeses, values.minAnios].filter((value) => value.trim());
    if (minimumAgeValues.length > 1) {
      setValidationError('Ingresá la edad mínima en una sola unidad: días, meses o años.');
      return;
    }

    const maximumAgeValues = [values.maxDias, values.maxMeses, values.maxAnios].filter((value) => value.trim());
    if (maximumAgeValues.length > 1) {
      setValidationError('Ingresá la edad máxima en una sola unidad: días, meses o años.');
      return;
    }

    const ageValues = [...minimumAgeValues, ...maximumAgeValues].map(parseNumber);
    if (ageValues.some((value) => value === undefined || !Number.isInteger(value) || value < 0)) {
      setValidationError('Las edades deben ser números enteros mayores o iguales a 0.');
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
            <h3 className={styles.sectionTitle}>Información general</h3>
            <p className={styles.sectionHint}>Nombre visible y descripción operativa del indicador.</p>
          </div>
          <div className={styles.formGrid}>
            <TextInput
              id="nombre"
              labelText="Nombre"
              value={values.nombre}
              onChange={(event) => updateField('nombre', event.target.value)}
              disabled={isSubmitting}
            />
            <TextArea
              id="descripcion"
              labelText="Descripción"
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
              <h3 className={styles.sectionTitle}>Tipo</h3>
              <p className={styles.sectionHint}>Define qué se cuenta. Las mediciones son siempre mensuales.</p>
            </div>
            <div className={styles.formColumns}>
              <Select
                id="tipo"
                labelText="Tipo"
                value={values.tipo}
                onChange={(event) => updateField('tipo', event.target.value as IndicadorFormValues['tipo'])}
              >
                <SelectItem value="conteo_atenciones" text="Conteo de atenciones" />
                <SelectItem value="conteo_pacientes" text="Conteo de pacientes" />
              </Select>
            </div>
          </section>

          <section className={styles.formSectionCard}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>Atención</h3>
              <p className={styles.sectionHint}>
                Acotá el origen clínico del cálculo: servicios, frecuencia mínima y filtro clínico.
              </p>
            </div>
            <div className={styles.formGrid}>
              <LocationSearchSelector
                selectedItems={values.selectedLocations}
                onChange={(items) => updateField('selectedLocations', items)}
              />
              <TextInput
                id="minimo-ocurrencias"
                labelText="Mínimo de ocurrencias"
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
                Sin filtro clínico
              </Button>
              <Button
                kind={values.filtroClinico === 'diagnosticos' ? 'primary' : 'secondary'}
                size="sm"
                type="button"
                onClick={() => updateField('filtroClinico', 'diagnosticos')}
              >
                Diagnósticos
              </Button>
              <Button
                kind={values.filtroClinico === 'ordenes' ? 'primary' : 'secondary'}
                size="sm"
                type="button"
                onClick={() => updateField('filtroClinico', 'ordenes')}
              >
                Órdenes
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
                  labelText="Tipo de diagnóstico"
                  value={values.diagnosticoTipo}
                  onChange={(event) =>
                    updateField('diagnosticoTipo', event.target.value as IndicadorFormValues['diagnosticoTipo'])
                  }
                >
                  <SelectItem value="" text="Sin especificar" />
                  <SelectItem value="definitivo" text="Definitivo" />
                  <SelectItem value="presuntivo" text="Presuntivo" />
                </Select>
              </div>
            ) : null}
            {values.filtroClinico === 'ordenes' ? (
              <OrdenSearchSelector
                selectedItems={values.selectedOrdenes}
                onChange={(items) => updateField('selectedOrdenes', items)}
              />
            ) : null}
          </section>

          <section className={styles.formSectionCard}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>Población</h3>
              <p className={styles.sectionHint}>Filtrá por sexo y rango etario si el indicador lo requiere.</p>
            </div>
            <div className={styles.populationLayout}>
              <Select
                id="sexo"
                labelText="Sexo"
                value={values.sexo}
                onChange={(event) => updateField('sexo', event.target.value as IndicadorFormValues['sexo'])}
              >
                <SelectItem value="" text="Sin filtro" />
                <SelectItem value="F" text="Femenino" />
                <SelectItem value="M" text="Masculino" />
              </Select>
              <div className={styles.ageBlock}>
                <div className={styles.ageBlockHeader}>
                  <span className={styles.sectionMiniTitle}>Edad mínima</span>
                  <span className={styles.mutedText}>Completá solo lo necesario.</span>
                </div>
                <div className={styles.ageGrid}>
                  <TextInput
                    id="min-anios"
                    labelText="Edad mínima años"
                    type="number"
                    value={values.minAnios}
                    onChange={(event) => updateField('minAnios', event.target.value)}
                  />
                  <TextInput
                    id="min-meses"
                    labelText="Edad mínima meses"
                    type="number"
                    value={values.minMeses}
                    onChange={(event) => updateField('minMeses', event.target.value)}
                  />
                  <TextInput
                    id="min-dias"
                    labelText="Edad mínima días"
                    type="number"
                    value={values.minDias}
                    onChange={(event) => updateField('minDias', event.target.value)}
                  />
                </div>
              </div>
              <div className={styles.ageBlock}>
                <div className={styles.ageBlockHeader}>
                  <span className={styles.sectionMiniTitle}>Edad máxima</span>
                  <span className={styles.mutedText}>Se interpreta como límite superior del rango.</span>
                </div>
                <div className={styles.ageGrid}>
                  <TextInput
                    id="max-anios"
                    labelText="Edad máxima años"
                    type="number"
                    value={values.maxAnios}
                    onChange={(event) => updateField('maxAnios', event.target.value)}
                  />
                  <TextInput
                    id="max-meses"
                    labelText="Edad máxima meses"
                    type="number"
                    value={values.maxMeses}
                    onChange={(event) => updateField('maxMeses', event.target.value)}
                  />
                  <TextInput
                    id="max-dias"
                    labelText="Edad máxima días"
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
          {isSubmitting ? 'Guardando...' : mode === 'version' ? 'Crear versión' : 'Guardar'}
        </Button>
      </div>
    </form>
  );
};

export default IndicadorForm;

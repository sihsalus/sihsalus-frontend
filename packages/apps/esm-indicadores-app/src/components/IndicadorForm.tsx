import { Button, Select, SelectItem, TextArea, TextInput, Tile } from '@carbon/react';
import React, { useMemo, useState } from 'react';

import type { DefinicionIndicadorForm, IndicadorFormValues, IndicadorUpdatePayload, Sexo, TipoDiagnostico } from '../api/types';
import styles from '../indicators-dashboard.module.scss';

type FormMode = 'create' | 'edit' | 'version';

interface IndicadorFormProps {
  mode: FormMode;
  defaultValues?: Partial<IndicadorFormValues>;
  initialMetadata?: Pick<IndicadorUpdatePayload, 'nombre' | 'descripcion'>;
  isSubmitting?: boolean;
  serverError?: string | null;
  onSubmit: (payload: { metadata: IndicadorUpdatePayload; definicion?: DefinicionIndicadorForm }) => Promise<void> | void;
}

const defaultValues: IndicadorFormValues = {
  nombre: '',
  descripcion: '',
  tipo: 'conteo_atenciones',
  periodo: 'mes_actual',
  locationUuids: '',
  minimoOcurrencias: '1',
  filtroClinico: 'ninguno',
  diagnosticoUuids: '',
  diagnosticoTipo: '',
  ordenUuids: '',
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

function parseCsv(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildDefinicion(values: IndicadorFormValues): DefinicionIndicadorForm {
  const locationUuids = parseCsv(values.locationUuids);
  const diagnosticoUuids = parseCsv(values.diagnosticoUuids);
  const ordenUuids = parseCsv(values.ordenUuids);

  const evento =
    locationUuids.length || diagnosticoUuids.length || ordenUuids.length || values.minimoOcurrencias
      ? {
          location_uuids: locationUuids,
          minimo_ocurrencias: parseNumber(values.minimoOcurrencias) ?? 1,
          diagnosticos:
            values.filtroClinico === 'diagnosticos' && diagnosticoUuids.length
              ? [{ concepto_uuids: diagnosticoUuids, tipo_diagnostico: (values.diagnosticoTipo || undefined) as TipoDiagnostico | undefined }]
              : undefined,
          ordenes: values.filtroClinico === 'ordenes' && ordenUuids.length ? [{ concepto_uuids: ordenUuids }] : undefined,
        }
      : null;

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
    periodo: values.periodo,
    evento,
    poblacion: hasPoblacion ? poblacion : undefined,
  };
}

const IndicadorForm: React.FC<IndicadorFormProps> = ({ mode, defaultValues: initialValues, initialMetadata, isSubmitting, serverError, onSubmit }) => {
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

    return 'Usá IDs o UUIDs separados por coma para locations, diagnósticos y órdenes.';
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

    if (values.filtroClinico === 'diagnosticos' && !parseCsv(values.diagnosticoUuids).length) {
      setValidationError('Ingresá al menos un diagnóstico para ese filtro clínico.');
      return;
    }

    if (values.filtroClinico === 'ordenes' && !parseCsv(values.ordenUuids).length) {
      setValidationError('Ingresá al menos una orden para ese filtro clínico.');
      return;
    }

    const metadata = {
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
            <TextInput id="nombre" labelText="Nombre" value={values.nombre} onChange={(event) => updateField('nombre', event.target.value)} disabled={isSubmitting} />
            <TextArea id="descripcion" labelText="Descripción" value={values.descripcion} onChange={(event) => updateField('descripcion', event.target.value)} disabled={isSubmitting} />
          </div>
        </section>
      ) : null}

      {!isEditMode ? (
        <>
          <section className={styles.formSectionCard}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>Tipo y periodo</h3>
              <p className={styles.sectionHint}>Define qué se cuenta y la ventana temporal principal.</p>
            </div>
            <div className={styles.formColumns}>
              <Select id="tipo" labelText="Tipo" value={values.tipo} onChange={(event) => updateField('tipo', event.target.value as IndicadorFormValues['tipo'])}>
                <SelectItem value="conteo_atenciones" text="Conteo de atenciones" />
                <SelectItem value="conteo_pacientes" text="Conteo de pacientes" />
              </Select>
              <Select id="periodo" labelText="Periodo" value={values.periodo} onChange={(event) => updateField('periodo', event.target.value as IndicadorFormValues['periodo'])}>
                <SelectItem value="mes_actual" text="Mes actual" />
                <SelectItem value="trimestre_actual" text="Trimestre actual" />
                <SelectItem value="semestre_actual" text="Semestre actual" />
                <SelectItem value="anual_actual" text="Año actual" />
              </Select>
            </div>
          </section>

          <section className={styles.formSectionCard}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>Atención</h3>
              <p className={styles.sectionHint}>Acotá el origen clínico del cálculo: servicios, frecuencia mínima y filtro clínico.</p>
            </div>
            <div className={styles.formGrid}>
              <TextInput id="locations" labelText="Locations / servicios" value={values.locationUuids} onChange={(event) => updateField('locationUuids', event.target.value)} helperText="Ejemplo: loc-consulta, loc-materno" />
              <TextInput id="minimo-ocurrencias" labelText="Mínimo de ocurrencias" type="number" value={values.minimoOcurrencias} onChange={(event) => updateField('minimoOcurrencias', event.target.value)} />
            </div>
            <div className={styles.filterSwitches}>
              <Button kind={values.filtroClinico === 'ninguno' ? 'primary' : 'secondary'} size="sm" type="button" onClick={() => updateField('filtroClinico', 'ninguno')}>
                Sin filtro clínico
              </Button>
              <Button kind={values.filtroClinico === 'diagnosticos' ? 'primary' : 'secondary'} size="sm" type="button" onClick={() => updateField('filtroClinico', 'diagnosticos')}>
                Diagnósticos
              </Button>
              <Button kind={values.filtroClinico === 'ordenes' ? 'primary' : 'secondary'} size="sm" type="button" onClick={() => updateField('filtroClinico', 'ordenes')}>
                Órdenes
              </Button>
            </div>
            {values.filtroClinico === 'diagnosticos' ? (
              <div className={styles.formColumns}>
                <TextInput id="diagnosticos" labelText="Diagnósticos" value={values.diagnosticoUuids} onChange={(event) => updateField('diagnosticoUuids', event.target.value)} helperText="Separá por coma los UUIDs o códigos internos." />
                <Select id="tipo-diagnostico" labelText="Tipo de diagnóstico" value={values.diagnosticoTipo} onChange={(event) => updateField('diagnosticoTipo', event.target.value as IndicadorFormValues['diagnosticoTipo'])}>
                  <SelectItem value="" text="Sin especificar" />
                  <SelectItem value="definitivo" text="Definitivo" />
                  <SelectItem value="presuntivo" text="Presuntivo" />
                </Select>
              </div>
            ) : null}
            {values.filtroClinico === 'ordenes' ? (
              <TextInput id="ordenes" labelText="Órdenes" value={values.ordenUuids} onChange={(event) => updateField('ordenUuids', event.target.value)} helperText="Separá por coma las órdenes o conceptos esperados." />
            ) : null}
          </section>

          <section className={styles.formSectionCard}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>Población</h3>
              <p className={styles.sectionHint}>Filtrá por sexo y rango etario si el indicador lo requiere.</p>
            </div>
            <div className={styles.populationLayout}>
              <Select id="sexo" labelText="Sexo" value={values.sexo} onChange={(event) => updateField('sexo', event.target.value as IndicadorFormValues['sexo'])}>
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
                <TextInput id="min-anios" labelText="Edad mínima años" type="number" value={values.minAnios} onChange={(event) => updateField('minAnios', event.target.value)} />
                <TextInput id="min-meses" labelText="Edad mínima meses" type="number" value={values.minMeses} onChange={(event) => updateField('minMeses', event.target.value)} />
                <TextInput id="min-dias" labelText="Edad mínima días" type="number" value={values.minDias} onChange={(event) => updateField('minDias', event.target.value)} />
                </div>
              </div>
              <div className={styles.ageBlock}>
                <div className={styles.ageBlockHeader}>
                  <span className={styles.sectionMiniTitle}>Edad máxima</span>
                  <span className={styles.mutedText}>Se interpreta como límite superior del rango.</span>
                </div>
                <div className={styles.ageGrid}>
                <TextInput id="max-anios" labelText="Edad máxima años" type="number" value={values.maxAnios} onChange={(event) => updateField('maxAnios', event.target.value)} />
                <TextInput id="max-meses" labelText="Edad máxima meses" type="number" value={values.maxMeses} onChange={(event) => updateField('maxMeses', event.target.value)} />
                <TextInput id="max-dias" labelText="Edad máxima días" type="number" value={values.maxDias} onChange={(event) => updateField('maxDias', event.target.value)} />
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

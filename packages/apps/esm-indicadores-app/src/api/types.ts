export type TipoIndicador = 'conteo_atenciones' | 'conteo_pacientes';
export type TipoDiagnostico = 'definitivo' | 'presuntivo';
export type Sexo = 'M' | 'F';

/**
 * Granularity for time-series rollup queries.
 */
export type Granularity = 'mensual' | 'trimestral' | 'semestral' | 'anual';

export interface PaginatedResponse<T> {
  items: Array<T>;
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface Indicador {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  creado_en: string;
}

export interface FiltroDiagnosticoForm {
  concepto_uuids: Array<string>;
  tipo_diagnostico?: TipoDiagnostico;
}

export interface FiltroOrdenForm {
  concepto_uuids: Array<string>;
}

export interface FiltrosEventoForm {
  location_uuids: Array<string>;
  minimo_ocurrencias?: number;
  diagnosticos?: Array<FiltroDiagnosticoForm>;
  ordenes?: Array<FiltroOrdenForm>;
}

export interface PoblacionForm {
  min_anios?: number;
  max_anios_excl?: number;
  min_meses?: number;
  max_meses_excl?: number;
  min_dias?: number;
  max_dias?: number;
  sexo?: Sexo;
}

export interface DefinicionIndicadorForm {
  tipo: TipoIndicador;
  evento: FiltrosEventoForm | null;
  poblacion?: PoblacionForm;
}

export interface IndicadorVersion {
  id: string;
  indicador_id: string;
  version: number;
  definicion: DefinicionIndicadorForm;
  creado_en: string;
}

export interface IndicadorDetail extends Indicador {
  versiones: Array<IndicadorVersion>;
}

export interface IndicadorCreatePayload {
  nombre: string;
  descripcion: string | null;
  definicion: DefinicionIndicadorForm;
}

export interface IndicadorUpdatePayload {
  nombre: string;
  descripcion: string | null;
  activo?: boolean;
}

export interface EncounterTypeOption {
  uuid: string;
  display: string;
}

export interface LocationOption {
  uuid: string;
  display: string;
}

export interface DiagnosticoOption {
  uuid: string;
  codigo?: string;
  nombre: string;
}

export interface OrdenOption {
  uuid: string;
  display: string;
}

export interface IndicadorResultado {
  id: string;
  indicador_version_id: string;
  indicador_nombre: string | null;
  indicador_version_num: number | null;
  periodo_inicio: string;
  periodo_fin: string;
  valor: number;
  calculado_en: string;
  mes_referencia?: string | null;
  es_canonico?: boolean;
}

export interface SerieRow {
  periodo_label: string;
  valor: number;
  meses_disponibles: number;
  anio: number;
  mes_referencia?: string;
  trimestre?: number;
  semestre?: number;
  meta?: number | null;
}

export interface SeriesResponse {
  items: Array<SerieRow>;
  indicador_id: string;
  anio: number;
  granularity: Granularity;
}

export interface GetSeriesParams {
  indicador_id: string;
  anio?: number;
  granularity?: Granularity;
  include_meta?: boolean;
}

export interface IndicadorMeta {
  id: string;
  indicador_version_id: string;
  anio: number;
  valor_meta: number;
  creado_en: string;
  indicador_nombre: string;
  version_numero: number;
}

export interface IndicadorMetaCreatePayload {
  indicador_version_id: string;
  anio: number;
  valor_meta: number;
}

export interface ErrorCalculo {
  indicador_id: string;
  indicador_nombre: string;
  error: string;
}

export interface BatchCalcularNowResponse {
  calculados: number;
  errores: Array<ErrorCalculo>;
  total: number;
}

export interface ErrorRecalculo {
  indicador_id: string;
  indicador_nombre: string;
  mes: string;
  error: string;
}

export interface RecalcularAnioParams {
  anio: number;
  indicador_id?: string;
}

export interface RecalcularAnioResponse {
  anio: number;
  indicador_id: string | null;
  meses_procesados: number;
  indicadores_considerados: number;
  recalculados: number;
  errores: Array<ErrorRecalculo>;
  total: number;
}

export interface ResultadosFilters {
  indicador_id?: string;
  periodo_inicio?: string;
  periodo_fin?: string;
}

export interface GetResultadosParams extends ResultadosFilters {
  page: number;
  size: number;
}

export interface IndicadorSQLPreview {
  sql: string;
  params: Record<string, unknown>;
  periodo_inicio: string;
  periodo_fin: string;
  version_id: string;
  version_num: number;
}

export interface IndicadorFormValues {
  nombre: string;
  descripcion: string;
  tipo: TipoIndicador;
  selectedLocations: Array<LocationOption>;
  minimoOcurrencias: string;
  filtroClinico: 'ninguno' | 'diagnosticos' | 'ordenes';
  selectedDiagnosticos: Array<DiagnosticoOption>;
  diagnosticoTipo: TipoDiagnostico | '';
  selectedOrdenes: Array<OrdenOption>;
  sexo: '' | Sexo;
  minAnios: string;
  minMeses: string;
  minDias: string;
  maxAnios: string;
  maxMeses: string;
  maxDias: string;
}

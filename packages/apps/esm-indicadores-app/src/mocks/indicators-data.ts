import type {
  BatchCalcularNowResponse,
  DefinicionIndicadorForm,
  DiagnosticoOption,
  GetResultadosParams,
  GetSeriesParams,
  Indicador,
  IndicadorCreatePayload,
  IndicadorDetail,
  IndicadorMeta,
  IndicadorMetaCreatePayload,
  IndicadorResultado,
  IndicadorSQLPreview,
  IndicadorUpdatePayload,
  IndicadorVersion,
  LocationOption,
  OrdenOption,
  PaginatedResponse,
  RecalcularAnioParams,
  RecalcularAnioResponse,
  SerieRow,
  SeriesResponse,
} from '../api/types';

const nowIso = () => new Date().toISOString();
const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

const mockLocations: Array<LocationOption> = [
  { uuid: 'loc-materno', display: 'Centro Obstétrico' },
  { uuid: 'loc-consulta', display: 'Consulta Externa' },
  { uuid: 'loc-odontologia', display: 'Odontología' },
];

const mockDiagnosticos: Array<DiagnosticoOption> = [
  { uuid: 'diag-anemia', codigo: 'D50.9', nombre: 'Anemia ferropénica' },
  { uuid: 'diag-gestante', codigo: 'Z34.9', nombre: 'Supervisión de embarazo' },
  { uuid: 'diag-caries', codigo: 'K02.9', nombre: 'Caries dental' },
];

const mockOrdenes: Array<OrdenOption> = [
  { uuid: 'ord-hemograma', display: 'Hemograma' },
  { uuid: 'ord-ferritina', display: 'Ferritina sérica' },
  { uuid: 'ord-fluor', display: 'Aplicación de flúor' },
];

const definicionPrenatal: DefinicionIndicadorForm = {
  tipo: 'conteo_atenciones',
  evento: {
    location_uuids: ['loc-materno'],
    minimo_ocurrencias: 1,
    diagnosticos: [{ concepto_uuids: ['diag-gestante'], tipo_diagnostico: 'definitivo' }],
  },
  poblacion: { sexo: 'F', min_anios: 10, max_anios_excl: 50 },
};

const definicionAnemia: DefinicionIndicadorForm = {
  tipo: 'conteo_pacientes',
  evento: {
    location_uuids: ['loc-consulta'],
    minimo_ocurrencias: 1,
    diagnosticos: [{ concepto_uuids: ['diag-anemia'], tipo_diagnostico: 'definitivo' }],
  },
  poblacion: { min_meses: 6, max_anios_excl: 6 },
};

const definicionOdonto: DefinicionIndicadorForm = {
  tipo: 'conteo_atenciones',
  evento: {
    location_uuids: ['loc-odontologia'],
    minimo_ocurrencias: 1,
    ordenes: [{ concepto_uuids: ['ord-fluor'] }],
  },
};

let indicadores: Array<IndicadorDetail> = [
  {
    id: 'ind-001',
    nombre: 'Atenciones de control prenatal',
    descripcion: 'Gestantes atendidas con control prenatal en el periodo.',
    activo: true,
    creado_en: '2026-01-15T10:00:00.000Z',
    versiones: [
      {
        id: 'ver-001-1',
        indicador_id: 'ind-001',
        version: 1,
        definicion: definicionPrenatal,
        creado_en: '2026-01-15T10:00:00.000Z',
      },
    ],
  },
  {
    id: 'ind-002',
    nombre: 'Pacientes con diagnóstico de anemia',
    descripcion: 'Pacientes únicos con diagnóstico definitivo de anemia.',
    activo: true,
    creado_en: '2026-02-03T09:30:00.000Z',
    versiones: [
      {
        id: 'ver-002-1',
        indicador_id: 'ind-002',
        version: 1,
        definicion: definicionAnemia,
        creado_en: '2026-02-03T09:30:00.000Z',
      },
    ],
  },
  {
    id: 'ind-003',
    nombre: 'Atenciones odontológicas preventivas',
    descripcion: 'Indicador de seguimiento para profilaxis y flúor.',
    activo: false,
    creado_en: '2026-03-20T14:45:00.000Z',
    versiones: [
      {
        id: 'ver-003-1',
        indicador_id: 'ind-003',
        version: 1,
        definicion: definicionOdonto,
        creado_en: '2026-03-20T14:45:00.000Z',
      },
    ],
  },
];

let resultados: Array<IndicadorResultado> = [
  {
    id: uid('res'),
    indicador_version_id: 'ver-001-1',
    indicador_nombre: 'Atenciones de control prenatal',
    indicador_version_num: 1,
    periodo_inicio: '2026-04-01',
    periodo_fin: '2026-04-30',
    valor: 312,
    calculado_en: '2026-05-01T02:00:00.000Z',
    mes_referencia: '2026-04-01',
    es_canonico: true,
  },
  {
    id: uid('res'),
    indicador_version_id: 'ver-002-1',
    indicador_nombre: 'Pacientes con diagnóstico de anemia',
    indicador_version_num: 1,
    periodo_inicio: '2026-01-01',
    periodo_fin: '2026-03-31',
    valor: 154,
    calculado_en: '2026-04-01T02:00:00.000Z',
    mes_referencia: '2026-01-01',
    es_canonico: true,
  },
];

let metas: Array<IndicadorMeta> = [];

export function getAllMetasMock(): Array<IndicadorMeta> {
  return metas;
}

export function getMetaMock(indicador_version_id: string, anio: number): IndicadorMeta {
  const meta = metas.find((item) => item.indicador_version_id === indicador_version_id && item.anio === anio);
  if (!meta) {
    throw new Error('Meta no encontrada');
  }
  return meta;
}

export function upsertMetaMock(payload: IndicadorMetaCreatePayload): IndicadorMeta {
  const existingIndex = metas.findIndex(
    (item) => item.indicador_version_id === payload.indicador_version_id && item.anio === payload.anio,
  );

  if (existingIndex >= 0) {
    const updated: IndicadorMeta = { ...metas[existingIndex], valor_meta: payload.valor_meta };
    metas = [...metas.slice(0, existingIndex), updated, ...metas.slice(existingIndex + 1)];
    return updated;
  }

  const created: IndicadorMeta = {
    id: uid('meta'),
    ...payload,
    creado_en: nowIso(),
    indicador_nombre: '',
    version_numero: 0,
  };
  metas = [created, ...metas];
  return created;
}

export function deleteMetaMock(indicador_version_id: string, anio: number) {
  metas = metas.filter((item) => !(item.indicador_version_id === indicador_version_id && item.anio === anio));
}

export function resetMetasMock() {
  metas = [];
}

function toPaginatedResponse<T>(items: Array<T>, page: number, size: number): PaginatedResponse<T> {
  const start = (page - 1) * size;
  const pagedItems = items.slice(start, start + size);
  return {
    items: pagedItems,
    total: items.length,
    page,
    size,
    pages: Math.max(1, Math.ceil(items.length / size)),
  };
}

function latestVersion(indicador: IndicadorDetail) {
  return indicador.versiones.reduce(
    (max, current) => (current.version > max.version ? current : max),
    indicador.versiones[0],
  );
}

function definitionToSql(definicion: DefinicionIndicadorForm) {
  const selectTarget = definicion.tipo === 'conteo_pacientes' ? 'COUNT(DISTINCT patient_id)' : 'COUNT(*)';
  const locations = definicion.evento?.location_uuids ?? [];
  const diagnosticos = definicion.evento?.diagnosticos?.flatMap((item) => item.concepto_uuids) ?? [];
  const ordenes = definicion.evento?.ordenes?.flatMap((item) => item.concepto_uuids) ?? [];
  const clauses = ['encounter_datetime BETWEEN %(periodo_inicio)s AND %(periodo_fin)s'];

  if (locations.length) {
    clauses.push('location_uuid IN %(location_uuids)s');
  }
  if (diagnosticos.length) {
    clauses.push('diagnostico_uuid IN %(diagnostico_uuids)s');
  }
  if (ordenes.length) {
    clauses.push('orden_uuid IN %(orden_uuids)s');
  }

  return {
    sql: `SELECT ${selectTarget} AS total FROM clinical_events WHERE ${clauses.join(' AND ')}`,
    params: {
      location_uuids: locations,
      diagnostico_uuids: diagnosticos,
      orden_uuids: ordenes,
    },
  };
}

export function listIndicadores(page: number, size: number): PaginatedResponse<IndicadorDetail> {
  return toPaginatedResponse(indicadores, page, size);
}

export function getIndicadorById(id: string): IndicadorDetail {
  const indicador = indicadores.find((item) => item.id === id);
  if (!indicador) {
    throw new Error('Indicador no encontrado');
  }
  return indicador;
}

export function createIndicadorMock(payload: IndicadorCreatePayload): Indicador {
  const id = uid('ind');
  const createdAt = nowIso();
  const detail: IndicadorDetail = {
    id,
    nombre: payload.nombre,
    descripcion: payload.descripcion,
    activo: true,
    creado_en: createdAt,
    versiones: [
      {
        id: uid('ver'),
        indicador_id: id,
        version: 1,
        definicion: payload.definicion,
        creado_en: createdAt,
      },
    ],
  };
  indicadores = [detail, ...indicadores];
  return {
    id,
    nombre: detail.nombre,
    descripcion: detail.descripcion,
    activo: detail.activo,
    creado_en: detail.creado_en,
  };
}

export function updateIndicadorMock(id: string, payload: IndicadorUpdatePayload): Indicador {
  const indicador = getIndicadorById(id);
  indicador.nombre = payload.nombre;
  indicador.descripcion = payload.descripcion;
  if (payload.activo !== undefined) {
    indicador.activo = payload.activo;
  }
  return {
    id: indicador.id,
    nombre: indicador.nombre,
    descripcion: indicador.descripcion,
    activo: indicador.activo,
    creado_en: indicador.creado_en,
  };
}

export function deleteIndicadorMock(id: string) {
  indicadores = indicadores.filter((item) => item.id !== id);
  resultados = resultados.filter((item) => !item.indicador_version_id.startsWith(`ver-${id}`));
}

export function createVersionMock(id: string, definicion: DefinicionIndicadorForm): IndicadorVersion {
  const indicador = getIndicadorById(id);
  const nextVersion = indicador.versiones.reduce((max, item) => Math.max(max, item.version), 0) + 1;
  const version: IndicadorVersion = {
    id: uid('ver'),
    indicador_id: id,
    version: nextVersion,
    definicion,
    creado_en: nowIso(),
  };
  indicador.versiones = [version, ...indicador.versiones];
  return version;
}

export function getSqlPreviewMock(id: string, versionId?: string): IndicadorSQLPreview {
  const indicador = getIndicadorById(id);
  const version = versionId ? indicador.versiones.find((item) => item.id === versionId) : latestVersion(indicador);

  if (!version) {
    throw new Error('Versión no encontrada');
  }

  const periodStart = '2026-05-01';
  const periodEnd = '2026-05-31';
  const generated = definitionToSql(version.definicion);

  return {
    sql: generated.sql,
    params: {
      ...generated.params,
      periodo_inicio: periodStart,
      periodo_fin: periodEnd,
    },
    periodo_inicio: periodStart,
    periodo_fin: periodEnd,
    version_id: version.id,
    version_num: version.version,
  };
}

export function getSeriesMock(params: GetSeriesParams): SeriesResponse {
  const year = params.anio ?? new Date().getFullYear();
  const granularity = params.granularity ?? 'mensual';

  const monthlyRows: Array<SerieRow> = [
    { periodo_label: `${year}-01`, valor: 98, meses_disponibles: 1, anio: year, mes_referencia: `${year}-01-01` },
    { periodo_label: `${year}-02`, valor: 87, meses_disponibles: 1, anio: year, mes_referencia: `${year}-02-01` },
    { periodo_label: `${year}-03`, valor: 105, meses_disponibles: 1, anio: year, mes_referencia: `${year}-03-01` },
    { periodo_label: `${year}-04`, valor: 112, meses_disponibles: 1, anio: year, mes_referencia: `${year}-04-01` },
    { periodo_label: `${year}-05`, valor: 95, meses_disponibles: 1, anio: year, mes_referencia: `${year}-05-01` },
  ];

  if (granularity === 'mensual') {
    return { items: monthlyRows, indicador_id: params.indicador_id, anio: year, granularity };
  }

  if (granularity === 'trimestral') {
    return {
      items: [
        { periodo_label: 'Q1', valor: 290, meses_disponibles: 3, anio: year, trimestre: 1 },
        { periodo_label: 'Q2', valor: 207, meses_disponibles: 2, anio: year, trimestre: 2 },
      ],
      indicador_id: params.indicador_id,
      anio: year,
      granularity,
    };
  }

  if (granularity === 'semestral') {
    return {
      items: [
        { periodo_label: 'H1', valor: 290, meses_disponibles: 3, anio: year, semestre: 1 },
        { periodo_label: 'H2', valor: 207, meses_disponibles: 2, anio: year, semestre: 2 },
      ],
      indicador_id: params.indicador_id,
      anio: year,
      granularity,
    };
  }

  return {
    items: [{ periodo_label: String(year), valor: 497, meses_disponibles: 5, anio: year }],
    indicador_id: params.indicador_id,
    anio: year,
    granularity,
  };
}

export function listResultados(params: GetResultadosParams): PaginatedResponse<IndicadorResultado> {
  const filtered = resultados.filter((item) => {
    if (params.indicador_id) {
      const indicador = indicadores.find((entry) => entry.id === params.indicador_id);
      if (!indicador) {
        return false;
      }
      const versionIds = indicador.versiones.map((version) => version.id);
      if (!versionIds.includes(item.indicador_version_id)) {
        return false;
      }
    }

    if (params.periodo_inicio && item.periodo_fin < params.periodo_inicio) {
      return false;
    }

    if (params.periodo_fin && item.periodo_inicio > params.periodo_fin) {
      return false;
    }

    return true;
  });

  return toPaginatedResponse(filtered, params.page, params.size);
}

export function calcularAhoraMock(): BatchCalcularNowResponse {
  const activeIndicators = indicadores.filter((item) => item.activo);
  const nuevosResultados = activeIndicators.map((indicador) => {
    const version = latestVersion(indicador);
    return {
      id: uid('res'),
      indicador_version_id: version.id,
      indicador_nombre: indicador.nombre,
      indicador_version_num: version.version,
      periodo_inicio: '2026-05-01',
      periodo_fin: '2026-05-31',
      valor: Math.floor(Math.random() * 400) + 1,
      calculado_en: nowIso(),
      mes_referencia: '2026-05-01',
      es_canonico: true,
    } satisfies IndicadorResultado;
  });

  resultados = [...nuevosResultados, ...resultados];

  return {
    calculados: nuevosResultados.length,
    errores: [],
    total: activeIndicators.length,
  };
}

export function recalcularAnioMock(params: RecalcularAnioParams): RecalcularAnioResponse {
  const anio = params.anio;
  const filtered = params.indicador_id
    ? indicadores.filter((item) => item.id === params.indicador_id)
    : indicadores.filter((item) => item.activo);

  const mesesProcesados = 12;
  const nuevosResultados: Array<IndicadorResultado> = [];

  filtered.forEach((indicador) => {
    const version = latestVersion(indicador);
    for (let mes = 1; mes <= mesesProcesados; mes += 1) {
      const mesReferencia = `${anio}-${String(mes).padStart(2, '0')}-01`;
      const periodoFin = `${anio}-${String(mes).padStart(2, '0')}-${new Date(anio, mes, 0).getDate()}`;
      nuevosResultados.push({
        id: uid('res'),
        indicador_version_id: version.id,
        indicador_nombre: indicador.nombre,
        indicador_version_num: version.version,
        periodo_inicio: mesReferencia,
        periodo_fin: periodoFin,
        valor: Math.floor(Math.random() * 400) + 1,
        calculado_en: nowIso(),
        mes_referencia: mesReferencia,
        es_canonico: true,
      });
    }
  });

  resultados = [...nuevosResultados, ...resultados];

  return {
    anio,
    indicador_id: params.indicador_id ?? null,
    meses_procesados: mesesProcesados,
    indicadores_considerados: filtered.length,
    recalculados: nuevosResultados.length,
    errores: [],
    total: filtered.length * mesesProcesados,
  };
}

export function searchLocationsMock(query: string): Array<LocationOption> {
  const normalized = query.trim().toLowerCase();
  return mockLocations.filter((item) => item.display.toLowerCase().includes(normalized));
}

export function searchDiagnosticosMock(query: string): Array<DiagnosticoOption> {
  const normalized = query.trim().toLowerCase();
  return mockDiagnosticos.filter((item) => `${item.codigo ?? ''} ${item.nombre}`.toLowerCase().includes(normalized));
}

export function searchOrdenesMock(query: string): Array<OrdenOption> {
  const normalized = query.trim().toLowerCase();
  return mockOrdenes.filter((item) => item.display.toLowerCase().includes(normalized));
}

export function resolveLocationsMock(uuids: Array<string>) {
  return mockLocations.filter((item) => uuids.includes(item.uuid));
}

export function resolveDiagnosticosMock(uuids: Array<string>) {
  return mockDiagnosticos.filter((item) => uuids.includes(item.uuid));
}

export function resolveOrdenesMock(uuids: Array<string>): Record<string, string> {
  if (!uuids.length) {
    return {};
  }

  const result: Record<string, string> = {};
  for (const item of mockOrdenes) {
    if (uuids.includes(item.uuid)) {
      result[item.uuid] = item.display;
    }
  }
  return result;
}

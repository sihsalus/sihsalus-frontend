/**
 * MOCK data layer for the indicadores screens.
 *
 * These hooks emulate the backend of github.com/sihsalus/reportes-sql without any
 * network calls: data lives in an in-memory store so the "definir" and "ver"
 * screens are fully interactive for demos. Swap these out for real `openmrsFetch`
 * hooks once the indicators OMOD / API is available.
 */
import { useCallback, useSyncExternalStore } from 'react';

export type TipoIndicador = 'conteo_atenciones' | 'conteo_pacientes';
export type PeriodoIndicador = 'mes_actual' | 'trimestre_actual' | 'semestre_actual' | 'anual_actual';

export interface Indicador {
  id: string;
  nombre: string;
  descripcion: string;
  tipo: TipoIndicador;
  periodo: PeriodoIndicador;
  activo: boolean;
  creadoEn: string;
}

export interface Resultado {
  id: string;
  indicadorId: string;
  indicadorNombre: string;
  periodoInicio: string;
  periodoFin: string;
  valor: number;
  calculadoEn: string;
}

export interface IndicadorInput {
  nombre: string;
  descripcion: string;
  tipo: TipoIndicador;
  periodo: PeriodoIndicador;
  activo: boolean;
}

export interface ResultadosFilters {
  indicadorId?: string;
  periodoInicio?: string;
  periodoFin?: string;
}

const uid = () => Math.random().toString(36).slice(2, 10);
const nowIso = () => new Date().toISOString();

// ── In-memory store ──────────────────────────────────────────────────────────
let indicadores: Array<Indicador> = [
  {
    id: 'ind-001',
    nombre: 'Atenciones de control prenatal',
    descripcion: 'Conteo de atenciones de control prenatal en el periodo.',
    tipo: 'conteo_atenciones',
    periodo: 'mes_actual',
    activo: true,
    creadoEn: '2026-01-15T10:00:00.000Z',
  },
  {
    id: 'ind-002',
    nombre: 'Pacientes con diagnóstico de anemia',
    descripcion: 'Pacientes únicos con diagnóstico de anemia.',
    tipo: 'conteo_pacientes',
    periodo: 'trimestre_actual',
    activo: true,
    creadoEn: '2026-02-03T09:30:00.000Z',
  },
  {
    id: 'ind-003',
    nombre: 'Atenciones odontológicas (inactivo)',
    descripcion: 'Indicador en borrador, aún no publicado.',
    tipo: 'conteo_atenciones',
    periodo: 'anual_actual',
    activo: false,
    creadoEn: '2026-03-20T14:45:00.000Z',
  },
];

let resultados: Array<Resultado> = [
  {
    id: uid(),
    indicadorId: 'ind-001',
    indicadorNombre: 'Atenciones de control prenatal',
    periodoInicio: '2026-04-01',
    periodoFin: '2026-04-30',
    valor: 312,
    calculadoEn: '2026-05-01T02:00:00.000Z',
  },
  {
    id: uid(),
    indicadorId: 'ind-001',
    indicadorNombre: 'Atenciones de control prenatal',
    periodoInicio: '2026-03-01',
    periodoFin: '2026-03-31',
    valor: 287,
    calculadoEn: '2026-04-01T02:00:00.000Z',
  },
  {
    id: uid(),
    indicadorId: 'ind-002',
    indicadorNombre: 'Pacientes con diagnóstico de anemia',
    periodoInicio: '2026-01-01',
    periodoFin: '2026-03-31',
    valor: 154,
    calculadoEn: '2026-04-01T02:00:00.000Z',
  },
];

const listeners = new Set<() => void>();
const emit = () => {
  listeners.forEach((l) => {
    l();
  });
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

// ── Indicadores ───────────────────────────────────────────────────────────────
const getIndicadores = () => indicadores;

export function useIndicadores() {
  const data = useSyncExternalStore(subscribe, getIndicadores);

  const create = useCallback((input: IndicadorInput) => {
    const indicador: Indicador = { id: uid(), creadoEn: nowIso(), ...input };
    indicadores = [indicador, ...indicadores];
    emit();
    return indicador;
  }, []);

  const update = useCallback((id: string, input: IndicadorInput) => {
    indicadores = indicadores.map((i) => (i.id === id ? { ...i, ...input } : i));
    emit();
  }, []);

  const remove = useCallback((id: string) => {
    indicadores = indicadores.filter((i) => i.id !== id);
    resultados = resultados.filter((r) => r.indicadorId !== id);
    emit();
  }, []);

  return { indicadores: data, isLoading: false, create, update, remove };
}

// ── Resultados ──────────────────────────────────────────────────────────────
const getResultados = () => resultados;

export function useResultados(filters: ResultadosFilters = {}) {
  const all = useSyncExternalStore(subscribe, getResultados);
  const data = all.filter((r) => {
    if (filters.indicadorId && r.indicadorId !== filters.indicadorId) return false;
    if (filters.periodoInicio && r.periodoFin < filters.periodoInicio) return false;
    if (filters.periodoFin && r.periodoInicio > filters.periodoFin) return false;
    return true;
  });
  return { resultados: data, isLoading: false };
}

/** Emula POST /resultados/calcular-ahora: genera un resultado nuevo por indicador activo. */
export function calcularAhora(): { calculados: number } {
  const activos = indicadores.filter((i) => i.activo);
  const today = new Date();
  const inicio = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const fin = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
  const nuevos: Array<Resultado> = activos.map((ind) => ({
    id: uid(),
    indicadorId: ind.id,
    indicadorNombre: ind.nombre,
    periodoInicio: inicio,
    periodoFin: fin,
    valor: Math.floor(Math.random() * 400),
    calculadoEn: nowIso(),
  }));
  resultados = [...nuevos, ...resultados];
  emit();
  return { calculados: nuevos.length };
}

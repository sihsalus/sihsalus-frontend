import { describe, expect, it } from 'vitest';

import type { DefinicionIndicadorForm } from '../../api/types';
import { parseDefinicion } from './parseDefinicion';

function makeDefinicionWithOrdenes(uuids: Array<string>): DefinicionIndicadorForm {
  return {
    tipo: 'conteo_atenciones',
    evento: {
      ordenes: uuids.map((concepto_uuid) => ({ concepto_uuid })),
    },
  };
}

describe('parseDefinicion ordeneMap parameter', () => {
  it('hydrates selectedOrdenes.display from ordenesMap', () => {
    const definicion = makeDefinicionWithOrdenes(['ord-hemograma', 'ord-ferritina']);
    const ordenesMap = {
      'ord-hemograma': 'Hemograma',
      'ord-ferritina': 'Ferritina sérica',
    };

    const result = parseDefinicion(definicion, ordenesMap);

    expect(result.selectedOrdenes).toEqual([
      { uuid: 'ord-hemograma', display: 'Hemograma' },
      { uuid: 'ord-ferritina', display: 'Ferritina sérica' },
    ]);
  });

  it('falls back to UUID when ordenesMap entry is missing', () => {
    const definicion = makeDefinicionWithOrdenes(['ord-hemograma', 'ord-unknown']);
    const ordenesMap = {
      'ord-hemograma': 'Hemograma',
    };

    const result = parseDefinicion(definicion, ordenesMap);

    expect(result.selectedOrdenes).toEqual([
      { uuid: 'ord-hemograma', display: 'Hemograma' },
      { uuid: 'ord-unknown', display: 'ord-unknown' },
    ]);
  });

  it('uses raw UUID as display when ordenesMap is undefined (backward compat)', () => {
    const definicion = makeDefinicionWithOrdenes(['ord-hemograma', 'ord-ferritina']);

    const result = parseDefinicion(definicion);

    expect(result.selectedOrdenes).toEqual([
      { uuid: 'ord-hemograma', display: 'ord-hemograma' },
      { uuid: 'ord-ferritina', display: 'ord-ferritina' },
    ]);
  });
});

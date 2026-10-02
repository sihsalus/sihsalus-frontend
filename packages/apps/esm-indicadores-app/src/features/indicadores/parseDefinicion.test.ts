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

function makeDefinicionWithLocations(uuids: Array<string>): DefinicionIndicadorForm {
  return {
    tipo: 'conteo_atenciones',
    evento: { location_uuids: uuids },
  };
}

function makeDefinicionWithDiagnosticos(uuids: Array<string>): DefinicionIndicadorForm {
  return {
    tipo: 'conteo_atenciones',
    evento: { diagnosticos: [{ concepto_uuids: uuids, tipo_diagnostico: 'presuntivo' }] },
  };
}

describe('parseDefinicion ordenes name map', () => {
  it('hydrates selectedOrdenes.display from the ordenes map', () => {
    const definicion = makeDefinicionWithOrdenes(['ord-hemograma', 'ord-ferritina']);
    const ordenes = new Map([
      ['ord-hemograma', 'Hemograma'],
      ['ord-ferritina', 'Ferritina sérica'],
    ]);

    const result = parseDefinicion(definicion, { ordenes });

    expect(result.selectedOrdenes).toEqual([
      { uuid: 'ord-hemograma', display: 'Hemograma' },
      { uuid: 'ord-ferritina', display: 'Ferritina sérica' },
    ]);
  });

  it('falls back to UUID when ordenes map entry is missing', () => {
    const definicion = makeDefinicionWithOrdenes(['ord-hemograma', 'ord-unknown']);
    const ordenes = new Map([['ord-hemograma', 'Hemograma']]);

    const result = parseDefinicion(definicion, { ordenes });

    expect(result.selectedOrdenes).toEqual([
      { uuid: 'ord-hemograma', display: 'Hemograma' },
      { uuid: 'ord-unknown', display: 'ord-unknown' },
    ]);
  });

  it('uses raw UUID as display when no names map is provided (backward compat)', () => {
    const definicion = makeDefinicionWithOrdenes(['ord-hemograma', 'ord-ferritina']);

    const result = parseDefinicion(definicion);

    expect(result.selectedOrdenes).toEqual([
      { uuid: 'ord-hemograma', display: 'ord-hemograma' },
      { uuid: 'ord-ferritina', display: 'ord-ferritina' },
    ]);
  });
});

describe('parseDefinicion locations name map', () => {
  it('hydrates selectedLocations.display from the locations map', () => {
    const definicion = makeDefinicionWithLocations(['loc-001', 'loc-002']);
    const locations = new Map([
      ['loc-001', 'Centro Obstétrico'],
      ['loc-002', 'Hospital Central'],
    ]);

    const result = parseDefinicion(definicion, { locations });

    expect(result.selectedLocations).toEqual([
      { uuid: 'loc-001', display: 'Centro Obstétrico' },
      { uuid: 'loc-002', display: 'Hospital Central' },
    ]);
  });

  it('falls back to UUID when locations map entry is missing', () => {
    const definicion = makeDefinicionWithLocations(['loc-001', 'loc-unknown']);
    const locations = new Map([['loc-001', 'Centro Obstétrico']]);

    const result = parseDefinicion(definicion, { locations });

    expect(result.selectedLocations).toEqual([
      { uuid: 'loc-001', display: 'Centro Obstétrico' },
      { uuid: 'loc-unknown', display: 'loc-unknown' },
    ]);
  });

  it('uses raw UUID as display when no locations map is provided', () => {
    const definicion = makeDefinicionWithLocations(['loc-001']);

    const result = parseDefinicion(definicion);

    expect(result.selectedLocations).toEqual([{ uuid: 'loc-001', display: 'loc-001' }]);
  });
});

describe('parseDefinicion diagnosticos name map', () => {
  it('hydrates selectedDiagnosticos.nombre from the diagnosticos map', () => {
    const definicion = makeDefinicionWithDiagnosticos(['dxC', 'dxA']);
    const diagnosticos = new Map([
      ['dxC', { uuid: 'dxC', nombre: 'Anemia ferropénica' }],
      ['dxA', { uuid: 'dxA', nombre: 'Desnutrición leve' }],
    ]);

    const result = parseDefinicion(definicion, { diagnosticos });

    expect(result.selectedDiagnosticos).toEqual([
      { uuid: 'dxC', nombre: 'Anemia ferropénica' },
      { uuid: 'dxA', nombre: 'Desnutrición leve' },
    ]);
  });

  it('falls back to UUID when diagnosticos map entry is missing', () => {
    const definicion = makeDefinicionWithDiagnosticos(['dxC', 'dxUnknown']);
    const diagnosticos = new Map([['dxC', { uuid: 'dxC', nombre: 'Anemia ferropénica' }]]);

    const result = parseDefinicion(definicion, { diagnosticos });

    expect(result.selectedDiagnosticos).toEqual([
      { uuid: 'dxC', nombre: 'Anemia ferropénica' },
      { uuid: 'dxUnknown', nombre: 'dxUnknown' },
    ]);
  });

  it('uses raw UUID as nombre when no diagnosticos map is provided', () => {
    const definicion = makeDefinicionWithDiagnosticos(['dxC']);

    const result = parseDefinicion(definicion);

    expect(result.selectedDiagnosticos).toEqual([{ uuid: 'dxC', nombre: 'dxC' }]);
  });
});

describe('parseDefinicion combined', () => {
  it('resolves all three name sets at once and sets filtroClinico by diagnosticos precedence', () => {
    const definicion: DefinicionIndicadorForm = {
      tipo: 'conteo_atenciones',
      evento: {
        location_uuids: ['loc-001'],
        diagnosticos: [{ concepto_uuids: ['dxC'], tipo_diagnostico: 'presuntivo' }],
        ordenes: [{ concepto_uuid: 'ord-hemograma' }],
      },
    };
    const names = {
      locations: new Map([['loc-001', 'Centro Obstétrico']]),
      diagnosticos: new Map([['dxC', { uuid: 'dxC', nombre: 'Anemia ferropénica' }]]),
      ordenes: new Map([['ord-hemograma', 'Hemograma']]),
    };

    const result = parseDefinicion(definicion, names);

    expect(result.selectedLocations).toEqual([{ uuid: 'loc-001', display: 'Centro Obstétrico' }]);
    expect(result.selectedDiagnosticos).toEqual([{ uuid: 'dxC', nombre: 'Anemia ferropénica' }]);
    expect(result.selectedOrdenes).toEqual([{ uuid: 'ord-hemograma', display: 'Hemograma' }]);
    expect(result.filtroClinico).toBe('diagnosticos');
    expect(result.diagnosticoTipo).toBe('presuntivo');
  });
});

describe('parseDefinicion encounter types', () => {
  function makeDefinicionWithEncounterTypes(uuids: Array<string>): DefinicionIndicadorForm {
    return {
      tipo: 'conteo_pacientes_ventana',
      evento: { encounter_type_uuids: uuids, minimo_ocurrencias: 4 },
      poblacion: { max_dias: 28 },
    };
  }

  it('hydrates selectedEncounterTypes.display from the encounterTypes map', () => {
    const definicion = makeDefinicionWithEncounterTypes(['enc-cred', 'enc-control']);
    const encounterTypes = new Map([
      ['enc-cred', 'CRED Neonato'],
      ['enc-control', 'Control de niño sano'],
    ]);

    const result = parseDefinicion(definicion, { encounterTypes });

    expect(result.tipo).toBe('conteo_pacientes_ventana');
    expect(result.minimoOcurrencias).toBe('4');
    expect(result.maxDias).toBe('28');
    expect(result.selectedEncounterTypes).toEqual([
      { uuid: 'enc-cred', display: 'CRED Neonato' },
      { uuid: 'enc-control', display: 'Control de niño sano' },
    ]);
  });

  it('falls back to UUID when encounterTypes map entry is missing', () => {
    const definicion = makeDefinicionWithEncounterTypes(['enc-cred', 'enc-unknown']);
    const encounterTypes = new Map([['enc-cred', 'CRED Neonato']]);

    const result = parseDefinicion(definicion, { encounterTypes });

    expect(result.selectedEncounterTypes).toEqual([
      { uuid: 'enc-cred', display: 'CRED Neonato' },
      { uuid: 'enc-unknown', display: 'enc-unknown' },
    ]);
  });

  it('uses raw UUID as display when no encounterTypes map is provided', () => {
    const definicion = makeDefinicionWithEncounterTypes(['enc-cred']);

    const result = parseDefinicion(definicion);

    expect(result.selectedEncounterTypes).toEqual([{ uuid: 'enc-cred', display: 'enc-cred' }]);
  });

  it('keeps encounter types optional for the other indicator types', () => {
    const definicion: DefinicionIndicadorForm = {
      tipo: 'conteo_atenciones',
      evento: { location_uuids: ['loc-001'] },
    };

    const result = parseDefinicion(definicion);

    expect(result.selectedEncounterTypes).toEqual([]);
  });
});

import { getLocalizedDaysOfWeek } from './monthly-header.component';

describe('appointment calendar weekday labels', () => {
  it('uses Spanish weekday abbreviations for the Peru locale', () => {
    expect(getLocalizedDaysOfWeek('es-PE')).toEqual(['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']);
  });

  it('normalizes OpenMRS locale identifiers', () => {
    expect(getLocalizedDaysOfWeek('es_PE')).toEqual(['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']);
  });
});

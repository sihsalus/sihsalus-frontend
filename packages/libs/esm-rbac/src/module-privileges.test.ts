import { describe, expect, it } from 'vitest';
import { modulePrivileges } from './module-privileges';

describe('modulePrivileges', () => {
  it('defines unique base privileges for all external module tiles', () => {
    expect(modulePrivileges).toEqual({
      referrals: 'app:referencias',
      staffScheduling: 'app:programacionTurnosRecursos',
      stockManagement: 'app:gestionInventario',
      cohortBuilder: 'app:constructorCohortes',
      vaccineSchedulingBuilder: 'app:gestorCalendarioVacunacion',
      reports: 'app:reportes',
      indicators: 'app:indicadores',
      forms: 'app:entradaRapidaDatos',
      offlineTools: 'app:herramientasSinInternet',
      bedManagement: 'app:administracionCamas',
      billableServices: 'app:serviciosFacturables',
      systemAdministration: 'app:administracionSistema',
    });
    expect(new Set(Object.values(modulePrivileges)).size).toBe(12);
  });
});

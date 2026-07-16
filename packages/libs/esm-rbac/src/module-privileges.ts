export const modulePrivileges = {
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
} as const;

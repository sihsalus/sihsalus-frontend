export const interconsultasHomePrivilege = 'app:home.interconsultas';
export const interconsultasHomeEditPrivilege = 'app:home.interconsultas.editar';
export const interconsultasChartPrivilege = 'app:hoja.clinica.interconsultas';
export const interconsultasChartEditPrivilege = 'app:hoja.clinica.interconsultas.editar';

export const interconsultasEditPrivileges = [
  interconsultasChartEditPrivilege,
  interconsultasHomeEditPrivilege,
] as const;

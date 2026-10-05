export const prenatalCareEditPrivilege = 'app:hoja.clinica.controlPrenatal.editar';
export const labourDeliveryEditPrivilege = 'app:hoja.clinica.partoPuerperio.editar';
export const postnatalCareEditPrivilege = 'app:hoja.clinica.atencionPostnatal.editar';
export const familyPlanningEditPrivilege = 'app:hoja.clinica.planificacionFamiliar.editar';
export const cancerPreventionEditPrivilege = 'app:hoja.clinica.prevencionCancer.editar';

export const maternalPatientChartPrivilege = 'app:hoja.clinica';
export const addRelationshipsPrivilege = 'Add Relationships';
export const maternalHealthPrivileges = [
  { view: 'app:hoja.clinica.controlPrenatal', edit: prenatalCareEditPrivilege },
  { view: 'app:hoja.clinica.partoPuerperio', edit: labourDeliveryEditPrivilege },
  { view: 'app:hoja.clinica.atencionPostnatal', edit: postnatalCareEditPrivilege },
  { view: 'app:hoja.clinica.planificacionFamiliar', edit: familyPlanningEditPrivilege },
  { view: 'app:hoja.clinica.prevencionCancer', edit: cancerPreventionEditPrivilege },
] as const;

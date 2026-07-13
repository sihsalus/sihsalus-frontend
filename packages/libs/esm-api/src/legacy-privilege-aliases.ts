/**
 * Privilege identifiers renamed by the SIHSALUS RBAC standardization.
 *
 * OpenMRS Initializer treats privilege names as immutable. Existing databases
 * therefore keep the legacy identifier even when the content CSV uses the new
 * identifier with the same UUID. These exact pairs let the frontend support
 * both database states without broadening access between unrelated privileges.
 */
const renamedPrivilegePairs = [
  ['app:hoja.clinica', 'app:clinical.chart'],
  ['app:hoja.clinica.accionesSinConexion', 'app:clinical.chart.offlineActions'],
  ['app:hoja.clinica.accionesSinConexion.editar', 'app:clinical.chart.offlineActions.edit'],
  ['app:hoja.clinica.adjuntos', 'app:clinical.chart.attachments'],
  ['app:hoja.clinica.adjuntos.editar', 'app:clinical.chart.attachments.edit'],
  ['app:hoja.clinica.alergias', 'app:clinical.chart.allergies'],
  ['app:hoja.clinica.alergias.editar', 'app:clinical.chart.allergies.edit'],
  ['app:hoja.clinica.atencionPostnatal', 'app:clinical.chart.postnatalCare'],
  ['app:hoja.clinica.atencionPostnatal.editar', 'app:clinical.chart.postnatalCare.edit'],
  ['app:hoja.clinica.citas', 'app:clinical.chart.appointments'],
  ['app:hoja.clinica.citas.editar', 'app:clinical.chart.appointments.edit'],
  ['app:hoja.clinica.condiciones', 'app:clinical.chart.conditions'],
  ['app:hoja.clinica.condiciones.editar', 'app:clinical.chart.conditions.edit'],
  ['app:hoja.clinica.consultaExterna', 'app:clinical.chart.consultaExterna'],
  ['app:hoja.clinica.consultaExterna.editar', 'app:clinical.chart.consultaExterna.edit'],
  ['app:hoja.clinica.controlPrenatal', 'app:clinical.chart.prenatalCare'],
  ['app:hoja.clinica.controlPrenatal.editar', 'app:clinical.chart.prenatalCare.edit'],
  ['app:hoja.clinica.cred.antecedentes', 'app:cred.antecedentes'],
  ['app:hoja.clinica.cred.antecedentes.editar', 'app:cred.antecedentes.edit'],
  ['app:hoja.clinica.cred.cursoVida', 'app:cred.cursoVida'],
  ['app:hoja.clinica.cred.cursoVida.editar', 'app:cred.cursoVida.edit'],
  ['app:hoja.clinica.cred.estimulacionTemprana', 'app:cred.earlyStim'],
  ['app:hoja.clinica.cred.estimulacionTemprana.editar', 'app:cred.earlyStim.edit'],
  ['app:hoja.clinica.cred.inmunizaciones', 'app:cred.immunization'],
  ['app:hoja.clinica.cred.inmunizaciones.editar', 'app:cred.immunization.edit'],
  ['app:hoja.clinica.cred.neonatal', 'app:cred.neonatal'],
  ['app:hoja.clinica.cred.neonatal.editar', 'app:cred.neonatal.edit'],
  ['app:hoja.clinica.cred.ninoSano', 'app:cred.wellChild'],
  ['app:hoja.clinica.cred.ninoSano.editar', 'app:cred.wellChild.edit'],
  ['app:hoja.clinica.cred.nutricion', 'app:cred.nutrition'],
  ['app:hoja.clinica.cred.nutricion.editar', 'app:cred.nutrition.edit'],
  ['app:hoja.clinica.facturacion', 'app:clinical.chart.billing'],
  ['app:hoja.clinica.facturacion.editar', 'app:clinical.chart.billing.edit'],
  ['app:hoja.clinica.fichaFamiliar', 'app:clinical.chart.family'],
  ['app:hoja.clinica.fichaFamiliar.editar', 'app:clinical.chart.family.edit'],
  ['app:hoja.clinica.historiaSocial', 'app:clinical.chart.socialHistory'],
  ['app:hoja.clinica.historiaSocial.editar', 'app:clinical.chart.socialHistory.edit'],
  ['app:hoja.clinica.imagenes', 'app:clinical.chart.imaging'],
  ['app:hoja.clinica.imagenes.editar', 'app:clinical.chart.imaging.edit'],
  ['app:hoja.clinica.inmunizaciones', 'app:clinical.chart.immunizations'],
  ['app:hoja.clinica.inmunizaciones.editar', 'app:clinical.chart.immunizations.edit'],
  ['app:hoja.clinica.interconsultas', 'app:clinical.chart.interconsultations'],
  ['app:hoja.clinica.interconsultas.editar', 'app:clinical.chart.interconsultations.edit'],
  ['app:hoja.clinica.medicamentos', 'app:clinical.chart.medications'],
  ['app:hoja.clinica.medicamentos.editar', 'app:clinical.chart.medications.edit'],
  ['app:hoja.clinica.odontologia', 'app:clinical.chart.dentistry'],
  ['app:hoja.clinica.odontologia.editar', 'app:clinical.chart.dentistry.edit'],
  ['app:hoja.clinica.ordenes', 'app:clinical.chart.orders'],
  ['app:hoja.clinica.ordenes.editar', 'app:clinical.chart.orders.edit'],
  ['app:hoja.clinica.partoPuerperio', 'app:clinical.chart.labourDelivery'],
  ['app:hoja.clinica.partoPuerperio.editar', 'app:clinical.chart.labourDelivery.edit'],
  ['app:hoja.clinica.perdidaSeguimiento', 'app:clinical.chart.missedFollowUp'],
  ['app:hoja.clinica.perdidaSeguimiento.editar', 'app:clinical.chart.missedFollowUp.edit'],
  ['app:hoja.clinica.planificacionFamiliar', 'app:clinical.chart.familyPlanning'],
  ['app:hoja.clinica.planificacionFamiliar.editar', 'app:clinical.chart.familyPlanning.edit'],
  ['app:hoja.clinica.prevencionCancer', 'app:clinical.chart.cancerPrevention'],
  ['app:hoja.clinica.prevencionCancer.editar', 'app:clinical.chart.cancerPrevention.edit'],
  ['app:hoja.clinica.procedimientos', 'app:clinical.chart.procedures'],
  ['app:hoja.clinica.procedimientos.editar', 'app:clinical.chart.procedures.edit'],
  ['app:hoja.clinica.programas', 'app:clinical.chart.programs'],
  ['app:hoja.clinica.programas.editar', 'app:clinical.chart.programs.edit'],
  ['app:hoja.clinica.psicologia', 'app:clinical.chart.psychology'],
  ['app:hoja.clinica.psicologia.editar', 'app:clinical.chart.psychology.edit'],
  ['app:hoja.clinica.resultados', 'app:clinical.chart.results'],
  ['app:hoja.clinica.resultados.editar', 'app:clinical.chart.results.edit'],
  ['app:hoja.clinica.resumen', 'app:clinical.chart.summary'],
  ['app:hoja.clinica.seguimientoCasos', 'app:clinical.chart.caseMonitoring'],
  ['app:hoja.clinica.seguimientoCasos.editar', 'app:clinical.chart.caseMonitoring.edit'],
  ['app:hoja.clinica.signosVitales', 'app:clinical.chart.vitals'],
  ['app:hoja.clinica.signosVitales.editar', 'app:clinical.chart.vitals.edit'],
  ['app:hoja.clinica.tamizajes', 'app:clinical.chart.screenings'],
  ['app:hoja.clinica.tamizajes.editar', 'app:clinical.chart.screenings.edit'],
  ['app:hoja.clinica.terapiaFisica', 'app:clinical.chart.physicalTherapy'],
  ['app:hoja.clinica.terapiaFisica.editar', 'app:clinical.chart.physicalTherapy.edit'],
  ['app:hoja.clinica.visitas', 'app:clinical.chart.visits'],
  ['app:hoja.clinica.visitas.editar', 'app:clinical.chart.visits.edit'],
  ['app:home.admision', 'app:adt'],
  ['app:home.colasAtencion', 'app:adt'],
  ['app:home.citas', 'app:appointments'],
  ['app:home.citas.editar', 'app:appointments.edit'],
  ['app:home.colasAtencion', 'app:service-queues'],
  ['app:service-queues', 'app:adt'],
  ['app:home.colasAtencion.editar', 'app:service-queues.edit'],
  ['app:home.editar', 'app:home.edit'],
  ['app:home.emergencia', 'app:emergency'],
  ['app:home.emergencia.editar', 'app:emergency.edit'],
  ['app:home.facturacion', 'app:billing'],
  ['app:home.facturacion.editar', 'app:billing.edit'],
  ['app:home.farmacia', 'app:dispensing'],
  ['app:home.farmacia.editar', 'app:dispensing.edit'],
  ['app:home.fua', 'app:fua'],
  ['app:home.fua.editar', 'app:fua.edit'],
  ['app:home.hospitalizacion', 'app:ward'],
  ['app:home.hospitalizacion.editar', 'app:ward.edit'],
  ['app:home.interconsultas', 'app:interconsultas'],
  ['app:home.interconsultas.editar', 'app:interconsultas.edit'],
  ['app:home.laboratorio', 'app:laboratory'],
  ['app:home.laboratorio.editar', 'app:laboratory.edit'],
  ['app:home.libroAtenciones', 'app:care-logbook'],
  ['app:home.libroAtenciones.editar', 'app:care-logbook.edit'],
  ['app:home.listasPacientes', 'app:patient-lists'],
  ['app:home.listasPacientes.editar', 'app:patient-lists.edit'],
  ['app:home.seguimientoCasos', 'app:case-monitoring'],
  ['app:home.seguimientoCasos.editar', 'app:case-monitoring.edit'],
  ['app:home.tamizajes', 'app:tamizajes'],
  ['app:home.tamizajes.editar', 'app:tamizajes.edit'],
  ['app:opciones.busquedaPaciente', 'app:topnav.patientSearch'],
  ['app:opciones.fusionarPacientes', 'app:topnav.mergePatients'],
  ['app:opciones.herramientasImplementacion', 'app:topnav.implementerTools'],
  ['app:opciones.registrarPaciente', 'app:topnav.registerPatient'],
  ['app:opciones.selectorModulos', 'app:topnav.moduleSwitcher'],
] as const;

const privilegeAliases = new Map<string, Set<string>>();

function registerAlias(privilege: string, equivalent: string) {
  const existing = privilegeAliases.get(privilege);
  if (existing) {
    existing.add(equivalent);
  } else {
    privilegeAliases.set(privilege, new Set([equivalent]));
  }
}

for (const [currentPrivilege, legacyPrivilege] of renamedPrivilegePairs) {
  registerAlias(currentPrivilege, legacyPrivilege);
  registerAlias(legacyPrivilege, currentPrivilege);
}

export function privilegesAreEquivalent(requiredPrivilege: string, grantedPrivilege: string): boolean {
  if (requiredPrivilege === grantedPrivilege) {
    return true;
  }

  return privilegeAliases.get(requiredPrivilege)?.has(grantedPrivilege) ?? false;
}

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repositoryRoot = path.resolve(__dirname, '../../..');

const expectedTranslations = {
  'packages/apps/esm-indicadores-app/translations/en.json': {
    recalcDone_one: '{{count}} result recalculated for year {{anio}}',
    recalcDone_other: '{{count}} results recalculated for year {{anio}}',
    recalcPartialErrors_one: '{{count}} with an error',
    recalcPartialErrors_other: '{{count}} with errors',
  },
  'packages/apps/esm-offline-tools-app/translations/es.json': {
    offlineActionsDeleteFailedSubtitle_one: '{{count}} acción no se pudo eliminar y sigue en la lista.',
    offlineActionsDeleteFailedSubtitle_many: '{{count}} acciones no se pudieron eliminar y siguen en la lista.',
    offlineActionsDeleteFailedSubtitle_other: '{{count}} acciones no se pudieron eliminar y siguen en la lista.',
    offlinePatientsSyncFailedSubtitle_one:
      'No se pudo actualizar {{count}} paciente para uso sin conexión. Los datos descargados previamente pueden estar desactualizados. Intente nuevamente.',
    offlinePatientsSyncFailedSubtitle_many:
      'No se pudieron actualizar {{count}} pacientes para uso sin conexión. Los datos descargados previamente pueden estar desactualizados. Intente nuevamente.',
    offlinePatientsSyncFailedSubtitle_other:
      'No se pudieron actualizar {{count}} pacientes para uso sin conexión. Los datos descargados previamente pueden estar desactualizados. Intente nuevamente.',
    offlinePatientsSyncSkippedSubtitle_one:
      '{{count}} paciente seleccionado aún tiene un registro sin conexión pendiente. Sincronice las acciones pendientes antes de actualizarlo.',
    offlinePatientsSyncSkippedSubtitle_many:
      '{{count}} pacientes seleccionados aún tienen registros sin conexión pendientes. Sincronice las acciones pendientes antes de actualizarlos.',
    offlinePatientsSyncSkippedSubtitle_other:
      '{{count}} pacientes seleccionados aún tienen registros sin conexión pendientes. Sincronice las acciones pendientes antes de actualizarlos.',
  },
  'packages/apps/esm-patient-chart-app/translations/en.json': {
    minimumCompanionSearchCharacters_one: 'Enter at least {{count}} character',
    minimumCompanionSearchCharacters_other: 'Enter at least {{count}} characters',
  },
  'packages/apps/esm-patient-registration-app/translations/es.json': {
    personAttributeValueTooLong_one: 'Use {{max}} caracteres o menos ({{count}} ingresado)',
    personAttributeValueTooLong_many: 'Use {{max}} caracteres o menos ({{count}} ingresados)',
    personAttributeValueTooLong_other: 'Use {{max}} caracteres o menos ({{count}} ingresados)',
  },
  'packages/apps/esm-patient-search-app/translations/es.json': {
    minimumSearchCharacters_one: 'Ingrese al menos {{count}} carácter',
    minimumSearchCharacters_many: 'Ingrese al menos {{count}} caracteres',
    minimumSearchCharacters_other: 'Ingrese al menos {{count}} caracteres',
  },
  'packages/apps/esm-service-queues-app/translations/en.json': {
    queueEntryCommentLimit_one: 'Maximum {{count}} character.',
    queueEntryCommentLimit_other: 'Maximum {{count}} characters.',
    queueEntryCommentTooLong_one: 'The comment cannot exceed {{count}} character.',
    queueEntryCommentTooLong_other: 'The comment cannot exceed {{count}} characters.',
  },
};

test('generated plural variants stay in their catalog language with their interpolation tokens', () => {
  for (const [relativePath, expectedEntries] of Object.entries(expectedTranslations)) {
    const catalog = JSON.parse(readFileSync(path.join(repositoryRoot, relativePath), 'utf8'));

    for (const [key, expectedValue] of Object.entries(expectedEntries)) {
      assert.equal(catalog[key], expectedValue, `${relativePath}:${key}`);
    }
  }
});

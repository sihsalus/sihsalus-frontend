import { translateFrom } from '@openmrs/esm-framework';
import { formEngineAppName } from '../../globals';
import { type FormField, type FormSchema } from '../../types';

/** Legacy schemas may identify the provider without offering a way to select their encounter role. */
export function ensureEncounterRoleField(schema: FormSchema): void {
  const fields: FormField[] = [];
  const collect = (questions: FormField[]): void => {
    questions.forEach((question) => {
      fields.push(question);
      if (question.questions) collect(question.questions);
    });
  };
  schema.pages.forEach((page) => {
    page.sections?.forEach((section) => {
      collect(section.questions ?? []);
    });
  });
  if (fields.some((field) => field.type === 'encounterRole')) return;

  const t = (key: string, fallback: string): string => translateFrom(formEngineAppName, key, fallback);
  const ids = new Set(fields.map((field) => field.id));
  let id = 'sihsalusEncounterRole';
  while (ids.has(id)) id += '_';

  // Use a visible page so a conditional/readonly section cannot hide a required selection.
  let page = schema.pages.find(
    (candidate) => !candidate.isSubform && !candidate.isHidden && !candidate.hide && !candidate.readonly,
  );
  if (!page) {
    let pageId = 'sihsalusEncounterDetails';
    while (schema.pages.some((candidate) => candidate.id === pageId)) pageId += '_';
    page = {
      id: pageId,
      label: t('encounterRoleDetails', 'Professional’s role'),
      sections: [],
    };
    schema.pages.unshift(page);
  }

  // The schema transformer has already run; initialize the same metadata and validators here.
  const roleField: FormField = {
    id,
    label: t('encounterRoleLabel', 'Professional’s role in this encounter'),
    questionInfo: t('encounterRoleHelp', 'Select the role of the professional responsible for this encounter.'),
    type: 'encounterRole',
    required: true,
    questionOptions: { rendering: 'encounter-role', isSearchable: false },
    validators: [{ type: 'form_field' }, { type: 'default_value' }],
    meta: {
      pageId: page.id,
      initialValue: { omrsObject: null, refinedValue: null },
      submission: null,
    },
  };
  const providerSection = page.sections.find(
    (section) =>
      !section.isHidden &&
      !section.hide &&
      !section.readonly &&
      section.questions.some((field) => field.type === 'encounterProvider' && !field.isHidden && !field.hide),
  );
  if (providerSection) {
    const providerIndex = providerSection.questions.findIndex((field) => field.type === 'encounterProvider');
    providerSection.questions.splice(providerIndex + 1, 0, roleField);
  } else {
    page.sections.unshift({
      label: t('encounterRoleDetails', 'Professional’s role'),
      isExpanded: 'true',
      questions: [roleField],
    });
  }
}

import { defineConfigSchema, getSyncLifecycle } from '@openmrs/esm-framework';
import { createDashboardLink } from '@openmrs/esm-patient-common-lib';

import { configSchema } from './config-schema';

import ContactList from './contact-list/contact-list.component';
import ContactListForm from './contact-list/contact-list.workspace';
import {
  familyHistoryDashboardMeta,
  otherRelationshipsDashboardMeta,
  relationshipsDashboardMeta,
} from './dashboard.meta';
import FamilyHistory from './family-partner-history/family-history.component';
import FamilyRelationshipForm from './family-partner-history/family-relationship.workspace';
import { OtherRelationships } from './other-relationships/other-relationships.component';
import { OtherRelationshipsForm } from './other-relationships/other-relationships.workspace';
import RelationshipUpdateForm from './relationships/forms/relationships-update-form.workspace';
import BirthDateCalculator from './relationships/modals/birthdate-calculator.modal';
import DeleteRelationshipConfirmDialog from './relationships/modals/delete-relationship-dialog.modal';
import Relationships from './relationships/relationships.component';

export const importTranslation = require.context('../translations', false, /.json$/, 'lazy');

const moduleName = '@sihsalus/esm-ficha-familiar-app';
const options = {
  featureName: 'ficha-familiar',
  moduleName,
};

export function startupApp(): void {
  defineConfigSchema(moduleName, configSchema);
}

// ================================================================================
// FAMILY HISTORY EXPORTS
// ================================================================================
export const familyHistory = getSyncLifecycle(FamilyHistory, options);
export const familyHistoryLink = getSyncLifecycle(
  createDashboardLink({ ...familyHistoryDashboardMeta, moduleName }),
  options,
);
export const familyRelationshipForm = getSyncLifecycle(FamilyRelationshipForm, options);

// ================================================================================
// OTHER RELATIONSHIPS EXPORTS
// ================================================================================
export const otherRelationships = getSyncLifecycle(OtherRelationships, options);
export const otherRelationshipsForm = getSyncLifecycle(OtherRelationshipsForm, options);
export const otherRelationshipsLink = getSyncLifecycle(
  createDashboardLink({ ...otherRelationshipsDashboardMeta, moduleName }),
  options,
);

// ================================================================================
// RELATIONSHIPS EXPORTS
// ================================================================================
export const birthDateCalculator = getSyncLifecycle(BirthDateCalculator, options);
export const relationshipDeleteConfirmDialog = getSyncLifecycle(DeleteRelationshipConfirmDialog, options);
export const relationships = getSyncLifecycle(Relationships, options);
export const relationshipUpdateForm = getSyncLifecycle(RelationshipUpdateForm, options);
// t('familyRecordTooltip', 'Ficha Familiar')
export const relationshipsLink = getSyncLifecycle(
  createDashboardLink({ ...relationshipsDashboardMeta, moduleName }),
  options,
);

// ================================================================================
// CONTACT LIST EXPORTS
// ================================================================================
export const contactList = getSyncLifecycle(ContactList, options);
export const contactListForm = getSyncLifecycle(ContactListForm, options);
export const contactListLink = getSyncLifecycle(
  createDashboardLink({
    ...{
      icon: 'omrs-icon-group',
      slot: 'patient-chart-relationships-slot',
      columns: 1,
      title: 'Contact List',
      path: 'contact-list',
      config: {},
    },
    moduleName,
  }),
  options,
);

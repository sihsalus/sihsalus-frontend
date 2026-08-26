import { defineConfigSchema, getAsyncLifecycle, getSyncLifecycle } from '@openmrs/esm-framework';

import { configSchema } from './config-schema';
import ContactUsComponent from './help-menu/components/contact-us.component';
import DocsComponent from './help-menu/components/docs.component';
import ReleaseNotesComponent from './help-menu/components/release-notes.component';

export const importTranslation = require.context('../translations', false, /.json$/, 'lazy');

const moduleName = '@sihsalus/esm-help-menu-app';

const options = {
  featureName: 'help-menu',
  moduleName,
};

export function startupApp() {
  defineConfigSchema(moduleName, configSchema);
}

export const root = getAsyncLifecycle(() => import('./root.component'), options);

export const releaseNotes = getSyncLifecycle(ReleaseNotesComponent, options);
export const docs = getSyncLifecycle(DocsComponent, options);
export const contact = getSyncLifecycle(ContactUsComponent, options);

import { showToast, UserHasAccess, useStore } from '@openmrs/esm-framework';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { hasInvalidDependencies } from './backend-dependencies/openmrs-backend-dependencies';
import { useBackendDependencies } from './backend-dependencies/useBackendDependencies';
import { useFrontendModules } from './hooks';
import styles from './implementer-tools.styles.scss';
import { implementerToolsStore, showModuleDiagnostics, togglePopup } from './store';

const Popup = React.lazy(() => import('./popup/popup.component'));
const UiEditor = React.lazy(() => import('./ui-editor/ui-editor'));

function PopupHandler() {
  const frontendModules = useFrontendModules();
  const { modules: backendDependencies, error: backendError } = useBackendDependencies();
  const [shouldShowNotification, setShouldShowNotification] = useState(false);
  const { t } = useTranslation();
  const missingDependencies = backendDependencies.flatMap((module) =>
    module.dependencies
      .filter((dependency) => dependency.type === 'missing')
      .map((dependency) => `${dependency.name} (${module.name})`),
  );
  const versionMismatches = backendDependencies.flatMap((module) =>
    module.dependencies
      .filter((dependency) => dependency.type === 'version-mismatch')
      .map((dependency) => `${dependency.name} ${dependency.installedVersion} -> ${dependency.requiredVersion}`),
  );
  const dependencyExamples = [...missingDependencies, ...versionMismatches].slice(0, 3).join(', ');

  useEffect(() => {
    // displaying actionable notification if backend modules have missing dependencies
    setShouldShowNotification(
      (alreadyShowing) => alreadyShowing || (backendError ? true : hasInvalidDependencies(backendDependencies)),
    );
  }, [backendDependencies, backendError]);

  useEffect(() => {
    // only show notification max. 1 time
    if (shouldShowNotification) {
      showToast({
        critical: false,
        kind: 'error',
        description: backendError
          ? t(
              'backendConnectionError',
              'Could not connect to backend to fetch module list. Check the Implementer Tools for details.',
            )
          : t('missingBackendDependenciesMessage', {
              defaultValue:
                '{{missingCount}} backend module(s) are missing and {{versionMismatchCount}} have incompatible versions. Check the Backend Modules tab in the Implementer Tools for details. Examples: {{examples}}',
              missingCount: missingDependencies.length,
              versionMismatchCount: versionMismatches.length,
              examples: dependencyExamples || t('none', 'None'),
              interpolation: { escapeValue: false },
            }),
        title: backendError
          ? t('backendConnectionProblem', 'Backend Connection Problem')
          : t('modulesWithMissingDependenciesWarning', 'Some modules have unresolved backend dependencies'),
        actionButtonLabel: t('viewModules', 'View modules'),
        onActionButtonClick: showModuleDiagnostics,
      });
    }
  }, [
    t,
    shouldShowNotification,
    backendError,
    missingDependencies.length,
    versionMismatches.length,
    dependencyExamples,
  ]);

  const { isOpen, isUIEditorEnabled, openTabIndex } = useStore(implementerToolsStore);

  return (
    <div className={styles.darkTheme}>
      {isOpen ? (
        <Popup
          close={togglePopup}
          frontendModules={frontendModules}
          backendDependencies={backendDependencies}
          backendError={backendError}
          visibleTabIndex={openTabIndex}
        />
      ) : null}
      {isUIEditorEnabled ? <UiEditor /> : null}
    </div>
  );
}

export default function ImplementerTools() {
  return (
    <UserHasAccess privilege="O3 Implementer Tools">
      <PopupHandler />
    </UserHasAccess>
  );
}

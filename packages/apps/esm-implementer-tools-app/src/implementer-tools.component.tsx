import { showToast, UserHasAccess, useStore } from '@openmrs/esm-framework';
import React, { useEffect, useRef } from 'react';
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
  const {
    modules: backendDependencies,
    error: backendError,
    errorStatus: backendErrorStatus,
    isRetrying: isRetryingBackendDependencies,
    retry: retryBackendDependencies,
  } = useBackendDependencies();
  const hasShownNotification = useRef(false);
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
  const missingCount = missingDependencies.length;
  const versionMismatchCount = versionMismatches.length;
  const dependencyExamples = [...missingDependencies, ...versionMismatches].slice(0, 3).join(', ');
  const dependencyExamplesDescription = `${t('examples', 'Examples')}: ${dependencyExamples || t('none', 'None')}`;

  // Only the categories that actually have findings are reported. Naming a
  // category that scored zero ("0 backend modules are missing and 1 has an
  // incompatible version") buries the one fact the implementer needs.
  const dependencySummary =
    missingCount > 0 && versionMismatchCount > 0
      ? t(
          'missingAndIncompatibleBackendModules',
          '{{missingCount}} backend module(s) are missing and {{versionMismatchCount}} have incompatible versions.',
          { missingCount, versionMismatchCount },
        )
      : missingCount > 0
        ? t('missingBackendModulesCount', '{{count}} backend module is missing.', { count: missingCount })
        : t('incompatibleBackendModulesCount', '{{count}} backend module has an incompatible version.', {
            count: versionMismatchCount,
          });

  // A module that is present but a version behind still lets the app run, so it
  // is a warning; a module that is absent breaks whatever depends on it.
  const notificationKind = missingCount > 0 ? 'error' : 'warning';
  const notificationTitle =
    missingCount > 0
      ? t('modulesWithMissingDependenciesWarning', 'Some modules have unresolved backend dependencies')
      : t('modulesWithIncompatibleVersionsWarning', 'Some modules need a different backend version');

  useEffect(() => {
    // This inventory is an implementer-only background diagnostic. A transient
    // fetch failure must not interrupt the user's active workflow with a global
    // toast; the error remains available inside the Backend Modules tab.
    const shouldShowNotification = !backendError && hasInvalidDependencies(backendDependencies);
    if (!shouldShowNotification || hasShownNotification.current) {
      return;
    }

    hasShownNotification.current = true;
    showToast({
      critical: false,
      kind: notificationKind,
      description: `${dependencySummary} ${t(
        'checkBackendModulesTab',
        'Check the Backend Modules tab in the Implementer Tools for details.',
      )} ${dependencyExamplesDescription}`,
      title: notificationTitle,
      actionButtonLabel: t('viewModules', 'View modules'),
      onActionButtonClick: showModuleDiagnostics,
    });
  }, [
    t,
    backendDependencies,
    backendError,
    dependencySummary,
    notificationKind,
    notificationTitle,
    dependencyExamplesDescription,
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
          backendErrorStatus={backendErrorStatus}
          isRetryingBackendDependencies={isRetryingBackendDependencies}
          retryBackendDependencies={retryBackendDependencies}
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

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
  const dependencyExamples = [...missingDependencies, ...versionMismatches].slice(0, 3).join(', ');
  const dependencyExamplesDescription = `${t('examples', 'Examples')}: ${dependencyExamples || t('none', 'None')}`;
  const backendErrorTitle =
    backendErrorStatus === 401
      ? t('backendAuthenticationProblem', 'Authentication required')
      : backendErrorStatus === 403
        ? t('backendAuthorizationProblem', 'Insufficient permissions')
        : backendErrorStatus === 502 || backendErrorStatus === 503 || backendErrorStatus === 504
          ? t('backendTemporarilyUnavailable', 'Backend temporarily unavailable')
          : t('backendConnectionProblem', 'Backend Connection Problem');
  const backendErrorDescription =
    backendErrorStatus === 401
      ? t('backendAuthenticationHint', 'Your session expired or is not authenticated. Sign in again and retry.')
      : backendErrorStatus === 403
        ? t(
            'backendAuthorizationHint',
            'Your account is not allowed to view the installed backend modules. Contact an administrator.',
          )
        : backendErrorStatus === 502 || backendErrorStatus === 503 || backendErrorStatus === 504
          ? t(
              'backendTemporaryHint',
              'The backend returned a temporary gateway error. The automatic retries were exhausted.',
            )
          : t(
              'backendConnectionError',
              'Could not connect to backend to fetch module list. Check the Implementer Tools for details.',
            );

  useEffect(() => {
    const shouldShowNotification = Boolean(backendError) || hasInvalidDependencies(backendDependencies);
    if (!shouldShowNotification || hasShownNotification.current) {
      return;
    }

    hasShownNotification.current = true;
    showToast({
      critical: false,
      kind: 'error',
      description: backendError
        ? backendErrorDescription
        : `${t('missingBackendDependenciesMessage', {
            defaultValue:
              '{{missingCount}} backend module(s) are missing and {{versionMismatchCount}} have incompatible versions. Check the Backend Modules tab in the Implementer Tools for details.',
            missingCount: missingDependencies.length,
            versionMismatchCount: versionMismatches.length,
          })} ${dependencyExamplesDescription}`,
      title: backendError
        ? backendErrorTitle
        : t('modulesWithMissingDependenciesWarning', 'Some modules have unresolved backend dependencies'),
      actionButtonLabel: t('viewModules', 'View modules'),
      onActionButtonClick: showModuleDiagnostics,
    });
  }, [
    t,
    backendDependencies,
    backendError,
    backendErrorDescription,
    backendErrorTitle,
    missingDependencies.length,
    versionMismatches.length,
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

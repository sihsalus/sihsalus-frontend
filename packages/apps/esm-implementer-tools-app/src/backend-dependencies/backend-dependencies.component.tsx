import {
  Button,
  DataTable,
  InlineNotification,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '@carbon/react';
import React, { Fragment, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import styles from './backend-dependencies.styles.scss';
import type { ResolvedDependenciesModule } from './openmrs-backend-dependencies';

export interface BackendDependenciesProps {
  backendDependencies: Array<ResolvedDependenciesModule>;
  error?: string | null;
  errorStatus?: number | null;
  isRetrying?: boolean;
  onRetry?(): void;
}

export const BackendDependencies: React.FC<BackendDependenciesProps> = ({
  backendDependencies,
  error,
  errorStatus,
  isRetrying = false,
  onRetry,
}) => {
  const { t } = useTranslation();

  const headers = useMemo(
    () => [
      {
        key: 'name',
        header: t('moduleName', 'Module Name'),
      },
      {
        key: 'installedVersion',
        header: t('installedVersion', 'Installed version'),
      },
      {
        key: 'requiredVersion',
        header: t('requiredVersion', 'Required version'),
      },
    ],
    [t],
  );

  if (error) {
    const isAuthenticationError = errorStatus === 401;
    const isAuthorizationError = errorStatus === 403;
    const isTemporaryBackendError = errorStatus === 502 || errorStatus === 503 || errorStatus === 504;
    const notificationTitle = isAuthenticationError
      ? t('backendAuthenticationProblem', 'Authentication required')
      : isAuthorizationError
        ? t('backendAuthorizationProblem', 'Insufficient permissions')
        : isTemporaryBackendError
          ? t('backendTemporarilyUnavailable', 'The check could not be completed')
          : t('backendConnectionProblem', 'The check could not be completed');
    const errorHint = isAuthenticationError
      ? t('backendAuthenticationHint', 'Your session expired or is not authenticated. Sign in again and retry.')
      : isAuthorizationError
        ? t(
            'backendAuthorizationHint',
            'Your account is not allowed to view the installed backend modules. Contact an administrator.',
          )
        : isTemporaryBackendError
          ? t('backendTemporaryHint', 'The service is temporarily unavailable. Check your connection and try again.')
          : t(
              'backendConnectionHint',
              'The system configuration could not be checked. Check your connection and try again.',
            );
    const showGenericHints = !isAuthenticationError && !isAuthorizationError && !isTemporaryBackendError;

    return (
      <div className={styles.container}>
        <InlineNotification
          kind="error"
          title={notificationTitle}
          subtitle={errorHint}
          className={styles.errorNotification}
        />
        {showGenericHints ? (
          <ul className={styles.errorHintList}>
            <li>{t('hint1', 'The backend server is not running or not reachable')}</li>
            <li>{t('hint2', 'Authentication failed or session expired')}</li>
            <li>{t('hint3', 'Network connectivity issues between frontend and backend')}</li>
          </ul>
        ) : null}
        {onRetry ? (
          <Button
            className={styles.retryButton}
            disabled={isRetrying}
            kind="tertiary"
            onClick={onRetry}
            size="sm"
            type="button"
          >
            {isRetrying ? t('retrying', 'Retrying…') : t('retry', 'Retry')}
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <DataTable rows={[]} headers={headers}>
        {({ headers, getTableProps, getHeaderProps }) => (
          <TableContainer title="">
            <Table {...getTableProps()}>
              <TableHead>
                <TableRow>
                  {headers.map((header) => {
                    const { key, ...headerProps } = getHeaderProps({ header });
                    return (
                      <TableHeader key={key} {...headerProps}>
                        {header.header}
                      </TableHeader>
                    );
                  })}
                </TableRow>
              </TableHead>
              <TableBody>
                {backendDependencies.map((esm) => (
                  <Fragment key={esm.name}>
                    <TableRow>
                      <TableCell>
                        <span className={styles.moduleHeader}>{esm.name}</span>
                      </TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                    {esm.dependencies.map((dep) => (
                      <TableRow key={dep.name}>
                        <TableCell>{dep.name}</TableCell>
                        <TableCell>
                          {dep.type === 'missing' ? (
                            <span className={styles.versionError}>{t('missing', 'Missing')}</span>
                          ) : dep.type === 'version-mismatch' ? (
                            <span className={styles.versionError}>{dep.installedVersion}</span>
                          ) : (
                            <span>{dep.installedVersion}</span>
                          )}
                        </TableCell>
                        <TableCell>{dep.requiredVersion}</TableCell>
                      </TableRow>
                    ))}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DataTable>
    </div>
  );
};

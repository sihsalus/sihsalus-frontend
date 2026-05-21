import {
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
}

export const BackendDependencies: React.FC<BackendDependenciesProps> = ({ backendDependencies, error }) => {
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
    return (
      <div className={styles.container}>
        <InlineNotification
          kind="error"
          title={t('backendConnectionProblem', 'Backend Connection Problem')}
          subtitle={error}
          className={styles.errorNotification}
        />
        <p className={styles.errorHint}>
          {t(
            'backendConnectionHint',
            'The frontend was unable to connect to the backend to fetch installed modules. This could mean:',
          )}
        </p>
        <ul className={styles.errorHintList}>
          <li>{t('hint1', 'The backend server is not running or not reachable')}</li>
          <li>{t('hint2', 'Authentication failed or session expired')}</li>
          <li>{t('hint3', 'Network connectivity issues between frontend and backend')}</li>
        </ul>
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

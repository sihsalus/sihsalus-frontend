import { formatDatetime } from '@openmrs/esm-framework';
import classNames from 'classnames';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { type Import, isRunningImport } from '../../types';

import ImportItems from './import-items.component';
import styles from './import-overview.scss';

interface ImportOverviewProps {
  selectedImportObject: Import;
}

const ImportOverview: React.FC<ImportOverviewProps> = ({ selectedImportObject }) => {
  const { t } = useTranslation();

  return (
    <div>
      <span className={styles.heading01}>{t('startedOn', 'Started on')} </span>
      <span className="body">{formatDatetime(new Date(selectedImportObject.localDateStarted))}</span>
      <br />

      <span className={styles.heading01}>{t('completedOn', 'Completed on')} </span>
      <span className="body">
        {isRunningImport(selectedImportObject)
          ? t('inProgress', 'In progress')
          : formatDatetime(new Date(selectedImportObject.localDateStopped))}
      </span>
      <br />

      <span className={styles.heading01}>{t('duration', 'Duration')} </span>
      <span className="body">{selectedImportObject.importTime}</span>
      <br />
      <br />

      <span className={styles.heading01}>{t('result', 'Result:')} </span>
      <br />

      <div className={classNames('body', styles.indentedContent)}>
        <span>
          {selectedImportObject.upToDateItemsCount} {t('conceptsUpToDate', 'concepts up to date')}
        </span>
        <br />
        <span>
          {selectedImportObject.addedItemsCount} {t('conceptsAdded', 'concepts added')}
        </span>
        <br />
        <span>
          {selectedImportObject.updatedItemsCount} {t('conceptsUpdated', 'concepts updated')}
        </span>
        <br />
        <span>
          {selectedImportObject.retiredItemsCount} {t('conceptsRetired', 'concepts retired')}
        </span>
        <br />
        <span>
          {selectedImportObject.errorItemsCount} {t('errorsFound', 'errors found')}
        </span>
        <br />
        <span>
          {selectedImportObject.ignoredErrorsCount} {t('errorsIgnored', 'errors ignored')}
        </span>
        <br />
      </div>
      <br />
      {selectedImportObject.errorItemsCount !== 0 && <ImportItems importUuid={selectedImportObject.uuid} />}
    </div>
  );
};

export default ImportOverview;

import { DataTableSkeleton } from '@carbon/react';
import { formatDatetime, ResponsiveWrapper, useLayoutType } from '@openmrs/esm-framework';
import { debounce } from 'lodash-es';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import styles from './forms-list.scss';
import FormsTable from './forms-table.component';
import type { CompletedFormInfo, Form } from './types';

export type FormsListProps = {
  completedForms?: Array<CompletedFormInfo>;
  error?: Error;
  sectionName?: string;
  handleFormOpen: (form: Form, encounterUuid: string) => void;
};

const FormsList: React.FC<FormsListProps> = ({ completedForms, error, sectionName = 'forms', handleFormOpen }) => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const isTablet = useLayoutType() === 'tablet';

  const handleSearch = useMemo(() => debounce((searchTerm) => setSearchTerm(searchTerm), 300), []);

  const filteredForms = useMemo(() => {
    if (!searchTerm) {
      return completedForms;
    }

    return completedForms?.filter((formInfo) => {
      const formName = formInfo.form.display ?? formInfo.form.name;
      return formName.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [completedForms, searchTerm]);

  const tableHeaders = useMemo(() => {
    return [
      {
        header: t('formName', 'Nombre del Formulario (A-Z)'),
        key: 'formName',
      },
      {
        header: t('lastCompleted', 'Última Vez Completado'),
        key: 'lastCompleted',
      },
    ];
  }, [t]);

  const tableRows = useMemo(
    () =>
      filteredForms?.map((formData) => {
        return {
          id: formData.form.uuid,
          lastCompleted: formData.lastCompletedDate ? formatDatetime(formData.lastCompletedDate) : undefined,
          formName: formData.form.display ?? formData.form.name,
          formUuid: formData.form.uuid,
          encounterUuid: formData?.associatedEncounters[0]?.uuid,
          form: formData.form,
        };
      }) ?? [],
    [filteredForms],
  );

  if (!completedForms && !error) {
    return <DataTableSkeleton role="progressbar" />;
  }

  if (completedForms?.length === 0) {
    return (
      <ResponsiveWrapper>
        <div className={isTablet ? styles.tabletHeading : styles.desktopHeading}>
          <h4>{t(sectionName)}</h4>
        </div>
      </ResponsiveWrapper>
    );
  }

  if (sectionName === 'forms') {
    return (
      <ResponsiveWrapper>
        <FormsTable
          tableHeaders={tableHeaders}
          tableRows={tableRows}
          isTablet={isTablet}
          handleSearch={handleSearch}
          handleFormOpen={handleFormOpen}
        />
      </ResponsiveWrapper>
    );
  } else {
    return (
      <ResponsiveWrapper>
        <div className={isTablet ? styles.tabletHeading : styles.desktopHeading}>
          <h4>{t(sectionName)}</h4>
        </div>
        <FormsTable
          tableHeaders={tableHeaders}
          tableRows={tableRows}
          isTablet={isTablet}
          handleSearch={handleSearch}
          handleFormOpen={handleFormOpen}
        />
      </ResponsiveWrapper>
    );
  }
};

export default FormsList;

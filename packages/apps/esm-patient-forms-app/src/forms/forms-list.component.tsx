import { DataTableSkeleton } from '@carbon/react';
import { formatDatetime, ResponsiveWrapper, useLayoutType } from '@openmrs/esm-framework';
import fuzzy from 'fuzzy';
import { debounce } from 'lodash-es';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { CompletedFormInfo, Form } from '../types';

import styles from './forms-list.scss';
import FormsTable from './forms-table.component';

export type FormsListProps = {
  forms?: Array<CompletedFormInfo>;
  error?: unknown;
  sectionName?: string;
  handleFormOpen: (form: Form, encounterUuid?: string) => void;
};

/*
 * For the benefit of our automated translations:
 * t('forms', 'Forms')
 */

const FormsList: React.FC<FormsListProps> = ({ forms, error, sectionName, handleFormOpen }) => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('');
  const isTablet = useLayoutType() === 'tablet';
  const [, setLocale] = useState(globalThis.i18next?.language ?? navigator.language);

  useEffect(() => {
    if (globalThis.i18next?.on) {
      const languageChanged = (lng: string) => setLocale(lng);
      globalThis.i18next.on('languageChanged', languageChanged);
      return () => globalThis.i18next.off('languageChanged', languageChanged);
    }
  }, []);

  const handleSearch = useMemo(() => debounce((searchTerm) => setSearchTerm(searchTerm), 300), []);

  const getFormUnit = useCallback((form: Form) => {
    const formName = form.display ?? form.name;
    const parenthesizedPrefix = formName.match(/^\(([^)]+)\)/)?.[1]?.trim();

    if (parenthesizedPrefix) {
      return parenthesizedPrefix.replace(/\s+\d+.*/, '').trim();
    }

    const hyphenPrefix = formName.match(/^([A-ZÁÉÍÓÚÑ]{2,})(?:-\d+|\s+-)/)?.[1]?.trim();

    if (hyphenPrefix) {
      return hyphenPrefix;
    }

    return '';
  }, []);

  const unitOptions = useMemo(() => {
    const units = new Set<string>();
    forms?.forEach((formInfo) => {
      const unit = getFormUnit(formInfo.form);

      if (unit) {
        units.add(unit);
      }
    });

    return Array.from(units).sort((a, b) => a.localeCompare(b));
  }, [forms, getFormUnit]);

  const filteredForms = useMemo(() => {
    const unitFilteredForms = selectedUnit
      ? forms?.filter((formInfo) => getFormUnit(formInfo.form) === selectedUnit)
      : forms;

    if (!searchTerm) {
      return unitFilteredForms;
    }

    return fuzzy
      .filter(searchTerm, unitFilteredForms, { extract: (formInfo) => formInfo.form.display ?? formInfo.form.name })
      .sort((r1, r2) => r1.score - r2.score)
      .map((result) => result.original);
  }, [forms, searchTerm, selectedUnit, getFormUnit]);

  const tableHeaders = useMemo(() => {
    return [
      {
        header: t('formName', 'Form name (A-Z)'),
        key: 'formName',
      },
      {
        header: t('lastCompleted', 'Last completed'),
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

  if (!forms && !error) {
    return <DataTableSkeleton role="progressbar" />;
  }

  if (forms?.length === 0) {
    return <></>;
  }

  return (
    <ResponsiveWrapper>
      {sectionName && (
        <div className={isTablet ? styles.tabletHeading : styles.desktopHeading}>
          <h4>{t(sectionName)}</h4>
        </div>
      )}
      <FormsTable
        tableHeaders={tableHeaders}
        tableRows={tableRows}
        unitOptions={unitOptions}
        selectedUnit={selectedUnit}
        isTablet={isTablet}
        handleSearch={handleSearch}
        handleUnitChange={setSelectedUnit}
        handleFormOpen={handleFormOpen}
      />
    </ResponsiveWrapper>
  );
};

export default FormsList;

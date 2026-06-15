import {
  Button,
  DataTable,
  Layer,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  TableToolbarContent,
  TableToolbarSearch,
  Tile,
} from '@carbon/react';
import { EditIcon, formatDatetime, useConfig, useLayoutType, usePagination } from '@openmrs/esm-framework';
import {
  EmptyDataIllustration,
  launchPatientWorkspace,
  PatientChartPagination,
  useVisitOrOfflineVisit,
} from '@openmrs/esm-patient-common-lib';
import classNames from 'classnames';
import debounce from 'lodash-es/debounce';
import React, { type ComponentProps, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { type ConfigObject } from '../config-schema';
import { launchFormEntryOrHtmlForms } from '../form-entry-interop';
import { type CompletedFormInfo } from '../types';

import styles from './form-view.scss';

const renderEditIcon = (props: ComponentProps<typeof EditIcon>) => (EditIcon ? <EditIcon {...props} /> : null);

type FormsCategory = 'All' | 'Completed' | 'Recommended';

interface FormViewProps {
  category?: FormsCategory;
  forms: Array<CompletedFormInfo>;
  patientUuid: string;
  patient: fhir.Patient;
  pageSize: number;
  pageUrl: string;
  urlLabel: string;
  mutateForms?: () => void;
}

const FormView: React.FC<FormViewProps> = ({
  category,
  forms,
  patientUuid,
  patient,
  pageSize,
  pageUrl,
  urlLabel,
  mutateForms,
}) => {
  const { t } = useTranslation();
  const { htmlFormEntryForms } = useConfig<ConfigObject>();
  const isTablet = useLayoutType() === 'tablet';
  const { currentVisit } = useVisitOrOfflineVisit(patientUuid);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredForms = useMemo(() => {
    if (!searchTerm) {
      return forms;
    }
    return forms.filter((form) => {
      const formName = form.form.display ?? form.form.name;
      return formName.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [forms, searchTerm]);

  const handleSearch = React.useMemo(() => debounce((searchTerm) => setSearchTerm(searchTerm), 300), []);

  const { results, goTo, currentPage } = usePagination(
    filteredForms?.sort((a, b) => (a.form?.display > b.form?.display ? 1 : -1)),
    pageSize,
  );

  const tableHeaders = useMemo(
    () => [
      { key: 'formName', header: t('formName', 'Form name (A-Z)') },
      {
        key: 'lastCompleted',
        header: t('lastCompleted', 'Last completed'),
      },
    ],
    [t],
  );

  const tableRows = useMemo(
    () =>
      results?.map((formInfo) => {
        return {
          id: formInfo.form.uuid,
          lastCompleted: formInfo.lastCompletedDate ? formatDatetime(formInfo.lastCompletedDate) : undefined,
          formName: formInfo.form.display ?? formInfo.form.name,
          formUuid: formInfo.form.uuid,
          encounterUuid: formInfo?.associatedEncounters[0]?.uuid,
        };
      }),
    [results],
  );

  const launchFormWorkspace = React.useCallback(
    (formInfo: CompletedFormInfo, encounterUuid?: string) => {
      if (encounterUuid) {
        launchPatientWorkspace('patient-form-entry-workspace', {
          workspaceTitle: formInfo.form.display ?? formInfo.form.name,
          form: formInfo.form,
          encounterUuid,
          handlePostResponse: () => mutateForms?.(),
        });
        return;
      }

      launchFormEntryOrHtmlForms(
        currentVisit ?? undefined,
        formInfo.form.uuid,
        patient,
        htmlFormEntryForms,
        undefined,
        formInfo.form.display ?? formInfo.form.name,
        mutateForms,
      );
    },
    [currentVisit, htmlFormEntryForms, mutateForms, patient],
  );

  if (!forms?.length) {
    return (
      <Layer>
        <Tile className={styles.tile}>
          <EmptyDataIllustration />
          <p className={styles.content}>
            {t('noMatchingFormsAvailable', 'There are no {{formCategory}} forms to display', {
              formCategory: category?.toLowerCase(),
            })}
          </p>
          <p className={styles.helper}>{t('formSearchHint', 'Try using an alternative name or keyword')}</p>
        </Tile>
      </Layer>
    );
  }

  return (
    <div className={styles.formContainer}>
      {forms?.length > 0 && (
        <>
          <DataTable
            headers={tableHeaders}
            rows={tableRows}
            size={isTablet ? 'lg' : 'sm'}
            isSortable
            useZebraStyles
            overflowMenuOnHover={false}
          >
            {({ rows, headers, getHeaderProps, getTableProps, getToolbarProps }) => (
              <TableContainer className={styles.tableContainer}>
                <TableToolbarContent {...getToolbarProps()} style={{ justifyContent: 'flex-start' }}>
                  <Layer style={{ width: '100%' }}>
                    <TableToolbarSearch
                      persistent
                      expanded
                      onChange={(_, value) => handleSearch(value ?? '')}
                      placeholder={t('searchForAForm', 'Search for a form')}
                      size={isTablet ? 'lg' : 'sm'}
                    />
                  </Layer>
                </TableToolbarContent>
                <Table {...getTableProps()} className={styles.table}>
                  <TableHead>
                    <TableRow>
                      {headers.map((header) => (
                        <TableHeader
                          key={header.key}
                          className={classNames(styles.heading, styles.text02)}
                          {...getHeaderProps({
                            header,
                            isSortable: header.isSortable,
                          })}
                        >
                          {header.header}
                        </TableHeader>
                      ))}
                      <TableHeader />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((row, _index) => {
                      const formInfo = results.find(
                        (result) =>
                          result.form.display === row.cells[0].value || result.form.name === row.cells[0].value,
                      );

                      return (
                        <TableRow key={row.id}>
                          <TableCell>
                            <button
                              type="button"
                              onClick={() => {
                                if (!formInfo) {
                                  return;
                                }

                                launchFormWorkspace(formInfo);
                              }}
                              className={styles.formNameButton}
                            >
                              {row.cells[0].value}
                            </button>
                          </TableCell>
                          <TableCell>
                            <button
                              type="button"
                              onClick={() =>
                                formInfo && launchFormWorkspace(formInfo, formInfo.associatedEncounters?.[0]?.uuid)
                              }
                              className={styles.formNameButton}
                            >
                              {row.cells[1].value}
                            </button>
                          </TableCell>
                          <TableCell className="cds--table-column-menu">
                            {row.cells[0].value && (
                              <Button
                                hasIconOnly
                                renderIcon={renderEditIcon}
                                aria-label={t('editForm', 'Edit form')}
                                iconDescription={t('editForm', 'Edit form')}
                                onClick={() =>
                                  formInfo && launchFormWorkspace(formInfo, formInfo.associatedEncounters?.[0]?.uuid)
                                }
                                size={isTablet ? 'lg' : 'sm'}
                                kind="ghost"
                                tooltipPosition="left"
                              />
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {rows.length === 0 ? (
                  <div className={styles.tileContainer}>
                    <Tile className={styles.tile}>
                      <div className={styles.tileContent}>
                        <p className={styles.content}>
                          {t('noMatchingFormsToDisplay', 'No matching forms to display')}
                        </p>
                      </div>
                    </Tile>
                  </div>
                ) : null}
              </TableContainer>
            )}
          </DataTable>
          <PatientChartPagination
            pageNumber={currentPage}
            totalItems={filteredForms?.length}
            currentItems={results.length}
            pageSize={pageSize}
            onPageNumberChange={({ page }) => goTo(page)}
            dashboardLinkUrl={pageUrl}
            dashboardLinkLabel={urlLabel}
          />
        </>
      )}
    </div>
  );
};

export default FormView;

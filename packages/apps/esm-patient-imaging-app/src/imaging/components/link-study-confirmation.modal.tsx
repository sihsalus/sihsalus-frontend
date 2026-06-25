import {
  Button,
  DataTable,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '@carbon/react';
import { showSnackbar, useLayoutType } from '@openmrs/esm-framework';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { updateStudyLinkStatus, useStudiesByPatient } from '../../api';
import styles from './details-table.scss';

interface LinkStudyModalProps {
  closeLinkingStudyModal: () => void;
  linkStatus: number;
  comparisonResult: string;
  studyId: number;
  patientUuid: string;
}

const LinkingStudyModal: React.FC<LinkStudyModalProps> = ({
  closeLinkingStudyModal: closeLinkingStudyModal,
  linkStatus,
  comparisonResult,
  studyId,
  patientUuid,
}) => {
  const { t } = useTranslation();
  const { mutate } = useStudiesByPatient(patientUuid);
  const layout = useLayoutType();
  const isTablet = layout === 'tablet';

  const parsedComparisonResult = comparisonResult ? JSON.parse(comparisonResult) : { score: 0, differences: [] };

  const handleConfirmLinkingStudy = useCallback(async () => {
    try {
      await updateStudyLinkStatus(linkStatus, studyId, new AbortController());
      mutate();
      closeLinkingStudyModal();
      showSnackbar({
        isLowContrast: true,
        kind: 'success',
        title:
          linkStatus === 0
            ? t('linkStudyConfirm', 'Study link is confirmed')
            : t('linkStudyChanged', 'Study link is changed'),
      });
    } catch (err: any) {
      showSnackbar({
        isLowContrast: false,
        kind: 'error',
        title: t('errorStudyLinking', 'An error occured while linking image study'),
        subtitle: err?.message,
      });
    }
  }, [closeLinkingStudyModal, linkStatus, studyId, mutate, t]);

  const tableHeader = [
    { key: 'tag', header: t('dataName', 'Data Name') },
    { key: 'fromOpenmrs', header: t('fromOpenmrs', 'From OpenMRS') },
    { key: 'fromPacs', header: t('fromPacs', 'From Orthanc') },
  ];

  const tableRows = parsedComparisonResult?.differences.map((row, index) => ({
    id: `row-${index}`,
    tag: (
      <div>
        <span>{row.tag}</span>
      </div>
    ),
    fromOpenmrs: (
      <div>
        <span>{row.fromOpenmrs}</span>
      </div>
    ),
    fromPacs: (
      <div>
        <span>{row.fromPacs}</span>
      </div>
    ),
  }));

  return (
    <div>
      <ModalHeader closeModal={closeLinkingStudyModal} title={t('linkingImageStudy', 'Study linking')} />
      <ModalBody>
        <div style={{ marginBottom: '10px' }}>
          <h4 id="matchingScoreTitle">
            {t('calculatedMatchingScore', 'Calculated matching score: ')} {parsedComparisonResult?.score + '%'}
          </h4>
        </div>
        <div style={{ marginBottom: '10px' }}>
          <h4 id="matchingTableTitle">{t('comparisonDifferences', 'Differences:')}</h4>
        </div>
        {parsedComparisonResult?.differences.length > 0 ? (
          <DataTable
            rows={tableRows}
            headers={tableHeader}
            useZebraStyles
            data-floating-menu-container
            size={isTablet ? 'lg' : 'sm'}
          >
            {({ rows, headers, getHeaderProps, getTableProps, getRowProps }) => (
              <TableContainer>
                <Table aria-label="Comparison Table" className={styles.table} {...getTableProps()}>
                  <TableHead>
                    <TableRow>
                      {headers.map((header) => (
                        <TableHeader key={header.key} {...getHeaderProps({ header })}>
                          {header.header}
                        </TableHeader>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id} className={styles.row} {...getRowProps({ row })}>
                        {row.cells.map((cell) => (
                          <TableCell className={styles.tableCell} key={cell.id}>
                            {cell.value}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </DataTable>
        ) : (
          <div className={styles.emptyState} style={{ color: 'red' }}>
            {t('noComparisonData', 'No comparison data available')}
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        <Button kind="primary" onClick={closeLinkingStudyModal} data-testid="footer-close-button">
          {t('close', 'Close')}
        </Button>
        <Button kind="secondary" onClick={handleConfirmLinkingStudy}>
          {t('confirm', 'Confirm')}
        </Button>
      </ModalFooter>
    </div>
  );
};

export default LinkingStudyModal;

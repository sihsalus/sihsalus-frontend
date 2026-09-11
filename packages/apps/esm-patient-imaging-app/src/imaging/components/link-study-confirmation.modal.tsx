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
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { updateStudyLinkStatus, useStudiesByPatient } from '../../api';
import { z } from 'zod';
import { useImagingOperation } from '../utils/use-imaging-operation';
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
  const { start, isCurrent, finish, isPending, canWrite } = useImagingOperation(
    `${patientUuid}:${studyId}:${linkStatus}`,
  );
  const { mutate } = useStudiesByPatient(patientUuid);
  const layout = useLayoutType();
  const isTablet = layout === 'tablet';

  const parsedComparisonResult = useMemo(() => {
    try {
      const result = z
        .object({
          score: z.number().min(0).max(100),
          differences: z.array(
            z.object({
              tag: z.string(),
              fromOpenmrs: z.string().nullable(),
              fromPacs: z.string().nullable(),
            }),
          ),
        })
        .safeParse(JSON.parse(comparisonResult));
      return result.success ? result.data : null;
    } catch {
      return null;
    }
  }, [comparisonResult]);

  const handleConfirmLinkingStudy = useCallback(async () => {
    if (!parsedComparisonResult) return;
    const controller = start();
    if (!controller) return;
    try {
      await updateStudyLinkStatus(linkStatus, studyId, controller);
      if (!isCurrent(controller)) return;
      void Promise.resolve()
        .then(() => mutate())
        .catch(() => {
          /* The patient study list exposes refresh errors. */
        });
      closeLinkingStudyModal();
      showSnackbar({
        isLowContrast: true,
        kind: 'success',
        title:
          linkStatus === 0
            ? t('linkStudyConfirm', 'Study link is confirmed')
            : t('linkStudyChanged', 'Study link is changed'),
      });
    } catch {
      if (!isCurrent(controller)) return;
      showSnackbar({
        isLowContrast: false,
        kind: 'error',
        title: t('errorStudyLinking', 'An error occured while linking image study'),
        subtitle: t(
          'imagingOperationFailed',
          'The operation could not be completed. Refresh and check the result before trying again.',
        ),
      });
    } finally {
      finish(controller);
    }
  }, [closeLinkingStudyModal, linkStatus, studyId, mutate, t, start, isCurrent, finish, parsedComparisonResult]);

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
            {t('calculatedMatchingScore', 'Calculated matching score: ')}{' '}
            {parsedComparisonResult ? `${parsedComparisonResult.score}%` : '—'}
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
        <Button
          kind="secondary"
          onClick={handleConfirmLinkingStudy}
          disabled={isPending || !canWrite || !parsedComparisonResult}
        >
          {t('confirm', 'Confirm')}
        </Button>
      </ModalFooter>
    </div>
  );
};

export default LinkingStudyModal;

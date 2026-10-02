import { Button, InlineLoading, InlineNotification, ModalBody, ModalFooter, ModalHeader } from '@carbon/react';
import { formatDate, useSession, userHasAccess } from '@openmrs/esm-framework';
import { Fragment, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useReactToPrint } from 'react-to-print';
import useSWR from 'swr';
import { laboratoryPrivilege } from '../../constants';
import {
  fetchLabOrderResults,
  getResultPatientUuid,
  type LabResultObservation,
} from '../../laboratory-results.resource';
import type { LabResultModalProps } from './edit-lab-results-modal.component';
import styles from './lab-result-actions.scss';

export default function PrintLabResultsModal({ orders, closeModal }: LabResultModalProps) {
  const { t } = useTranslation();
  const session = useSession();
  const canView = userHasAccess(laboratoryPrivilege, session?.user);
  const patientUuid = getResultPatientUuid(orders);
  const eligible = canView && patientUuid && orders.every((order) => order.fulfillerStatus === 'COMPLETED');
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    eligible
      ? [
          'laboratory-print-results',
          orders.map((order) => [order.uuid, order.patient.uuid, order.encounter.uuid, order.concept.uuid]),
        ]
      : null,
    () => fetchLabOrderResults(orders),
    { revalidateOnMount: true, revalidateOnFocus: false, shouldRetryOnError: false },
  );
  const contentRef = useRef<HTMLDivElement>(null);
  const [printError, setPrintError] = useState(false);
  const [printing, setPrinting] = useState(false);
  const print = useReactToPrint({
    contentRef,
    documentTitle: t('labResultsReport', 'Laboratory results'),
    suppressErrors: true,
    onAfterPrint: () => setPrinting(false),
    onPrintError: () => {
      setPrinting(false);
      setPrintError(true);
    },
  });
  const ready = Boolean(eligible && !error && !isLoading && !isValidating && data?.length);

  return (
    <>
      <ModalHeader closeModal={closeModal} title={t('printLabResults', 'Print lab results')} />
      <ModalBody className={styles.body}>
        {!eligible && (
          <InlineNotification
            kind="error"
            hideCloseButton
            title={t(
              'labResultSelectionUnavailable',
              'These results cannot be opened. Refresh the list and check your access.',
            )}
          />
        )}
        {eligible && (isLoading || isValidating) && (
          <InlineLoading description={t('loadingSavedLabResults', 'Loading saved results')} />
        )}
        {eligible && error && (
          <>
            <InlineNotification
              kind="error"
              hideCloseButton
              title={t(
                'labResultsPrintLoadFailed',
                'Could not load all selected results. No report is available to print.',
              )}
            />
            <Button kind="tertiary" disabled={isValidating} onClick={() => void mutate()}>
              {t('retry', 'Retry')}
            </Button>
          </>
        )}
        {ready && (
          <div ref={contentRef} className={styles.report}>
            <h2>{t('labResultsReport', 'Laboratory results')}</h2>
            <p>
              <strong>{t('patient', 'Patient')}: </strong>
              {data[0].order.patient.display}
            </p>
            <p>{t('labReportScope', 'Saved results for the selected completed orders.')}</p>
            {data.map(({ order, observation }) => (
              <section key={order.uuid}>
                <h3>
                  {order.orderNumber} — {order.concept.display}
                </h3>
                <table>
                  <thead>
                    <tr>
                      <th scope="col">{t('test', 'Test')}</th>
                      <th scope="col">{t('resultDate', 'Result date')}</th>
                      <th scope="col">{t('result', 'Result')}</th>
                      <th scope="col">{t('units', 'Units')}</th>
                      <th scope="col">{t('recordedReferenceRange', 'Recorded reference range')}</th>
                      <th scope="col">{t('comment', 'Comment')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <ObservationRows observation={observation} />
                  </tbody>
                </table>
              </section>
            ))}
            <p>
              {t(
                'labReportRangeSource',
                'Reference ranges are shown only when saved with the observation. Units come from the test catalog.',
              )}
            </p>
          </div>
        )}
        {printError && (
          <InlineNotification
            kind="error"
            hideCloseButton
            title={t('labPrintFailed', 'Could not print the report. Try again.')}
          />
        )}
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={closeModal}>
          {t('cancel', 'Cancel')}
        </Button>
        <Button
          disabled={!ready || printing}
          onClick={() => {
            if (ready) {
              setPrinting(true);
              setPrintError(false);
              print();
            }
          }}
        >
          {t('print', 'Print')}
        </Button>
      </ModalFooter>
    </>
  );
}

function ObservationRows({ observation }: { observation: LabResultObservation }) {
  const members = observation.groupMembers?.filter((member) => !member.voided);
  if (members?.length)
    return (
      <>
        <tr>
          <th colSpan={6} scope="rowgroup">
            {observation.concept.display}
            {observation.comment ? ` — ${observation.comment}` : ''}
          </th>
        </tr>
        {members.map((member) => (
          <Fragment key={member.uuid}>
            <ObservationRows observation={member} />
          </Fragment>
        ))}
      </>
    );
  const { value, referenceRange: range } = observation;
  const displayValue = typeof value === 'object' ? value?.display : value;
  const displayRange =
    range?.lowNormal != null && range?.hiNormal != null
      ? `${range.lowNormal} – ${range.hiNormal}`
      : range?.lowNormal != null
        ? `≥ ${range.lowNormal}`
        : range?.hiNormal != null
          ? `≤ ${range.hiNormal}`
          : '—';
  return (
    <tr>
      <th scope="row">{observation.concept.display}</th>
      <td>
        {observation.obsDatetime ? formatDate(new Date(observation.obsDatetime), { time: true, noToday: true }) : '—'}
      </td>
      <td>
        {observation.valueModifier ?? ''}
        {displayValue}
      </td>
      <td>{observation.concept.units || '—'}</td>
      <td>{displayRange}</td>
      <td>{observation.comment || '—'}</td>
    </tr>
  );
}

import {
  Button,
  DataTableSkeleton,
  InlineNotification,
  Pagination,
  Select,
  SelectItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
  TextInput,
  Tile,
} from '@carbon/react';
import { ConfigurableLink, formatDatetime, UserHasAccess, useSession } from '@openmrs/esm-framework';
import { EmptyDataIllustration } from '@openmrs/esm-patient-common-lib';
import { getCompatibleUserFacingErrorMessage } from '@openmrs/esm-utils';
import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import VisitDetail from '../visits-summary/visit-detail.component';
import {
  type AttentionFilters,
  dateBounds,
  localDate,
  moduleName,
  myAttentionsPrivileges,
  patientQueryMaxLength,
  useMyAttentions,
} from './my-attentions.resource';
import styles from './my-attentions.scss';

export default function MyAttentionsPage() {
  const { t } = useTranslation(moduleName);
  const session = useSession();
  if (!session.authenticated) {
    return (
      <InlineNotification
        kind="error"
        hideCloseButton
        title={t('myAttentionsSessionExpired', 'Sign in again to review your care records.')}
      />
    );
  }
  return (
    <UserHasAccess
      privilege={myAttentionsPrivileges}
      fallback={
        <InlineNotification
          kind="error"
          hideCloseButton
          title={t('myAttentionsDenied', 'You do not have permission to review care.')}
        />
      }
    >
      <MyAttentions />
    </UserHasAccess>
  );
}

export function MyAttentions() {
  const { t } = useTranslation(moduleName);
  const [filters, setFilters] = useState<AttentionFilters>(() => ({
    from: localDate(),
    through: localDate(),
    q: '',
    status: 'all',
  }));
  const [draft, setDraft] = useState(filters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [expanded, setExpanded] = useState<string | null>(null);
  const { data, error, isLoading, isValidating, mutate } = useMyAttentions(filters, page, pageSize);
  const datesValid = Boolean(dateBounds(draft.from, draft.through));
  const queryValid = draft.q.trim().length <= patientQueryMaxLength;
  const valid = datesValid && queryValid;
  const statusText = {
    open: t('myConsultationOpen', 'Open consultation'),
    closed: t('myConsultationClosed', 'Closed consultation'),
    unlinked: t('myConsultationUnlinked', 'No linked consultation'),
  };
  return (
    <section className={styles.page} aria-label={t('myAttentions', 'My care')}>
      <header className={styles.header}>
        <div>
          <h2>{t('myAttentions', 'My care')}</h2>
          <p>{t('myAttentionsDescription', 'Consultations with clinical records assigned to you as a provider.')}</p>
        </div>
        <Button kind="tertiary" size="sm" disabled={isValidating} onClick={() => mutate()}>
          {t('myAttentionsRefresh', 'Refresh')}
        </Button>
      </header>
      <form
        className={styles.filters}
        onSubmit={(event) => {
          event.preventDefault();
          if (valid) {
            setFilters({ ...draft });
            setPage(1);
            setExpanded(null);
          }
        }}
      >
        <TextInput
          id="my-attentions-from"
          type="date"
          labelText={t('myAttentionsFrom', 'From')}
          value={draft.from}
          onChange={(event) => setDraft({ ...draft, from: event.target.value })}
          required
        />
        <TextInput
          id="my-attentions-through"
          type="date"
          labelText={t('myAttentionsThrough', 'Through')}
          value={draft.through}
          onChange={(event) => setDraft({ ...draft, through: event.target.value })}
          required
          invalid={!datesValid}
          invalidText={t('myAttentionsInvalidDates', 'Select an ordered date range of up to 366 days.')}
        />
        <TextInput
          id="my-attentions-patient"
          labelText={t('myAttentionsPatientFilter', 'Patient name or identifier')}
          value={draft.q}
          helperText={t('myAttentionsPatientLimit', 'Up to {{max}} characters.', { max: patientQueryMaxLength })}
          invalid={!queryValid}
          invalidText={t('myAttentionsPatientTooLong', 'Shorten the patient filter to {{max}} characters or fewer.', {
            max: patientQueryMaxLength,
          })}
          onChange={(event) => setDraft({ ...draft, q: event.target.value })}
        />
        <Select
          id="my-attentions-status"
          labelText={t('myAttentionsStatus', 'Consultation status')}
          value={draft.status}
          onChange={(event) => setDraft({ ...draft, status: event.target.value as AttentionFilters['status'] })}
        >
          <SelectItem value="all" text={t('myAttentionsAll', 'All')} />
          {Object.entries(statusText).map(([value, text]) => (
            <SelectItem key={value} value={value} text={text} />
          ))}
        </Select>
        <Button type="submit" disabled={!valid}>
          {t('myAttentionsApply', 'Apply filters')}
        </Button>
      </form>
      {error ? (
        <InlineNotification
          kind="error"
          hideCloseButton
          title={t('myAttentionsLoadError', 'Could not load your care records.')}
          subtitle={getCompatibleUserFacingErrorMessage(
            error,
            t(
              'myAttentionsLoadErrorHelp',
              'Refresh to retry. If this continues, ask your administrator to check access and service availability.',
            ),
            {
              log: false,
              statusMessages: {
                401: t('myAttentionsSessionExpired', 'Sign in again to review your care records.'),
                403: t('myAttentionsDenied', 'You do not have permission to review care.'),
              },
            },
          )}
        />
      ) : isLoading || !data ? (
        <DataTableSkeleton
          role="progressbar"
          aria-label={t('myAttentionsLoading', 'Loading your care records')}
          columnCount={6}
          rowCount={5}
          showToolbar={false}
        />
      ) : (
        <>
          {!data.hasProvider && (
            <InlineNotification
              kind="info"
              hideCloseButton
              title={t('myAttentionsNoProvider', 'Your account has no linked provider.')}
              subtitle={t(
                'myAttentionsNoProviderHelp',
                'Ask your administrator to link your account to your provider profile.',
              )}
            />
          )}
          <p className={styles.summary} role="status">
            {t('myAttentionsCount', 'Results: {{count}}', { count: data.totalCount })}
          </p>
          {!data.results.length ? (
            data.hasProvider && (
              <Tile className={styles.empty}>
                <EmptyDataIllustration />
                <h3>{t('myAttentionsEmpty', 'No care records for these filters')}</h3>
                <p>{t('myAttentionsEmptyHelp', 'Try another date range or check the patient filter.')}</p>
              </Tile>
            )
          ) : (
            <div className={styles.tableContainer}>
              <Table size="lg" aria-label={t('myAttentions', 'My care')} tabIndex={0}>
                <TableHead>
                  <TableRow>
                    {[
                      t('myAttentionsPatient', 'Patient'),
                      t('myAttentionsLastRecord', 'Last record'),
                      t('myAttentionsConsultation', 'Consultation'),
                      t('myAttentionsStatus', 'Consultation status'),
                      t('myAttentionsRecords', 'My records'),
                      t('myAttentionsActions', 'Actions'),
                    ].map((text) => (
                      <TableHeader key={text}>{text}</TableHeader>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.results.map((item) => (
                    <Fragment key={item.id}>
                      <TableRow>
                        <TableCell>
                          <strong>{item.patientName}</strong>
                          <div>{item.identifier || '—'}</div>
                        </TableCell>
                        <TableCell>{formatDatetime(new Date(item.lastEncounterDatetime))}</TableCell>
                        <TableCell>
                          {item.visitType || '—'}
                          <div>{item.location}</div>
                        </TableCell>
                        <TableCell>
                          <Tag type={item.status === 'open' ? 'green' : 'gray'}>{statusText[item.status]}</Tag>
                        </TableCell>
                        <TableCell>{item.encounterCount}</TableCell>
                        <TableCell>
                          <UserHasAccess privilege="app:hoja.clinica" fallback={null}>
                            <div className={styles.actions}>
                              {item.visitUuid && (
                                <Button
                                  kind="ghost"
                                  size="sm"
                                  aria-expanded={expanded === item.id}
                                  aria-controls={`attention-detail-${item.id}`}
                                  onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                                >
                                  {t('myAttentionsView', 'View consultation')}
                                </Button>
                              )}
                              <ConfigurableLink to={`${globalThis.spaBase}/patient/${item.patientUuid}/chart`}>
                                {t('myAttentionsChart', 'Open chart')}
                              </ConfigurableLink>
                            </div>
                          </UserHasAccess>
                        </TableCell>
                      </TableRow>
                      {expanded === item.id && item.visitUuid && (
                        <TableRow>
                          <TableCell id={`attention-detail-${item.id}`} colSpan={6}>
                            <UserHasAccess privilege="app:hoja.clinica" fallback={null}>
                              <VisitDetail visitUuid={item.visitUuid} patientUuid={item.patientUuid} />
                            </UserHasAccess>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {data.totalCount > 0 && (
            <Pagination
              className={styles.pagination}
              page={page}
              pageSize={pageSize}
              pageSizes={[10, 20, 50]}
              totalItems={data.totalCount}
              itemsPerPageText={t('myAttentionsPerPage', 'Results per page:')}
              backwardText={t('myAttentionsPrevious', 'Previous page')}
              forwardText={t('myAttentionsNext', 'Next page')}
              pageNumberText={t('myAttentionsPageNumber', 'Page number')}
              pageRangeText={(_current, total) => t('myAttentionsPageRange', 'of {{total}} pages', { total })}
              itemRangeText={(min, max, total) =>
                t('myAttentionsItemRange', '{{min}}–{{max}} of {{total}} results', { min, max, total })
              }
              pageSelectLabelText={(total) => t('myAttentionsPageSelect', 'Page number, of {{total}} pages', { total })}
              onChange={({ page: next, pageSize: size }) => {
                setPage(size === pageSize ? next : 1);
                setPageSize(size);
                setExpanded(null);
              }}
            />
          )}
        </>
      )}
    </section>
  );
}

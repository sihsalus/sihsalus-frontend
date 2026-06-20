import {
  Button,
  Callout,
  DataTable,
  DataTableSkeleton,
  InlineLoading,
  Layer,
  StructuredListBody,
  StructuredListCell,
  StructuredListHead,
  StructuredListRow,
  StructuredListWrapper,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Tag,
  Tile,
} from '@carbon/react';
import { Renew } from '@carbon/react/icons';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getDemoReviewBundle, getReviewBundle } from './openmrs-livekit.resource';
import styles from './root.scss';
import type { ReviewBundle } from './types';

const Root: React.FC = () => {
  const { t } = useTranslation();
  const [bundle, setBundle] = useState<ReviewBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [usingDemoData, setUsingDemoData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadBundle = useCallback(async () => {
    const abortController = new AbortController();
    setLoading(true);
    setError(null);

    try {
      const nextBundle = await getReviewBundle(abortController);
      setBundle(nextBundle);
      setUsingDemoData(false);
    } catch (err) {
      setBundle(getDemoReviewBundle());
      setUsingDemoData(true);
      setError(err instanceof Error ? err.message : t('serviceUnavailable', 'Service unavailable'));
    } finally {
      setLoading(false);
    }

    return () => abortController.abort();
  }, [t]);

  useEffect(() => {
    void loadBundle();
  }, [loadBundle]);

  return (
    <main className={`omrs-main-content ${styles.main}`}>
      <section className={styles.header}>
        <div>
          <p className={styles.eyebrow}>{t('clinicalAiReview', 'Clinical AI review')}</p>
          <h3>{t('openmrsLivekit', 'OpenMRS LiveKit')}</h3>
          <p className={styles.subtitle}>
            {t(
              'openmrsLivekitDescription',
              'Review local voice translation, de-identification, and OpenMRS draft observations before any write.',
            )}
          </p>
        </div>
        <Button kind="tertiary" renderIcon={Renew} onClick={() => void loadBundle()}>
          {t('refresh', 'Refresh')}
        </Button>
      </section>

      {usingDemoData && (
        <Callout
          className={styles.callout}
          kind="warning"
          title={t('demoDataTitle', 'Showing synthetic demo data')}
          subtitle={t(
            'demoDataSubtitle',
            'The local OpenMRS LiveKit service is not reachable through the gateway yet. The review workflow is shown with synthetic data.',
          )}
        />
      )}

      {error && !usingDemoData && (
        <Callout className={styles.callout} kind="error" title={t('serviceError', 'Service error')} subtitle={error} />
      )}

      {loading && !bundle ? (
        <DataTableSkeleton rowCount={4} columnCount={4} />
      ) : (
        bundle && (
          <>
            <section className={styles.summaryGrid}>
              <SummaryTile label={t('serviceStatus', 'Service status')} value={bundle.serviceStatus} />
              <SummaryTile
                label={t('translatedTurns', 'Translated turns')}
                value={String(bundle.translationTurns.length)}
              />
              <SummaryTile label={t('reviewQueue', 'Review queue')} value={String(bundle.reviewQueue.length)} />
              <SummaryTile label={t('approvedObs', 'Approved obs')} value={String(bundle.openmrsDraft.obs.length)} />
            </section>

            <Tabs>
              <TabList contained>
                <Tab>{t('translations', 'Translations')}</Tab>
                <Tab>{t('reviewQueue', 'Review queue')}</Tab>
                <Tab>{t('openmrsDraft', 'OpenMRS draft')}</Tab>
              </TabList>
              <TabPanels>
                <TabPanel className={styles.tabPanel}>
                  <TranslationTurns bundle={bundle} />
                </TabPanel>
                <TabPanel className={styles.tabPanel}>
                  <ReviewQueue bundle={bundle} />
                </TabPanel>
                <TabPanel className={styles.tabPanel}>
                  <DraftPayload bundle={bundle} />
                </TabPanel>
              </TabPanels>
            </Tabs>
          </>
        )
      )}

      {loading && bundle && (
        <InlineLoading className={styles.inlineLoading} description={t('refreshing', 'Refreshing...')} />
      )}
    </main>
  );
};

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <Tile className={styles.summaryTile}>
      <span>{label}</span>
      <strong>{value}</strong>
    </Tile>
  );
}

function TranslationTurns({ bundle }: { bundle: ReviewBundle }) {
  const { t } = useTranslation();

  return (
    <div className={styles.turnList}>
      {bundle.translationTurns.map((turn) => (
        <Layer key={`${turn.speaker}-${turn.safeSourceText}`}>
          <Tile className={styles.turnTile}>
            <div className={styles.turnHeader}>
              <strong>{turn.speaker}</strong>
              <Tag type={turn.redactionCount > 0 ? 'purple' : 'gray'}>
                {t('redactions', '{{count}} redactions', { count: turn.redactionCount })}
              </Tag>
            </div>
            <dl>
              <dt>{t('safeSource', 'AI-safe source')}</dt>
              <dd>{turn.safeSourceText}</dd>
              <dt>{t('translation', 'Translation')}</dt>
              <dd>{turn.translatedText}</dd>
            </dl>
          </Tile>
        </Layer>
      ))}
    </div>
  );
}

function ReviewQueue({ bundle }: { bundle: ReviewBundle }) {
  const { t } = useTranslation();
  const rows = bundle.reviewQueue.map((fact) => ({
    id: `${fact.kind}-${fact.evidence}`,
    kind: fact.kind,
    value: fact.value,
    confidence: `${Math.round(fact.confidence * 100)}%`,
    evidence: fact.evidence,
    status: fact.status,
  }));

  return (
    <>
      <DataTable
        rows={rows}
        headers={[
          { key: 'kind', header: t('fact', 'Fact') },
          { key: 'value', header: t('value', 'Value') },
          { key: 'confidence', header: t('confidence', 'Confidence') },
          { key: 'evidence', header: t('evidence', 'Evidence') },
          { key: 'status', header: t('status', 'Status') },
        ]}
      >
        {({ rows, headers, getTableProps }) => (
          <table className={styles.table} {...getTableProps()}>
            <thead>
              <tr>
                {headers.map((header) => (
                  <th key={header.key}>{header.header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  {row.cells.map((cell) => (
                    <td key={cell.id}>{cell.value}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </DataTable>

      {bundle.missingFields.length > 0 && (
        <Callout
          className={styles.callout}
          kind="info"
          title={t('missingFields', 'Missing fields')}
          subtitle={bundle.missingFields.join(', ')}
        />
      )}
    </>
  );
}

function DraftPayload({ bundle }: { bundle: ReviewBundle }) {
  const { t } = useTranslation();
  const draft = bundle.openmrsDraft;

  return (
    <StructuredListWrapper>
      <StructuredListHead>
        <StructuredListRow head>
          <StructuredListCell head>{t('field', 'Field')}</StructuredListCell>
          <StructuredListCell head>{t('value', 'Value')}</StructuredListCell>
        </StructuredListRow>
      </StructuredListHead>
      <StructuredListBody>
        <StructuredListRow>
          <StructuredListCell>{t('patient', 'Patient')}</StructuredListCell>
          <StructuredListCell>{draft.patient}</StructuredListCell>
        </StructuredListRow>
        <StructuredListRow>
          <StructuredListCell>{t('encounterType', 'Encounter type')}</StructuredListCell>
          <StructuredListCell>{draft.encounterType}</StructuredListCell>
        </StructuredListRow>
        <StructuredListRow>
          <StructuredListCell>{t('location', 'Location')}</StructuredListCell>
          <StructuredListCell>{draft.location}</StructuredListCell>
        </StructuredListRow>
        <StructuredListRow>
          <StructuredListCell>{t('approvedObservations', 'Approved observations')}</StructuredListCell>
          <StructuredListCell>
            <pre className={styles.payload}>{JSON.stringify(draft.obs, null, 2)}</pre>
          </StructuredListCell>
        </StructuredListRow>
      </StructuredListBody>
    </StructuredListWrapper>
  );
}

export default Root;

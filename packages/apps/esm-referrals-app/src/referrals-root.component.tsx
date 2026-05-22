import {
  Button,
  DataTable,
  DataTableSkeleton,
  InlineLoading,
  Layer,
  Pagination,
  Search,
  Tab,
  TabList,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  TabPanel,
  TabPanels,
  Tabs,
  Tile,
} from '@carbon/react';
import { AirlineManageGates, UpdateNow } from '@carbon/react/icons';
import {
  Assessment1Pictogram,
  formatDate,
  isDesktop,
  launchWorkspace,
  navigate,
  PageHeader,
  PageHeaderContent,
  showSnackbar,
  useLayoutType,
  usePagination,
} from '@openmrs/esm-framework';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { mutate as mutateSWR } from 'swr';

import ReferralActions from './referral-actions.component';
import { pullFacilityReferrals, useCommunityReferrals } from './referrals.resource';
import styles from './referrals.scss';
import type { CommunityReferral, ReferralReasons } from './types';

type ReferralTableProps = {
  status: 'active' | 'completed';
};

const DEFAULT_PAGE_SIZE = 10;
const pageSizes = [10, 20, 30, 40, 50];

function getPatientName(record: CommunityReferral) {
  return [record.givenName, record.middleName, record.familyName].filter(Boolean).join(' ');
}

function buildReferralReasons(record: CommunityReferral): ReferralReasons {
  return {
    category: record.referralReasons?.category ?? '',
    clinicalNote: record.referralReasons?.clinicalNote ?? '',
    reasonCode: record.referralReasons?.reasonCode ?? '',
    messageId: record.referralReasons?.messageId ?? record.id,
    referralDate: record.referralReasons?.referralDate,
  };
}

const ReferralTable: React.FC<ReferralTableProps> = ({ status }) => {
  const { t } = useTranslation();
  const layout = useLayoutType();
  const responsiveSize = isDesktop(layout) ? 'lg' : 'sm';
  const { referrals, isLoading, isValidating } = useCommunityReferrals(status);
  const [searchString, setSearchString] = useState('');
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const searchResults = useMemo(() => {
    if (!searchString.trim()) {
      return referrals;
    }

    const search = searchString.toLowerCase();
    return referrals.filter((referral) =>
      Object.entries(referral).some(([key, value]) => key !== 'uuid' && `${value}`.toLowerCase().includes(search)),
    );
  }, [referrals, searchString]);

  const { paginated, goTo, results, currentPage } = usePagination(searchResults, pageSize);

  const headers = [
    { header: t('upi', 'UPI'), key: 'nupi' },
    { header: t('name', 'Name'), key: 'name' },
    { header: t('gender', 'Gender'), key: 'gender' },
    { header: t('birthdate', 'Birth date'), key: 'birthdate' },
    { header: t('dateReferred', 'Date referred'), key: 'dateReferred' },
    { header: t('referredFrom', 'Referred from'), key: 'referredFrom' },
    { header: t('referralService', 'Department'), key: 'referralService' },
    { header: t('actions', 'Actions'), key: 'actions' },
  ];

  const rows = results.map((record, index) => {
    const name = getPatientName(record) || t('unknownPatient', 'Unknown patient');
    const referralReasons = buildReferralReasons(record);

    return {
      id: `${record.id ?? index}`,
      nupi: record.nupi ?? t('notRecorded', 'Not recorded'),
      name:
        status === 'completed' && record.uuid ? (
          <button
            type="button"
            className={styles.linkButton}
            onClick={() => navigate({ to: `${globalThis.getOpenmrsSpaBase()}patient/${record.uuid}/chart` })}
          >
            {name}
          </button>
        ) : (
          name
        ),
      gender: record.gender ?? t('notRecorded', 'Not recorded'),
      birthdate: record.birthdate ?? t('notRecorded', 'Not recorded'),
      dateReferred: record.dateReferred
        ? formatDate(new Date(record.dateReferred), { mode: 'standard' })
        : t('notRecorded', 'Not recorded'),
      referredFrom: record.referredFrom ?? t('notRecorded', 'Not recorded'),
      referralService: referralReasons.category || t('notRecorded', 'Not recorded'),
      actions: <ReferralActions status={status} referralData={referralReasons} />,
    };
  });

  const handleSearch = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      goTo(1);
      setSearchString(event.target.value);
    },
    [goTo],
  );

  if (isLoading) {
    return <DataTableSkeleton headers={headers} columnCount={headers.length} rowCount={DEFAULT_PAGE_SIZE} />;
  }

  return (
    <div className={styles.serviceContainer}>
      <div className={styles.tableToolbar}>
        <div>{isValidating ? <InlineLoading /> : null}</div>
        <Layer>
          <Search
            id={`${status}-referrals-search`}
            labelText={t('searchThisList', 'Search this list')}
            onChange={handleSearch}
            placeholder={t('searchThisList', 'Search this list')}
            size={responsiveSize}
            value={searchString}
          />
        </Layer>
      </div>
      <DataTable isSortable rows={rows} headers={headers} size={responsiveSize} useZebraStyles={rows.length > 1}>
        {({ rows, headers, getRowProps, getTableProps }) => (
          <TableContainer title={t('referredPatients', 'Referred patients')}>
            <Table {...getTableProps()} aria-label={t('referredPatients', 'Referred patients')}>
              <TableHead>
                <TableRow>
                  {headers.map((header) => (
                    <TableHeader key={header.key}>{header.header}</TableHeader>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} {...getRowProps({ row })}>
                    {row.cells.map((cell) => (
                      <TableCell key={cell.id}>{cell.value}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DataTable>
      {searchResults.length === 0 ? (
        <Tile className={styles.emptyState}>
          <p>{t('noReferralsToDisplay', 'There are no referrals to display')}</p>
        </Tile>
      ) : null}
      {paginated ? (
        <Pagination
          backwardText={t('previousPage', 'Previous page')}
          forwardText={t('nextPage', 'Next page')}
          page={currentPage}
          pageNumberText={t('pageNumber', 'Page number')}
          pageSize={pageSize}
          pageSizes={pageSizes}
          totalItems={searchResults.length}
          size={responsiveSize}
          onChange={({ pageSize: newPageSize, page }) => {
            if (newPageSize !== pageSize) {
              setPageSize(newPageSize);
              goTo(1);
            }

            if (page !== currentPage) {
              goTo(page);
            }
          }}
        />
      ) : null}
    </div>
  );
};

const ReferralsRoot: React.FC = () => {
  const { t } = useTranslation();
  const layout = useLayoutType();
  const responsiveSize = isDesktop(layout) ? 'md' : 'sm';
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [isPullingReferrals, setIsPullingReferrals] = useState(false);

  const handlePullReferrals = async () => {
    setIsPullingReferrals(true);

    try {
      await pullFacilityReferrals();
      await mutateSWR((key) => typeof key === 'string' && key.includes('/kenyaemril/communityReferrals'));
      showSnackbar({
        title: t('success', 'Success'),
        subtitle: t('referralsPulledSuccessfully', 'Referrals pulled successfully'),
        kind: 'success',
        isLowContrast: true,
      });
    } catch (error) {
      showSnackbar({
        title: t('errorPullingReferrals', 'Error pulling referrals'),
        subtitle: error instanceof Error ? error.message : t('unknownError', 'An unknown error occurred'),
        kind: 'error',
        isLowContrast: true,
      });
    } finally {
      setIsPullingReferrals(false);
    }
  };

  const handleReferral = () => {
    launchWorkspace('facility-referral-form', {
      workspaceTitle: t('referralForm', 'Referral form'),
    });
  };

  return (
    <main className={styles.page}>
      <PageHeader className={styles.header}>
        <PageHeaderContent title={t('referrals', 'Referrals')} illustration={<Assessment1Pictogram />} />
        <div className={styles.headerActions}>
          <Button
            kind="primary"
            renderIcon={UpdateNow}
            iconDescription={t('pullReferrals', 'Pull referrals')}
            onClick={handlePullReferrals}
            size={responsiveSize}
            disabled={isPullingReferrals}
          >
            {isPullingReferrals ? (
              <InlineLoading description={t('pullingReferrals', 'Pulling referrals...')} status="active" />
            ) : (
              t('pullReferrals', 'Pull referrals')
            )}
          </Button>
          <Button
            kind="tertiary"
            renderIcon={AirlineManageGates}
            onClick={handleReferral}
            iconDescription={t('referPatient', 'Refer patient')}
            size={responsiveSize}
          >
            {t('referPatient', 'Refer patient')}
          </Button>
        </div>
      </PageHeader>
      <section className={styles.content}>
        <Tabs selectedIndex={activeTabIndex} onChange={({ selectedIndex }) => setActiveTabIndex(selectedIndex)}>
          <TabList aria-label={t('referralsTabs', 'Referrals tabs')} contained>
            <Tab>{t('fromCommunity', 'From community')}</Tab>
            <Tab>{t('fromFacility', 'From facility')}</Tab>
            <Tab>{t('completed', 'Completed')}</Tab>
          </TabList>
          <TabPanels>
            <TabPanel className={styles.tabPanel}>
              <ReferralTable status="active" />
            </TabPanel>
            <TabPanel className={styles.tabPanel}>
              <ReferralTable status="active" />
            </TabPanel>
            <TabPanel className={styles.tabPanel}>
              <ReferralTable status="completed" />
            </TabPanel>
          </TabPanels>
        </Tabs>
      </section>
    </main>
  );
};

export default ReferralsRoot;

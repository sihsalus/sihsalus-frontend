import { Button, ButtonSkeleton, Search, Select, SelectItem, SelectSkeleton, SkeletonText, Tile } from '@carbon/react';
import { ShoppingCartArrowUp } from '@carbon/react/icons';
import {
  ArrowRightIcon,
  openmrsFetch,
  ResponsiveWrapper,
  restBaseUrl,
  ShoppingCartArrowDownIcon,
  useConfig,
  useDebounce,
  useLayoutType,
  useSession,
} from '@openmrs/esm-framework';
import { useOrderBasket } from '@openmrs/esm-patient-common-lib';
import classNames from 'classnames';
import React, { type ComponentProps, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWRImmutable from 'swr/immutable';
import type { ConfigObject } from '../../config-schema';
import type { TestOrderBasketItem } from '../../types';
import { prepTestOrderPostData } from '../api';

import { createEmptyLabOrder } from './test-order';
import styles from './test-type-search.scss';
import { type TestType, useTestTypes } from './useTestTypes';

export interface TestTypeSearchProps {
  openLabForm: (searchResult: TestOrderBasketItem) => void;
  orderTypeUuid: string;
  orderableConceptSets: Array<string>;
  returnToOrderBasket: () => void;
}

interface TestTypeSearchResultsProps extends TestTypeSearchProps {
  cancelOrder: () => void;
  searchTerm: string;
  focusAndClearSearchInput: () => void;
  fetchedLabsets?: Array<{ uuid: string; display: string }>;
}

interface TestTypeSearchResultItemProps {
  orderTypeUuid: string;
  testType: TestType;
  openOrderForm: (searchResult: TestOrderBasketItem) => void;
}

let lastSelectedLabset = 'ALL';

const orderableLabsetConceptUuids = [
  '228ced89-758e-4e0b-982e-155c01ed50f7', // Hematología
  '20df74e8-192d-4c30-8e5c-d9989c8a33d8', // Bioquímica
  '8ed15668-238d-4f19-947f-2237cb5d793f', // Inmunología
  '48ea717c-cc7c-4dc1-a018-9c0d439ee178', // Microbiología
  '0a84d7d3-2d86-4415-a12f-dc2a307ddba1', // Coproanálisis
  '29f4a2ac-d212-4ada-961c-b3d64101b390', // Grupo Sanguíneo y Factor Rh
  '24305e8e-f3dc-4ac6-bf87-e4f11f3b970e', // Hemograma completo
  'ea88fc4e-e3d9-4d2b-9cdd-c5be0490615a', // Lámina periférica
  '2220fe2e-37ad-465a-a49b-881369ad93cd', // Bilirrubina
  '9c7b89d6-7adc-4450-8e91-bd2115d28992', // Proteínas totales y albúmina
  'ef0a9d25-658b-466b-9b7e-4571673b28b0', // Prueba KOH
  '476ced01-24e8-43c0-a9f0-81327f6734f7', // Parasitología
  '4df83426-dfdf-4085-8db3-8ceedd268327', // Reacción inflamatoria
  '7e750f3a-8d5c-45b1-8e94-ebf850208e35', // Examen orina
  'c5cedfda-c2b7-4c85-b420-ecf0b53cba08', // Sedimento urinario
];

const wholeTestConceptUuids = [
  '29f4a2ac-d212-4ada-961c-b3d64101b390', // Grupo Sanguíneo y Factor Rh
  '24305e8e-f3dc-4ac6-bf87-e4f11f3b970e', // Hemograma completo
  '167e043c-eae0-44d4-984f-1124ec6607ad', // Hemograma
  'ea88fc4e-e3d9-4d2b-9cdd-c5be0490615a', // Lámina periférica
  '2220fe2e-37ad-465a-a49b-881369ad93cd', // Bilirrubina
  '9c7b89d6-7adc-4450-8e91-bd2115d28992', // Proteínas totales y albúmina
  'ef0a9d25-658b-466b-9b7e-4571673b28b0', // Prueba KOH
  '476ced01-24e8-43c0-a9f0-81327f6734f7', // Parasitología
  '4df83426-dfdf-4085-8db3-8ceedd268327', // Reacción inflamatoria
  '7e750f3a-8d5c-45b1-8e94-ebf850208e35', // Examen orina
  'c5cedfda-c2b7-4c85-b420-ecf0b53cba08', // Sedimento urinario
];

export function TestTypeSearch({
  openLabForm,
  orderTypeUuid,
  orderableConceptSets,
  returnToOrderBasket,
}: TestTypeSearchProps) {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const conceptUuids = useMemo(() => {
    return orderableLabsetConceptUuids;
  }, []);

  const fetchConcepts = useCallback((urls: Array<string>) => {
    return Promise.all(urls.map((url) => openmrsFetch<{ uuid: string; display: string }>(url).then((res) => res.data)));
  }, []);

  const { data: fetchedLabsets, isLoading: isLoadingLabsets } = useSWRImmutable<
    Array<{ uuid: string; display: string }>,
    Error
  >(
    conceptUuids.length ? conceptUuids.map((uuid) => `${restBaseUrl}/concept/${uuid}?v=custom:(uuid,display)`) : null,
    fetchConcepts,
  );

  const [selectedLabset, setSelectedLabset] = useState(lastSelectedLabset);

  const activeOrderableConceptSets = useMemo(() => {
    return selectedLabset === 'ALL' ? orderableConceptSets : [selectedLabset];
  }, [selectedLabset, orderableConceptSets]);

  const focusAndClearSearchInput = () => {
    setSearchTerm('');
    setSelectedLabset('ALL');
    lastSelectedLabset = 'ALL';
    searchInputRef.current?.focus();
  };

  const handleSearchTermChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value ?? '');
  };

  const handleLabsetChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    setSelectedLabset(value);
    lastSelectedLabset = value;
  };

  return (
    <>
      <ResponsiveWrapper>
        <div className={styles.searchContainer}>
          <Search
            autoFocus
            labelText={t('searchFieldPlaceholder', 'Search for a test type')}
            onChange={handleSearchTermChange}
            placeholder={t('searchFieldPlaceholder', 'Search for a test type')}
            ref={searchInputRef}
            size="lg"
            value={searchTerm}
          />
          <div className={styles.selectWrapper}>
            {isLoadingLabsets ? (
              <SelectSkeleton />
            ) : (
              <Select
                id="labset-select"
                labelText={t('labSetLabel', 'Lab Set')}
                hideLabel
                value={selectedLabset}
                onChange={handleLabsetChange}
                size="lg"
              >
                <SelectItem text={t('allLabTests', 'All lab tests')} value="ALL" />
                {fetchedLabsets?.map((labset) => (
                  <SelectItem key={labset.uuid} text={labset.display} value={labset.uuid} />
                ))}
              </Select>
            )}
          </div>
        </div>
      </ResponsiveWrapper>
      <TestTypeSearchResults
        cancelOrder={returnToOrderBasket}
        orderTypeUuid={orderTypeUuid}
        orderableConceptSets={activeOrderableConceptSets}
        focusAndClearSearchInput={focusAndClearSearchInput}
        openLabForm={openLabForm}
        searchTerm={debouncedSearchTerm}
        returnToOrderBasket={returnToOrderBasket}
        fetchedLabsets={fetchedLabsets}
      />
    </>
  );
}

let lastScrollTop = 0;
const priorityStorageKey = 'sihsalus-lab-order-basket-priority';

const getSavedPriorityConfig = (priorityConfigs: ConfigObject['priorityConfigs']) => {
  const savedPriorityUuid = localStorage.getItem(priorityStorageKey);
  return priorityConfigs?.find((priority) => priority.conceptUuid === savedPriorityUuid) ?? priorityConfigs?.[0];
};

function TestTypeSearchResults({
  cancelOrder,
  searchTerm,
  orderTypeUuid,
  orderableConceptSets,
  openLabForm,
  focusAndClearSearchInput,
  fetchedLabsets,
}: TestTypeSearchResultsProps) {
  const { t } = useTranslation();
  const isTablet = useLayoutType() === 'tablet';
  const { testTypes, isLoading, error } = useTestTypes(searchTerm, orderableConceptSets);

  const session = useSession();
  const config = useConfig<ConfigObject>();
  const orderConfig = config.orders;
  const priorityConfigs = config.priorityConfigs;
  const prepareTestOrderPostData = useCallback(
    (order: TestOrderBasketItem, patientUuid: string, encounterUuid: string | null) =>
      prepTestOrderPostData(order, patientUuid, encounterUuid, orderConfig.careSettingUuid),
    [orderConfig.careSettingUuid],
  );
  const { orders, setOrders } = useOrderBasket<TestOrderBasketItem>(orderTypeUuid, prepareTestOrderPostData);

  const isSpecificLabsetSelected = useMemo(() => {
    return orderableConceptSets?.length === 1 && !orderConfig.labOrderableConcepts.includes(orderableConceptSets[0]);
  }, [orderableConceptSets, orderConfig.labOrderableConcepts]);

  const isWholeTestSelected = useMemo(() => {
    return (
      isSpecificLabsetSelected &&
      orderableConceptSets?.length === 1 &&
      wholeTestConceptUuids.includes(orderableConceptSets[0])
    );
  }, [isSpecificLabsetSelected, orderableConceptSets]);

  const createLabOrder = useCallback(
    (orderableConcept: TestType) => {
      return createEmptyLabOrder(orderableConcept, session.currentProvider?.uuid);
    },
    [session.currentProvider?.uuid],
  );

  const addAllToBasket = useCallback(() => {
    if (!session.currentProvider?.uuid || testTypes.some((test) => test.approximateMatch)) {
      return;
    }

    const selectedPriority = getSavedPriorityConfig(priorityConfigs);
    if (!selectedPriority) {
      return;
    }

    if (isSpecificLabsetSelected && orderableConceptSets?.length === 1) {
      const parentConceptUuid = orderableConceptSets[0];
      if (orders?.some((order) => order.testType.conceptUuid === parentConceptUuid)) {
        return;
      }
      const parentLabset = fetchedLabsets?.find((l) => l.uuid === parentConceptUuid);
      const parentLabel = parentLabset?.display || testTypes[0]?.groupLabel || t('fullLabSet', 'Examen completo');
      const parentTestType: TestType = {
        label: parentLabel,
        conceptUuid: parentConceptUuid,
        synonyms: [],
      };
      const labOrder = createLabOrder(parentTestType);
      labOrder.urgency = selectedPriority.conceptUuid;
      labOrder.urgencyCode = selectedPriority.urgency;
      labOrder.isOrderIncomplete = selectedPriority.requiresScheduledDate ? !labOrder.scheduledDate : false;

      setOrders([...orders, labOrder]);
      cancelOrder();
      return;
    }

    const testsToAdd = testTypes.filter(
      (testType) => !orders?.some((order) => order.testType.conceptUuid === testType.conceptUuid),
    );

    if (testsToAdd.length === 0) return;

    const newLabOrders = testsToAdd.map((testType) => {
      const labOrder = createLabOrder(testType);
      labOrder.urgency = selectedPriority.conceptUuid;
      labOrder.urgencyCode = selectedPriority.urgency;
      labOrder.isOrderIncomplete = selectedPriority.requiresScheduledDate ? !labOrder.scheduledDate : false;
      return labOrder;
    });

    setOrders([...orders, ...newLabOrders]);
    cancelOrder();
  }, [
    session.currentProvider?.uuid,
    priorityConfigs,
    isSpecificLabsetSelected,
    orderableConceptSets,
    orders,
    fetchedLabsets,
    testTypes,
    t,
    createLabOrder,
    setOrders,
    cancelOrder,
  ]);

  const resultsContainerRef = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-apply the saved scroll position whenever the list contents or loading state change.
  useEffect(() => {
    if (resultsContainerRef.current) {
      resultsContainerRef.current.scrollTop = lastScrollTop;
    }
  }, [testTypes, isLoading]);

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    lastScrollTop = event.currentTarget.scrollTop;
  };

  const grouped = useMemo(() => {
    const groups: Array<{ label?: string; tests: Array<TestType> }> = [];
    testTypes?.forEach((test) => {
      let group = groups.find((g) => g.label === test.groupLabel);
      if (!group) {
        group = { label: test.groupLabel, tests: [] };
        groups.push(group);
      }
      group.tests.push(test);
    });
    return groups;
  }, [testTypes]);

  if (isLoading) {
    return <TestTypeSearchSkeleton />;
  }

  if (error) {
    return (
      <Tile className={styles.emptyState}>
        <div>
          <h4 className={styles.heading}>
            {t('errorFetchingTestTypes', 'Error fetching results for "{{searchTerm}}"', {
              searchTerm,
            })}
          </h4>
          <p className={styles.bodyShort01}>
            <span>{t('trySearchingAgain', 'Please try searching again')}</span>
          </p>
        </div>
      </Tile>
    );
  }

  if (testTypes?.length) {
    return (
      <>
        <div className={styles.container}>
          {(searchTerm || isSpecificLabsetSelected) && (
            <div className={styles.orderBasketSearchResultsHeader}>
              <span className={styles.searchResultsCount}>
                {searchTerm &&
                  t('searchResultsMatchesForTerm', '{{count}} results for "{{searchTerm}}"', {
                    count: testTypes?.length,
                    searchTerm,
                  })}
              </span>
              <div className={styles.headerActions}>
                {isWholeTestSelected &&
                  testTypes.length > 0 &&
                  !testTypes.some((test) => test.approximateMatch) && (
                    <Button
                      kind="ghost"
                      onClick={addAllToBasket}
                      size={isTablet ? 'md' : 'sm'}
                      renderIcon={(props: any) => <ShoppingCartArrowDownIcon size={16} {...props} />}
                    >
                      {t('addAllToBasket', 'Agregar todos')}
                    </Button>
                  )}
                {searchTerm && (
                  <Button kind="ghost" onClick={focusAndClearSearchInput} size={isTablet ? 'md' : 'sm'}>
                    {t('clearSearchResults', 'Clear results')}
                  </Button>
                )}
              </div>
            </div>
          )}
          {testTypes.some((test) => test.approximateMatch) && (
            <p role="status" className={styles.bodyShort01}>
              {t(
                'approximateTestMatches',
                'Similar catalog names. Check the test, specimen and method in the order form before adding it.',
              )}
            </p>
          )}
          <div ref={resultsContainerRef} className={styles.resultsContainer} onScroll={handleScroll}>
            {grouped.map((group, groupIndex) => (
              <div key={group.label ?? `ungrouped-${groupIndex}`} className={styles.groupContainer}>
                {group.label && <h5 className={styles.groupHeader}>{group.label}</h5>}
                {group.tests.map((testType) => (
                  <TestTypeSearchResultItem
                    key={testType.conceptUuid}
                    orderTypeUuid={orderTypeUuid}
                    openOrderForm={openLabForm}
                    testType={testType}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
        {isTablet && (
          <div className={styles.separatorContainer}>
            <p className={styles.separator}>{t('or', 'or')}</p>
            <Button iconDescription="Return to order basket" kind="ghost" onClick={cancelOrder}>
              {t('returnToOrderBasket', 'Return to order basket')}
            </Button>
          </div>
        )}
      </>
    );
  }

  return (
    <Tile className={styles.emptyState}>
      <div>
        <h4 className={styles.heading}>
          {t('noResultsForTestTypeSearch', 'No results to display for "{{searchTerm}}"', {
            searchTerm,
          })}
        </h4>
        <p className={styles.bodyShort01}>
          <span>{t('tryTo', 'Try to')}</span>{' '}
          <span
            className={styles.link}
            role="link"
            tabIndex={0}
            onClick={focusAndClearSearchInput}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                focusAndClearSearchInput();
              }
            }}
          >
            {t('searchAgain', 'search again')}
          </span>{' '}
          <span>{t('usingADifferentTerm', 'using a different term')}</span>
        </p>
      </div>
    </Tile>
  );
}

const TestTypeSearchResultItem: React.FC<TestTypeSearchResultItemProps> = ({
  testType,
  openOrderForm,
  orderTypeUuid,
}) => {
  const { t } = useTranslation();
  const isTablet = useLayoutType() === 'tablet';
  const session = useSession();
  const config = useConfig<ConfigObject>();
  const orderConfig = config.orders;
  const priorityConfigs = config.priorityConfigs;
  const prepareTestOrderPostData = useCallback(
    (order: TestOrderBasketItem, patientUuid: string, encounterUuid: string | null) =>
      prepTestOrderPostData(order, patientUuid, encounterUuid, orderConfig.careSettingUuid),
    [orderConfig.careSettingUuid],
  );
  const { orders, setOrders } = useOrderBasket<TestOrderBasketItem>(orderTypeUuid, prepareTestOrderPostData);

  const testTypeAlreadyInBasket = useMemo(
    () => orders?.some((order) => order.testType.conceptUuid === testType.conceptUuid),
    [orders, testType],
  );

  const createLabOrder = useCallback(
    (orderableConcept: TestType) => {
      return createEmptyLabOrder(orderableConcept, session.currentProvider?.uuid);
    },
    [session.currentProvider?.uuid],
  );

  const addToBasket = useCallback(() => {
    if (!session.currentProvider?.uuid || testType.approximateMatch) {
      return;
    }
    const labOrder = createLabOrder(testType);

    const selectedPriority = getSavedPriorityConfig(priorityConfigs);
    if (!selectedPriority) {
      return;
    }

    labOrder.urgency = selectedPriority.conceptUuid;
    labOrder.urgencyCode = selectedPriority.urgency;
    labOrder.isOrderIncomplete = selectedPriority.requiresScheduledDate ? !labOrder.scheduledDate : false;

    setOrders([...orders, labOrder]);
  }, [orders, setOrders, createLabOrder, testType, priorityConfigs, session.currentProvider?.uuid]);

  const removeFromBasket = useCallback(() => {
    setOrders(orders.filter((order) => order.testType.conceptUuid !== testType.conceptUuid));
  }, [orders, setOrders, testType.conceptUuid]);

  return (
    <Tile
      className={classNames(styles.searchResultTile, {
        [styles.tabletSearchResultTile]: isTablet,
      })}
      role="listitem"
    >
      <div className={classNames(styles.searchResultTileContent, styles.text02)}>
        <p>
          <span className={styles.heading}>{testType.label}</span>{' '}
        </p>
        {testType.matchedName && testType.matchedName !== testType.label && (
          <p className={styles.bodyShort01}>
            {t('matchedConceptName', 'Catalog name: {{name}}', {
              name: testType.matchedName,
            })}
          </p>
        )}
      </div>
      <div className={styles.searchResultActions}>
        {testTypeAlreadyInBasket ? (
          <Button
            kind="danger--ghost"
            renderIcon={(props) => <ShoppingCartArrowUp size={16} {...props} />}
            onClick={removeFromBasket}
          >
            {t('removeFromBasket', 'Remove from basket')}
          </Button>
        ) : !testType.approximateMatch ? (
          <Button
            kind="ghost"
            renderIcon={(props: ComponentProps<typeof ShoppingCartArrowDownIcon>) => (
              <ShoppingCartArrowDownIcon size={16} {...props} />
            )}
            onClick={addToBasket}
          >
            {t('directlyAddToBasket', 'Add to basket')}
          </Button>
        ) : null}
        <Button
          kind="ghost"
          renderIcon={(props: ComponentProps<typeof ArrowRightIcon>) => <ArrowRightIcon size={16} {...props} />}
          onClick={() => openOrderForm(createLabOrder(testType))}
        >
          {t('goToDrugOrderForm', 'Order form')}
        </Button>
      </div>
    </Tile>
  );
};

const TestTypeSearchSkeleton = () => {
  const isTablet = useLayoutType() === 'tablet';
  const tileClassName = classNames({
    [styles.tabletSearchResultTile]: isTablet,
    [styles.desktopSearchResultTile]: !isTablet,
    [styles.skeletonTile]: true,
  });
  const buttonSize = isTablet ? 'md' : 'sm';

  return (
    <div className={styles.searchResultSkeletonWrapper}>
      <div className={styles.orderBasketSearchResultsHeader}>
        <SkeletonText className={styles.searchResultCntSkeleton} />
        <ButtonSkeleton size={buttonSize} />
      </div>
      {Array.from({ length: 4 }).map((_, index) => (
        <Tile key={index} className={tileClassName}>
          <SkeletonText />
        </Tile>
      ))}
    </div>
  );
};

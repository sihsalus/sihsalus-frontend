import { useConfig } from '@openmrs/esm-framework';
import classNames from 'classnames';
import React, { useContext, useEffect, useMemo, useState } from 'react';

import { type PatientSearchConfig } from '../config-schema';
import { isPatientSearchTermValid, normalizePatientSearchTerm } from '../patient-search-constants';
import { useActiveVisitPatientUuids, useInfinitePatientSearch } from '../patient-search.resource';
import { PatientSearchContext, usePatientSearchContext2 } from '../patient-search-context';
import { type AdvancedPatientSearchState } from '../types';

import styles from './advanced-patient-search.scss';
import { matchesPatientAge } from './patient-age-filter';
import PatientSearchComponent from './patient-search-lg.component';
import { matchesPersonAttributeFilter } from './person-attribute-filter';
import RefineSearch, { initialFilters } from './refine-search/refine-search.component';

interface AdvancedPatientSearchProps {
  query: string;
  inTabletOrOverlay?: boolean;
  stickyPagination?: boolean;
}

const AdvancedPatientSearchComponent: React.FC<AdvancedPatientSearchProps> = ({
  query,
  stickyPagination,
  inTabletOrOverlay,
}) => {
  const [filters, setFilters] = useState<AdvancedPatientSearchState>(initialFilters);
  const [activeQuery, setActiveQuery] = useState(() => normalizePatientSearchTerm(query));
  const config = useConfig<PatientSearchConfig>();
  const { nonNavigationSelectPatientAction } = useContext(PatientSearchContext);
  const patientSearchContext2 = usePatientSearchContext2();
  const isEmbeddedSelection = Boolean(nonNavigationSelectPatientAction || patientSearchContext2?.onPatientSelected);

  useEffect(() => {
    setActiveQuery(normalizePatientSearchTerm(query));
  }, [query]);

  const filtersApplied = useMemo(() => {
    let count = 0;
    Object.entries(filters).forEach(([key, value]) => {
      if (key !== 'attributes' && key !== 'query' && key !== 'ageUnit' && value !== initialFilters[key]) {
        count++;
      }
    });

    const attributesWithValues = Object.entries(filters.attributes || {}).filter(([_key, value]) => value?.trim());

    count += attributesWithValues.length;
    return count;
  }, [filters]);

  const {
    data: searchResults,
    setPage,
    hasMore,
    isLoading,
    isValidating,
    fetchError,
  } = useInfinitePatientSearch(activeQuery, config.includeDead, isPatientSearchTermValid(activeQuery), 50);
  const {
    patientUuids: activeVisitPatientUuids,
    isLoading: areActiveVisitsLoading,
    error: activeVisitsError,
  } = useActiveVisitPatientUuids(filters.activeVisitStatus !== 'any');

  useEffect(() => {
    // hasMore reflects the last fetched page's `next` link, so advancing on it
    // (instead of an exact page-size match) still terminates and keeps loading
    // when the server returns short pages (e.g. voided patients filtered out).
    if (hasMore && !isLoading && !isValidating && !fetchError) {
      setPage((page) => page + 1);
    }
  }, [fetchError, hasMore, isLoading, isValidating, setPage]);

  const filteredResults = useMemo(() => {
    if (searchResults && filtersApplied) {
      return searchResults.filter((patient) => {
        // Gender filter
        if (filters.gender !== 'any') {
          const genderMap = {
            male: 'M',
            female: 'F',
            other: 'O',
            unknown: 'U',
          };
          if (patient.person.gender !== genderMap[filters.gender]) {
            return false;
          }
        }

        // Postcode filter
        if (filters.postcode) {
          if (!patient.person.addresses?.some((address) => address?.postalCode === filters.postcode)) {
            return false;
          }
        }

        // Age filter
        if (filters.age != null) {
          if (!matchesPatientAge(patient, Number(filters.age), filters.ageUnit)) {
            return false;
          }
        }

        if (filters.activeVisitStatus !== 'any') {
          const hasActiveVisit = activeVisitPatientUuids.has(patient.uuid);
          if (filters.activeVisitStatus === 'active' ? !hasActiveVisit : hasActiveVisit) {
            return false;
          }
        }

        // Person attributes filter
        if (Object.keys(filters.attributes).length) {
          for (const [attributeUuid, value] of Object.entries(filters.attributes)) {
            const normalizedFilterValue = value?.trim().toLowerCase();
            if (!normalizedFilterValue) continue;
            const matchingAttributes = patient.attributes?.filter(
              (attribute) => attribute?.attributeType?.uuid === attributeUuid,
            );
            const matchesAttributeValue = matchingAttributes?.some((attribute) =>
              matchesPersonAttributeFilter(
                attribute,
                attributeUuid,
                normalizedFilterValue,
                'contains',
              ),
            );

            if (!matchesAttributeValue) {
              return false;
            }
          }
        }

        return true;
      });
    }

    return searchResults;
  }, [activeVisitPatientUuids, filtersApplied, filters, searchResults]);

  const activeVisitFilterIsLoading = filters.activeVisitStatus !== 'any' && areActiveVisitsLoading;
  const visibleResults = activeVisitFilterIsLoading ? [] : filteredResults;
  const paginationResetKey = useMemo(() => JSON.stringify([activeQuery, filters]), [activeQuery, filters]);

  return (
    <div
      className={classNames({
        [styles.advancedPatientSearchTabletOrOverlay]: inTabletOrOverlay,
        [styles.advancedPatientSearchDesktop]: !inTabletOrOverlay,
      })}
    >
      {!inTabletOrOverlay && (
        <div className={styles.refineSearchDesktop}>
          <RefineSearch
            filtersApplied={filtersApplied}
            searchQuery={activeQuery}
            setFilters={setFilters}
            setSearchQuery={setActiveQuery}
            inTabletOrOverlay={inTabletOrOverlay}
          />
        </div>
      )}
      <div
        className={classNames({
          [styles.patientSearchResultsTabletOrOverlay]: inTabletOrOverlay,
          [styles.patientSearchResultsDesktop]: !inTabletOrOverlay,
        })}
      >
        <PatientSearchComponent
          query={activeQuery}
          paginationResetKey={paginationResetKey}
          stickyPagination={stickyPagination}
          inTabletOrOverlay={inTabletOrOverlay}
          isLoading={isLoading || activeVisitFilterIsLoading}
          isValidating={isValidating}
          hasMore={hasMore}
          fetchError={fetchError ?? activeVisitsError ?? null}
          searchResults={visibleResults ?? []}
          showAddPatient={!isEmbeddedSelection}
        />
      </div>
      {inTabletOrOverlay && (
        <RefineSearch
          filtersApplied={filtersApplied}
          searchQuery={activeQuery}
          setFilters={setFilters}
          setSearchQuery={setActiveQuery}
          inTabletOrOverlay={inTabletOrOverlay}
        />
      )}
    </div>
  );
};

export default AdvancedPatientSearchComponent;

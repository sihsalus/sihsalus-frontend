import { useConfig } from '@openmrs/esm-framework';
import { parsePatientBirthdate } from '@openmrs/esm-utils';
import classNames from 'classnames';
import React, { useContext, useEffect, useMemo, useState } from 'react';

import { type PatientSearchConfig } from '../config-schema';
import { useInfinitePatientSearch } from '../patient-search.resource';
import { PatientSearchContext, usePatientSearchContext2 } from '../patient-search-context';
import { type AdvancedPatientSearchState } from '../types';

import styles from './advanced-patient-search.scss';
import PatientSearchComponent from './patient-search-lg.component';
import { matchesPersonAttributeFilter } from './person-attribute-filter';
import { identityDocumentNumberAttributeUuid } from './refine-search/person-attribute-field.component';
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
  const [activeQuery, setActiveQuery] = useState(query);
  const config = useConfig<PatientSearchConfig>();
  const { nonNavigationSelectPatientAction } = useContext(PatientSearchContext);
  const patientSearchContext2 = usePatientSearchContext2();
  const isEmbeddedSelection = Boolean(nonNavigationSelectPatientAction || patientSearchContext2?.onPatientSelected);

  useEffect(() => {
    setActiveQuery(query);
  }, [query]);

  const filtersApplied = useMemo(() => {
    let count = 0;
    Object.entries(filters).forEach(([key, value]) => {
      if (key !== 'attributes' && key !== 'query' && value !== initialFilters[key]) {
        count++;
      }
    });

    const attributesWithValues = Object.entries(filters.attributes || {}).filter(([_key, value]) => value?.trim());

    count += attributesWithValues.length;
    return count;
  }, [filters]);

  const {
    data: searchResults,
    currentPage,
    setPage,
    hasMore,
    isLoading,
    isValidating,
    fetchError,
  } = useInfinitePatientSearch(activeQuery, config.includeDead, !!activeQuery, 50);

  useEffect(() => {
    if (searchResults?.length === currentPage * 50 && hasMore) {
      setPage((page) => page + 1);
    }
  }, [searchResults, currentPage, hasMore, setPage]);

  const filteredResults = useMemo(() => {
    if (searchResults && filtersApplied) {
      const identityDocumentSearchQuery = filters.attributes?.[identityDocumentNumberAttributeUuid]?.trim() ?? '';
      const shouldSkipIdentityDocumentAttributeFilters =
        !!identityDocumentSearchQuery && activeQuery === identityDocumentSearchQuery;

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

        // A birthdate is a calendar date. Parsing it as a JS Date shifts UTC-midnight
        // values to the previous day in Peru and other time zones west of UTC.
        if (filters.dateOfBirth != null || filters.monthOfBirth != null || filters.yearOfBirth != null) {
          const birthdate = parsePatientBirthdate(patient.person.birthdate);
          if (
            !birthdate ||
            (filters.dateOfBirth != null && birthdate.day !== filters.dateOfBirth) ||
            (filters.monthOfBirth != null && birthdate.month !== filters.monthOfBirth) ||
            (filters.yearOfBirth != null && birthdate.year !== filters.yearOfBirth)
          ) {
            return false;
          }
        }

        // Postcode filter
        if (filters.postcode) {
          if (!patient.person.addresses?.some((address) => address.postalCode === filters.postcode)) {
            return false;
          }
        }

        // Age filter
        if (filters.age != null) {
          if (Number(patient.person.age) !== Number(filters.age)) {
            return false;
          }
        }

        // Person attributes filter
        if (Object.keys(filters.attributes).length) {
          for (const [attributeUuid, value] of Object.entries(filters.attributes)) {
            const normalizedFilterValue = value?.trim().toLowerCase();
            if (!normalizedFilterValue) continue;
            if (shouldSkipIdentityDocumentAttributeFilters && attributeUuid === identityDocumentNumberAttributeUuid) {
              continue;
            }

            const matchingAttributes = patient.attributes?.filter(
              (attribute) => attribute.attributeType.uuid === attributeUuid,
            );
            const matchesAttributeValue = matchingAttributes?.some((attribute) =>
              matchesPersonAttributeFilter(
                attribute,
                attributeUuid,
                normalizedFilterValue,
                attributeUuid === identityDocumentNumberAttributeUuid,
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
  }, [activeQuery, filtersApplied, filters, searchResults]);

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
          stickyPagination={stickyPagination}
          inTabletOrOverlay={inTabletOrOverlay}
          isLoading={isLoading}
          isValidating={isValidating}
          hasMore={hasMore}
          fetchError={fetchError}
          searchResults={filteredResults ?? []}
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

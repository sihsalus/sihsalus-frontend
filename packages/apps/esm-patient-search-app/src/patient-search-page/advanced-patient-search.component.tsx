import type { OpenmrsResource } from '@openmrs/esm-framework';
import classNames from 'classnames';
import React, { useEffect, useMemo, useState } from 'react';

import { useInfinitePatientSearch } from '../patient-search.resource';
import { type AdvancedPatientSearchState } from '../types';

import styles from './advanced-patient-search.scss';
import PatientSearchComponent from './patient-search-lg.component';
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
    fetchError,
  } = useInfinitePatientSearch(activeQuery, false, !!activeQuery, 50);

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

        // Date of birth filters
        if (filters.dateOfBirth) {
          const dayOfBirth = Number(patient.person.birthdate?.slice(8, 10));
          if (dayOfBirth !== filters.dateOfBirth) {
            return false;
          }
        }

        if (filters.monthOfBirth) {
          const monthOfBirth = Number(patient.person.birthdate?.slice(5, 7));
          if (monthOfBirth !== filters.monthOfBirth) {
            return false;
          }
        }

        if (filters.yearOfBirth) {
          const yearOfBirth = Number(patient.person.birthdate?.slice(0, 4));
          if (yearOfBirth !== filters.yearOfBirth) {
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
        if (filters.age >= 0) {
          if (Number(patient.person.age) !== Number(filters.age)) {
            return false;
          }
        }

        // Person attributes filter
        if (Object.keys(filters.attributes).length) {
          for (const [attributeUuid, value] of Object.entries(filters.attributes)) {
            const normalizedFilterValue = value?.trim().toLowerCase();
            if (!normalizedFilterValue) continue;
            if (
              shouldSkipIdentityDocumentAttributeFilters &&
              attributeUuid === identityDocumentNumberAttributeUuid
            ) {
              continue;
            }

            const matchingAttribute = patient.attributes?.find((attr) => attr.attributeType.uuid === attributeUuid);

            if (!matchingAttribute) return false;

            const isValueObj = typeof matchingAttribute.value === 'object';
            const patientAttributeValue = isValueObj
              ? (matchingAttribute.value as OpenmrsResource).uuid
              : String(matchingAttribute.value ?? '');
            const normalizedPatientAttributeValue = patientAttributeValue.toLowerCase();
            const matchesAttributeValue = isValueObj
              ? normalizedPatientAttributeValue === normalizedFilterValue
              : attributeUuid === identityDocumentNumberAttributeUuid
                ? normalizedPatientAttributeValue.trim() === normalizedFilterValue
              : normalizedPatientAttributeValue.includes(normalizedFilterValue);

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
          fetchError={fetchError}
          searchResults={filteredResults ?? []}
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

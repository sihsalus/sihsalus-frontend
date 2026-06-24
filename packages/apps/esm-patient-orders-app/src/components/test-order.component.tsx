import {
  DataTable,
  DataTableSkeleton,
  SkeletonText,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '@carbon/react';
import { useLayoutType, openmrsFetch } from '@openmrs/esm-framework';
import { type Order } from '@openmrs/esm-patient-common-lib';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';

import { useLabEncounter, useOrderConceptByUuid } from '../lab-results/lab-results.resource';

import styles from './test-order.scss';

interface TestOrderProps {
  testOrder: Order;
}

const getObservationValueDisplay = (value: any): string | number => {
  if (value && typeof value === 'object') {
    return value.display || '';
  }
  return value;
};

const hasNormalRange = (concept: any) =>
  concept?.hiNormal !== null &&
  concept?.hiNormal !== undefined &&
  concept?.hiNormal !== '' &&
  concept?.lowNormal !== null &&
  concept?.lowNormal !== undefined &&
  concept?.lowNormal !== '';

const extractRangesFromFhirObs = (fhirObs: any) => {
  const referenceRanges = fhirObs?.referenceRange;
  if (!referenceRanges?.length) return {};

  const result: any = {};
  for (const ref of referenceRanges) {
    const code = ref.type?.coding?.[0]?.code?.toLowerCase();
    const system = ref.type?.coding?.[0]?.system;

    if (
      (system === 'http://terminology.hl7.org/CodeSystem/referencerange-meaning' && code === 'normal') ||
      code === 'normal' ||
      (!code && referenceRanges.length === 1)
    ) {
      const low = ref.low?.value;
      const high = ref.high?.value;
      if (typeof low === 'number') result.lowNormal = low;
      if (typeof high === 'number') result.hiNormal = high;
    }
  }
  return result;
};

const TestOrder: React.FC<TestOrderProps> = ({ testOrder }) => {
  const { t } = useTranslation();
  const isTablet = useLayoutType() === 'tablet';
  const { concept, isLoading: isLoadingTestConcepts } = useOrderConceptByUuid(testOrder.concept.uuid);
  const { encounter, isLoading: isLoadingResult } = useLabEncounter(testOrder.encounter.uuid);

  const { data: fhirObsBundle } = useSWR<any>(
    testOrder.encounter.uuid ? `/ws/fhir2/R4/Observation?encounter=Encounter/${testOrder.encounter.uuid}&_count=100` : null,
    openmrsFetch,
  );

  const tableHeaders: Array<{ key: string; header: string }> = [
    {
      key: 'testType',
      header: testOrder.orderType.display,
    },
    {
      key: 'result',
      header: t('result', 'Result'),
    },
    {
      key: 'normalRange',
      header: t('normalRange', 'Normal range'),
    },
  ];

  const testResultObs = useMemo(() => {
    if (encounter && concept) {
      return (
        encounter.obs?.find((obs) => obs.order?.uuid === testOrder.uuid) ||
        encounter.obs?.find((obs) => obs.concept.uuid === concept.uuid)
      );
    }
  }, [concept, encounter, testOrder.uuid]);

  const testRows = useMemo(() => {
    const findFhirObs = (obsUuid: string) => fhirObsBundle?.data?.entry?.find((e: any) => e.resource?.id === obsUuid)?.resource;

    if (concept && concept.setMembers.length > 0) {
      return concept?.setMembers.map((memberConcept) => {
        const memberObs = testResultObs?.groupMembers?.find((obs) => obs.concept.uuid === memberConcept.uuid);
        const fhirObs = memberObs ? findFhirObs(memberObs.uuid) : null;
        const fhirRanges = extractRangesFromFhirObs(fhirObs);

        const low = fhirRanges.lowNormal ?? memberConcept.lowNormal;
        const high = fhirRanges.hiNormal ?? memberConcept.hiNormal;

        return {
          id: memberConcept.uuid,
          testType: <div className={styles.testType}>{memberConcept.display}</div>,
          result: isLoadingResult ? (
            <SkeletonText />
          ) : (
            getObservationValueDisplay(memberObs?.value) ?? '--'
          ),
          normalRange: hasNormalRange({ lowNormal: low, hiNormal: high })
            ? `${low} - ${high}`
            : 'N/A',
        };
      });
    } else if (concept && concept.setMembers.length === 0) {
      const fhirObs = testResultObs ? findFhirObs(testResultObs.uuid) : null;
      const fhirRanges = extractRangesFromFhirObs(fhirObs);

      const low = fhirRanges.lowNormal ?? concept.lowNormal;
      const high = fhirRanges.hiNormal ?? concept.hiNormal;

      return [
        {
          id: concept.uuid,
          testType: <div className={styles.testType}>{concept.display}</div>,
          result: isLoadingResult ? (
            <SkeletonText />
          ) : (
            getObservationValueDisplay(testResultObs?.value) ?? '--'
          ),
          normalRange: hasNormalRange({ lowNormal: low, hiNormal: high }) ? `${low} - ${high}` : 'N/A',
        },
      ];
    } else {
      return [];
    }
  }, [concept, isLoadingResult, testResultObs, fhirObsBundle]);

  return (
    <div className={styles.testOrder}>
      {isLoadingTestConcepts ? (
        <DataTableSkeleton role="progressbar" zebra />
      ) : (
        <DataTable rows={testRows} headers={tableHeaders} size={isTablet ? 'lg' : 'sm'} useZebraStyles>
          {({ rows, headers, getHeaderProps, getRowProps, getTableProps, getTableContainerProps }) => (
            <TableContainer {...getTableContainerProps()}>
              <Table {...getTableProps()} aria-label="testorders">
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
                    <TableRow key={row.id} {...getRowProps({ row })}>
                      {row.cells.map((cell) => (
                        <TableCell key={cell.id} className={styles.testCell}>
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
      )}
    </div>
  );
};

export default TestOrder;

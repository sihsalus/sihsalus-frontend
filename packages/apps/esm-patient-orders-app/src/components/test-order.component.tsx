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
import { ExtensionSlot, openmrsFetch, useLayoutType } from '@openmrs/esm-framework';
import { type Order } from '@openmrs/esm-patient-common-lib';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';

import { flattenLeafConcepts, useLabEncounter, useOrderConceptByUuid } from '../lab-results/lab-results.resource';

import styles from './test-order.scss';

interface TestOrderProps {
  testOrder: Order;
  hideInstructions?: boolean;
  hideSupplementalPdf?: boolean;
  hideObservations?: boolean;
}

// biome-ignore lint/suspicious/noExplicitAny: generic value display mapping
const getObservationValueDisplay = (value: any): string | number => {
  if (value && typeof value === 'object') {
    return value.display || '';
  }
  return value;
};

// biome-ignore lint/suspicious/noExplicitAny: third-party OpenMRS concept datatype representation
const formatReferenceRange = (concept: any, fhirRanges?: any) => {
  const isNumeric = concept?.datatype?.hl7Abbreviation === 'NM' || concept?.datatype?.display === 'Numeric';
  if (!isNumeric) {
    return 'N/A';
  }

  const low = fhirRanges?.lowNormal ?? concept?.lowNormal ?? concept?.lowAbsolute;
  const high = fhirRanges?.hiNormal ?? concept?.hiNormal ?? concept?.hiAbsolute;
  const units = concept?.units ? ` ${concept.units}` : '';

  const hasLower = low !== null && low !== undefined && low !== '';
  const hasUpper = high !== null && high !== undefined && high !== '';

  if (hasLower && hasUpper) {
    return `${low} - ${high}${units}`;
  } else if (hasUpper) {
    return `<= ${high}${units}`;
  } else if (hasLower) {
    return `>= ${low}${units}`;
  }

  return units ? units.trim() : 'N/A';
};

// biome-ignore lint/suspicious/noExplicitAny: third-party FHIR Observation reference ranges representation
const extractRangesFromFhirObs = (fhirObs: any) => {
  const referenceRanges = fhirObs?.referenceRange;
  if (!referenceRanges?.length) return {};

  // biome-ignore lint/suspicious/noExplicitAny: dynamic object mapping
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

const TestOrder: React.FC<TestOrderProps> = ({ testOrder, hideInstructions, hideSupplementalPdf, hideObservations }) => {
  const { t } = useTranslation();
  const isTablet = useLayoutType() === 'tablet';
  const encounterUuid = testOrder?.encounter?.uuid;
  const { concept, isLoading: isLoadingTestConcepts } = useOrderConceptByUuid(testOrder?.concept?.uuid);
  const { encounter, isLoading: isLoadingResult } = useLabEncounter(encounterUuid);

  // biome-ignore lint/suspicious/noExplicitAny: third-party FHIR Observation bundle representation
  const { data: fhirObsBundle } = useSWR<any>(
    encounterUuid ? `/ws/fhir2/R4/Observation?encounter=Encounter/${encounterUuid}&_count=100` : null,
    openmrsFetch,
  );

  const targetConceptUuid = testOrder.concept?.uuid || (testOrder as any).conceptUuid;

  const testResultObs = useMemo(() => {
    if (!encounter?.obs || !Array.isArray(encounter.obs)) return undefined;

    // 1. Direct match by order.uuid
    let obs = encounter.obs.find((o) => o?.order?.uuid === testOrder.uuid);

    // 2. Match inside groupMembers by order.uuid
    if (!obs) {
      obs = encounter.obs.find((o) => o?.groupMembers?.some((m: any) => m?.order?.uuid === testOrder.uuid));
    }

    // 3. Fallback by concept.uuid (ONLY for COMPLETED or DRAFT orders, NEVER for PENDING / NEW orders)
    const isCompleted = (testOrder.fulfillerStatus as string) === 'COMPLETED' || (testOrder.fulfillerStatus as string) === 'DRAFT';
    if (!obs && isCompleted && targetConceptUuid) {
      const byConcept = encounter.obs.filter(
        (o) =>
          o?.concept?.uuid === targetConceptUuid ||
          o?.groupMembers?.some((m: any) => m?.concept?.uuid === targetConceptUuid),
      );
      if (byConcept.length > 0) {
        obs = byConcept[byConcept.length - 1];
      }
    }

    return obs;
  }, [encounter, testOrder.uuid, testOrder.fulfillerStatus, targetConceptUuid]);

  const orderObservationComment = useMemo(() => {
    if (!testResultObs) return undefined;
    if (testResultObs.comment) return testResultObs.comment;
    if (testResultObs.groupMembers && Array.isArray(testResultObs.groupMembers)) {
      for (const m of testResultObs.groupMembers) {
        if (m?.comment) return m.comment;
      }
    }
    return undefined;
  }, [testResultObs]);

  const testRows = useMemo(() => {
    const findFhirObs = (obsUuid: string) =>
      fhirObsBundle?.data?.entry?.find(
        // biome-ignore lint/suspicious/noExplicitAny: Entry representation
        (e: any) => e.resource?.id === obsUuid,
      )?.resource;

    if (concept && concept.setMembers && concept.setMembers.length > 0) {
      const leafConcepts = flattenLeafConcepts(concept);

      const findObs = (members: Array<any> | undefined, conceptUuid: string): any => {
        if (!members || !Array.isArray(members)) return undefined;
        for (const m of members) {
          if (m?.concept?.uuid === conceptUuid) return m;
          if (m?.groupMembers && m.groupMembers.length > 0) {
            const f = findObs(m.groupMembers, conceptUuid);
            if (f) return f;
          }
        }
        return undefined;
      };

      return leafConcepts.map((memberConcept) => {
        const memberObs =
          findObs(testResultObs?.groupMembers, memberConcept.uuid) ||
          (testResultObs ? findObs(encounter?.obs, memberConcept.uuid) : undefined);
        const fhirObs = memberObs ? findFhirObs(memberObs.uuid) : null;
        const fhirRanges = extractRangesFromFhirObs(fhirObs);

        return {
          id: memberConcept.uuid,
          testType: (
            <div className={styles.testType}>
              {memberConcept.groupLabel ? `${memberConcept.groupLabel} - ${memberConcept.display}` : memberConcept.display}
            </div>
          ),
          result: isLoadingResult ? <SkeletonText /> : (getObservationValueDisplay(memberObs?.value) ?? '--'),
          normalRange: formatReferenceRange(memberConcept, fhirRanges),
          observations: memberObs?.comment || '--',
        };
      });
    } else if (concept && (!concept.setMembers || concept.setMembers.length === 0)) {
      const fhirObs = testResultObs ? findFhirObs(testResultObs.uuid) : null;
      const fhirRanges = extractRangesFromFhirObs(fhirObs);

      return [
        {
          id: concept.uuid,
          testType: <div className={styles.testType}>{concept.display}</div>,
          result: isLoadingResult ? <SkeletonText /> : (getObservationValueDisplay(testResultObs?.value) ?? '--'),
          normalRange: formatReferenceRange(concept, fhirRanges),
          observations: testResultObs?.comment || '--',
        },
      ];
    } else {
      return [];
    }
  }, [concept, isLoadingResult, testResultObs, fhirObsBundle]);

  const cleanInstructions = testOrder.instructions
    ? testOrder.instructions.replace(/\s*\|\|priorityUuid:[a-fA-F0-9-]+\|\|/g, '').trim()
    : '';

  if (testOrder.fulfillerStatus?.toUpperCase() === 'DECLINED') {
    return (
      <div className={styles.declinedOrderDetails}>
        {!hideInstructions && (
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>{t('instructions', 'Instructions')}:</span>
            <span className={styles.detailValue}>
              {cleanInstructions || t('NoInstructionLeft', 'No instructions are provided.')}
            </span>
          </div>
        )}
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>{t('reasonForDecline', 'Reason for decline')}:</span>
          <span className={styles.detailValue}>{testOrder.fulfillerComment || '--'}</span>
        </div>
        {!hideSupplementalPdf && <ExtensionSlot name="lab-order-pdf-attachments-slot" state={{ order: testOrder }} />}
      </div>
    );
  }

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

  return (
    <div className={styles.testOrder}>
      {cleanInstructions && !hideInstructions && (
        <div className={styles.instructionsContainer}>
          <span className={styles.detailLabel}>{t('instructions', 'Instructions')}:</span>
          <span className={styles.detailValue}>{cleanInstructions}</span>
        </div>
      )}
      {!hideObservations && !(concept?.setMembers && concept.setMembers.length > 0) && orderObservationComment && (
        <div className={styles.instructionsContainer}>
          <span className={styles.detailLabel}>{t('observations', 'Observaciones')}:</span>
          <span className={styles.detailValue}>{orderObservationComment}</span>
        </div>
      )}
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
      {!hideSupplementalPdf && <ExtensionSlot name="lab-order-pdf-attachments-slot" state={{ order: testOrder }} />}
    </div>
  );
};

export default TestOrder;

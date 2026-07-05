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

import styles from './general-order-table.scss';

interface GeneralOrderProps {
  order: Order;
}

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

const GeneralOrderTable: React.FC<GeneralOrderProps> = ({ order }) => {
  const { t } = useTranslation();
  const isTablet = useLayoutType() === 'tablet';
  const { concept, isLoading: isLoadingConcept } = useOrderConceptByUuid(order.concept.uuid);
  const { encounter, isLoading: isLoadingResult } = useLabEncounter(order.encounter.uuid);

  const { data: fhirObsBundle } = useSWR<any>(
    order.encounter.uuid ? `/ws/fhir2/R4/Observation?encounter=Encounter/${order.encounter.uuid}&_count=100` : null,
    openmrsFetch,
  );

  const tableHeaders: Array<{ key: string; header: string }> = [
    {
      key: 'orderName',
      header: order?.orderType?.display,
    },
    {
      key: 'instructions',
      header: t('instructions', 'Instructions'),
    },
    {
      key: 'result',
      header: t('result', 'Result'),
    },
    {
      key: 'normalRange',
      header: t('normalRange', 'Normal range'),
    },
    {
      key: 'referenceNumber',
      header: t('referenceNumberTableHeader', '{{orderType}} reference number', {
        orderType: order?.orderType?.display,
      }),
    },
  ];

  const obs = useMemo(() => {
    if (encounter && concept) {
      return (
        encounter.obs?.find((obs) => obs.order?.uuid === order.uuid) ||
        encounter.obs?.find((obs) => obs.concept.uuid === concept.uuid)
      );
    }
  }, [concept, encounter, order.uuid]);

  const rows = useMemo(() => {
    const findFhirObs = (obsUuid: string) =>
      fhirObsBundle?.data?.entry?.find((e: any) => e.resource?.id === obsUuid)?.resource;

    if (concept && concept.setMembers.length > 0) {
      return concept?.setMembers.map((memberConcept) => {
        const memberObs = obs?.groupMembers?.find((o) => o.concept.uuid === memberConcept.uuid);
        const fhirObs = memberObs ? findFhirObs(memberObs.uuid) : null;
        const fhirRanges = extractRangesFromFhirObs(fhirObs);

        const low = fhirRanges.lowNormal ?? memberConcept.lowNormal;
        const high = fhirRanges.hiNormal ?? memberConcept.hiNormal;

        return {
          id: memberConcept.uuid,
          orderName: <div className={styles.type}>{memberConcept.display}</div>,
          instructions: '--',
          result: isLoadingResult ? <SkeletonText /> : (memberObs?.value.display ?? '--'),
          normalRange: hasNormalRange({ lowNormal: low, hiNormal: high }) ? `${low} - ${high}` : 'N/A',
          referenceNumber: order?.accessionNumber,
        };
      });
    } else if (concept && concept.setMembers.length === 0) {
      const fhirObs = obs ? findFhirObs(obs.uuid) : null;
      const fhirRanges = extractRangesFromFhirObs(fhirObs);

      const low = fhirRanges.lowNormal ?? concept.lowNormal;
      const high = fhirRanges.hiNormal ?? concept.hiNormal;

      return [
        {
          id: concept.uuid,
          orderName: <div className={styles.type}>{concept.display}</div>,
          instructions: order?.instructions ?? '--',
          result: isLoadingResult ? <SkeletonText /> : (obs?.value.display ?? '--'),
          normalRange: hasNormalRange({ lowNormal: low, hiNormal: high }) ? `${low} - ${high}` : 'N/A',
          referenceNumber: order?.accessionNumber,
        },
      ];
    } else {
      return [];
    }
  }, [concept, isLoadingResult, obs, order?.accessionNumber, order?.instructions, fhirObsBundle]);

  return (
    <div className={styles.order}>
      {isLoadingConcept ? (
        <DataTableSkeleton role="progressbar" zebra />
      ) : (
        <DataTable rows={rows} headers={tableHeaders} size={isTablet ? 'lg' : 'sm'} useZebraStyles>
          {({ rows, headers, getHeaderProps, getRowProps, getTableProps, getTableContainerProps }) => (
            <TableContainer {...getTableContainerProps()}>
              <Table {...getTableProps()} aria-label="orders">
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
                        <TableCell key={cell.id} className={styles.cell}>
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

export default GeneralOrderTable;

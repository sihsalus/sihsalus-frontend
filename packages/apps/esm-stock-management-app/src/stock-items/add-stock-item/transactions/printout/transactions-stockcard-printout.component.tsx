import {
  DataTable,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '@carbon/react';
import { ArrowLeft } from '@carbon/react/icons';
import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDisplayDate } from '../../../../core/utils/datetimeUtils';
import { translateStockLocation, translateStockOperationType } from '../../../../core/utils/translationUtils';
import PrintableStockcardTransactionHeader from './printable-stockcard-transaction-header.component';
import styles from './printable-transaction.scss';
import PrintableTransactionFooter from './printable-transaction-footer.component';

type Props = {
  title: string;
  columns: any;
  items: any;
};

const TransactionsStockcardPrintout: React.FC<Props> = ({ columns, items, title }) => {
  const { t } = useTranslation();
  const [mappedData, setMappedData] = useState([]);
  const [patientData, setPatientData] = useState({});

  useEffect(() => {
    const fetchPatients = async () => {
      const patientPromises = items
        .filter((item) => item.patientUuid) // Only fetch for items with patientUuid
        .map(async (item) => {
          const customePresentation = 'custom:(uuid,display,identifiers,links)';
          const url = `${restBaseUrl}/patient/${item.patientUuid}?v=${customePresentation}`;
          const response = await openmrsFetch(url); // Assume `openmrsFetch` is a fetch utility
          return { uuid: item.patientUuid, data: response.data };
        });

      const resolvedPatients = await Promise.all(patientPromises);

      // Map patient UUIDs to their data
      const patientMap = {};
      resolvedPatients.forEach((patient) => {
        patientMap[patient.uuid] = patient.data;
      });

      setPatientData(patientMap); // Save patient data in state
    };

    fetchPatients();
  }, [items]);

  useEffect(() => {
    // Map items with patient data
    const data = items.map((stockItemTransaction) => {
      const patient = stockItemTransaction.patientUuid ? patientData[stockItemTransaction.patientUuid] : null;
      const transactionType = stockItemTransaction?.isPatientTransaction
        ? t('patientDispense', 'Dispensación a paciente')
        : translateStockOperationType(t, stockItemTransaction.stockOperationTypeName);
      const sourceLocation = translateStockLocation(t, stockItemTransaction.operationSourcePartyName);
      const destinationLocation = translateStockLocation(t, stockItemTransaction.operationDestinationPartyName);
      const partyLocation = translateStockLocation(t, stockItemTransaction?.partyName);

      return {
        ...stockItemTransaction,
        id: stockItemTransaction?.uuid,
        key: `key-${stockItemTransaction?.uuid}`,
        uuid: `${stockItemTransaction?.uuid}`,
        date: formatDisplayDate(stockItemTransaction?.dateCreated),
        location:
          stockItemTransaction.operationSourcePartyName && stockItemTransaction.operationDestinationPartyName ? (
            stockItemTransaction.operationSourcePartyName === stockItemTransaction?.partyName ? (
              stockItemTransaction.quantity > 0 ? (
                <>
                  <span className="transaction-location">{sourceLocation}</span>
                  <ArrowLeft size={16} /> {destinationLocation}
                </>
              ) : (
                <>
                  <span className="transaction-location">{sourceLocation}</span>
                  <ArrowLeft size={16} /> {destinationLocation}
                </>
              )
            ) : stockItemTransaction.operationDestinationPartyName === stockItemTransaction?.partyName ? (
              stockItemTransaction.quantity > 0 ? (
                <>
                  <span className="transaction-location">{destinationLocation}</span>
                  <ArrowLeft size={16} /> {sourceLocation}
                </>
              ) : (
                <>
                  <span className="transaction-location">{destinationLocation}</span>
                  <ArrowLeft size={16} /> {sourceLocation}
                </>
              )
            ) : (
              partyLocation
            )
          ) : (
            partyLocation
          ),
        transaction: transactionType,
        quantity: `${stockItemTransaction?.quantity?.toLocaleString()} ${stockItemTransaction?.packagingUomName ?? ''}`,
        batch: stockItemTransaction.stockBatchNo
          ? `${stockItemTransaction.stockBatchNo}${
              stockItemTransaction.expiration ? ` (${formatDisplayDate(stockItemTransaction.expiration)})` : ''
            }`
          : '',
        out:
          stockItemTransaction?.quantity < 0
            ? `${(-1 * stockItemTransaction?.quantity)?.toLocaleString()} ${
                stockItemTransaction?.packagingUomName ?? ''
              } of ${stockItemTransaction.packagingUomFactor}`
            : '',
        totalout:
          stockItemTransaction?.quantity < 0
            ? `${-1 * stockItemTransaction?.quantity * Number(stockItemTransaction.packagingUomFactor)}`
            : '',
        patientId: stockItemTransaction?.patientId ?? '',
        patientUuid: stockItemTransaction?.patientUuid ?? '',
        patientName: patient?.display ?? '', // Use patient display name if available
        patientIdentifier: '',
      };
    });

    setMappedData(data);
  }, [items, patientData, t]);

  return (
    <div>
      <PrintableStockcardTransactionHeader itemName={title} />

      <div className={styles.itemsContainer}>
        <div className={styles.tableContainer}>
          <DataTable data-floating-menu-container rows={mappedData} headers={columns} useZebraStyles>
            {({ rows, headers, getHeaderProps, getTableProps, onInputChange }) => (
              <div>
                <TableContainer>
                  <Table {...getTableProps()}>
                    <TableHead>
                      <TableRow>
                        {headers.map((header) => (
                          <TableHeader key={header.key} {...getHeaderProps({ header })}>
                            {header.header}
                          </TableHeader>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody style={{ fontSize: '8px' }}>
                      {rows.map((row) => (
                        <TableRow key={row.id}>
                          {row.cells.map((cell) => (
                            <TableCell key={cell.id}>{cell.value}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </div>
            )}
          </DataTable>
        </div>
      </div>

      <PrintableTransactionFooter title={''} />
    </div>
  );
};

export default TransactionsStockcardPrintout;

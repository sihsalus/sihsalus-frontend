import { DataTable, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@carbon/react';
import { formatDate, useConfig } from '@openmrs/esm-framework';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { convertToCurrency } from '../../../helpers';
import type { MappedBill } from '../../../types';

type PaymentHistoryProps = {
  bill: MappedBill;
};

const PaymentHistory: React.FC<PaymentHistoryProps> = ({ bill }) => {
  const { t } = useTranslation();
  const { defaultCurrency } = useConfig();
  const headers = [
    {
      key: 'dateCreated',
      header: t('dateOfPayment', 'Date of payment'),
    },
    {
      key: 'amount',
      header: t('billAmount', 'Bill amount'),
    },
    {
      key: 'amountTendered',
      header: t('amountTendered', 'Amount tendered'),
    },
    {
      key: 'paymentMethod',
      header: t('paymentMethod', 'Payment method'),
    },
  ];
  const rows = (bill?.payments ?? [])
    .map((payment, index) => {
      const date = new Date(payment.dateCreated);
      return {
        id: `${payment.uuid}-${index}`,
        dateCreated: formatDate(date),
        amountTendered: convertToCurrency(payment.amountTendered, defaultCurrency),
        amount: convertToCurrency(payment.amount, defaultCurrency),
        paymentMethod: payment.instanceType.name,
        sortKey: date.getTime(),
      };
    })
    .slice()
    .sort((a, b) => b.sortKey - a.sortKey);

  if (Object.values(bill?.payments ?? {}).length === 0) {
    return;
  }

  return (
    <DataTable size="sm" rows={rows} headers={headers}>
      {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
        <Table {...getTableProps()}>
          <TableHead>
            <TableRow>
              {headers.map((header) => {
                const { key, ...headerProps } = getHeaderProps({ header });
                return (
                  <TableHeader key={key} {...headerProps}>
                    {header.header}
                  </TableHeader>
                );
              })}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => {
              const { key, ...rowProps } = getRowProps({ row });
              return (
                <TableRow key={key} {...rowProps}>
                  {row.cells.map((cell) => (
                    <TableCell key={cell.id}>{cell.value}</TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </DataTable>
  );
};

export default PaymentHistory;

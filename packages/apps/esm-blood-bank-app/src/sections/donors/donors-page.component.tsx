import { Button, Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow, Tag } from '@carbon/react';
import { useTranslation } from 'react-i18next';

import type { BloodBankApi } from '../../api';
import { useApiData } from '../../api/use-api-data';
import { moduleName } from '../../constants';
import { DataErrorState, EmptyState } from '../../shared/data-state.component';
import { LoadingState } from '../../shared/loading-state.component';
import { PageHeader } from '../../shared/page-header.component';
import styles from '../../styles/app.scss';

export function DonorsPage({ api }: { api: BloodBankApi }) {
  const { t } = useTranslation(moduleName);
  const { data: donors, error, isLoading } = useApiData(api.getDonors);
  const donorStatusLabels = {
    Apto: t('donorStatusEligible', 'Apto'),
    Diferido: t('donorStatusDeferred', 'Diferido'),
    'En evaluación': t('donorStatusUnderEvaluation', 'En evaluación'),
  };

  if (isLoading) return <LoadingState />;
  if (error || !donors) return <DataErrorState />;

  return (
    <div className={styles.page}>
      <PageHeader description={t('donorsDescription', 'Registro, consulta e historial de las personas donantes.')} title={t('donors', 'Donantes')} />
      <div className={styles.actions}><Button>{t('registerDonor', 'Registrar donante')}</Button></div>
      {donors.length === 0 ? <EmptyState message={t('emptyDonors', 'No hay donantes registrados.')} /> : <TableContainer title={t('donorRegistry', 'Registro de donantes')}>
        <Table useZebraStyles>
          <TableHead><TableRow>{[
            t('code', 'Código'), t('document', 'Documento'), t('name', 'Nombre'), t('bloodGroup', 'Grupo'),
            t('lastDonation', 'Última donación'), t('status', 'Estado'), t('actions', 'Acciones'),
          ].map((label) => <TableHeader key={label}>{label}</TableHeader>)}</TableRow></TableHead>
          <TableBody>
            {donors.map((donor) => (
              <TableRow key={donor.id}>
                <TableCell>{donor.id}</TableCell>
                <TableCell>{donor.documentNumber}</TableCell>
                <TableCell>{donor.fullName}</TableCell>
                <TableCell>{donor.bloodGroup}</TableCell>
                <TableCell>{donor.lastDonationDate}</TableCell>
                <TableCell><Tag type={donor.status === 'Apto' ? 'green' : 'blue'}>{donorStatusLabels[donor.status]}</Tag></TableCell>
                <TableCell><Button kind="ghost" size="sm">{t('viewDetail', 'Ver detalle')}</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>}
    </div>
  );
}

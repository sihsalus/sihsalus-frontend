import { Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow, Tag } from '@carbon/react';
import { useTranslation } from 'react-i18next';

import type { BloodBankApi } from '../../api';
import { useApiData } from '../../api/use-api-data';
import { moduleName } from '../../constants';
import { DataErrorState, EmptyState } from '../../shared/data-state.component';
import { LoadingState } from '../../shared/loading-state.component';
import { PageHeader } from '../../shared/page-header.component';
import styles from '../../styles/app.scss';

export function InventoryPage({ api }: { api: BloodBankApi }) {
  const { t } = useTranslation(moduleName);
  const { data: units, error, isLoading } = useApiData(api.getInventory);
  const inventoryStatusLabels = {
    Disponible: t('inventoryStatusAvailable', 'Disponible'),
    Reservada: t('inventoryStatusReserved', 'Reservada'),
    Cuarentena: t('inventoryStatusQuarantine', 'Cuarentena'),
  };

  if (isLoading) return <LoadingState />;
  if (error || !units) return <DataErrorState />;

  return (
    <div className={styles.page}>
      <PageHeader description={t('inventoryDescription', 'Disponibilidad, ubicación, vencimiento y estado de hemocomponentes.')} title={t('inventory', 'Inventario')} />
      {units.length === 0 ? <EmptyState message={t('emptyInventory', 'No hay unidades registradas.')} /> : <TableContainer title={t('unitsAndComponents', 'Unidades y hemocomponentes')}>
        <Table useZebraStyles>
          <TableHead><TableRow>{[
            t('code', 'Código'), t('component', 'Componente'), t('bloodGroup', 'Grupo'),
            t('expiration', 'Vencimiento'), t('location', 'Ubicación'), t('status', 'Estado'),
          ].map((label) => <TableHeader key={label}>{label}</TableHeader>)}</TableRow></TableHead>
          <TableBody>
            {units.map((unit) => (
              <TableRow key={unit.id}>
                <TableCell>{unit.id}</TableCell>
                <TableCell>{unit.component}</TableCell>
                <TableCell>{unit.bloodGroup}</TableCell>
                <TableCell>{unit.expiresAt}</TableCell>
                <TableCell>{unit.location}</TableCell>
                <TableCell><Tag type={unit.status === 'Disponible' ? 'green' : unit.status === 'Reservada' ? 'purple' : 'gray'}>{inventoryStatusLabels[unit.status]}</Tag></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>}
    </div>
  );
}

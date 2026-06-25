import { Button, DataTableSkeleton, Tag, Tile } from '@carbon/react';
import { View } from '@carbon/react/icons';
import { formatDate } from '@openmrs/esm-framework';
import { launchPatientWorkspace } from '@openmrs/esm-patient-common-lib';
import { RequirePrivilege } from '@sihsalus/esm-rbac';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { fuaReadPrivilege } from '../constant';
import { useFuasByPatient } from '../hooks/useFuaRequests';

import styles from './fua-patient-widget.scss';

interface FuaPatientWidgetProps {
  patientUuid: string;
  maxItems?: number | null;
}

const ESTADO_TAG: Record<string, 'blue' | 'cyan' | 'gray' | 'green' | 'magenta' | 'red'> = {
  Pendiente: 'gray',
  'En Proceso': 'blue',
  Completado: 'green',
  'Enviado a SETI-SIS': 'cyan',
  Rechazado: 'red',
  Cancelado: 'magenta',
};

const FuaPatientWidgetContent: React.FC<FuaPatientWidgetProps> = ({ patientUuid, maxItems = 5 }) => {
  const { t } = useTranslation();
  const { fuaOrders, isLoading, isError } = useFuasByPatient(patientUuid);
  const visibleFuaOrders = maxItems == null ? fuaOrders : fuaOrders.slice(0, maxItems);

  if (isLoading) {
    return <DataTableSkeleton showHeader={false} showToolbar={false} rowCount={3} columnCount={3} />;
  }

  if (isError) {
    return (
      <Tile>
        <p>{t('errorLoadingFua', 'Error al cargar FUA')}</p>
      </Tile>
    );
  }

  if (!fuaOrders.length) {
    return (
      <Tile>
        <p>{t('noFuaForPatient', 'No hay FUAs registrados para este paciente')}</p>
      </Tile>
    );
  }

  return (
    <div className={styles.widgetContainer}>
      <ul className={styles.fuaList}>
        {visibleFuaOrders.map((fua) => (
          <li key={fua.uuid} className={styles.fuaItem}>
            <div className={styles.fuaItemMain}>
              <span className={styles.fuaItemName}>{fua.numeroFua ?? fua.name}</span>
              <Tag type={ESTADO_TAG[fua.fuaEstado?.nombre] ?? 'gray'} size="sm">
                {fua.fuaEstado?.nombre ?? t('noStatus', 'Sin estado')}
              </Tag>
            </div>
            <div className={styles.fuaItemMeta}>
              <span>{formatDate(new Date(fua.fechaCreacion), { mode: 'standard', time: false })}</span>
              <Button
                kind="ghost"
                size="sm"
                renderIcon={View}
                iconDescription={t('viewFua', 'Ver FUA')}
                hasIconOnly
                onClick={() => launchPatientWorkspace('fua-viewer-workspace', { fuaId: fua.uuid })}
              />
            </div>
            {fua.observacionesSetiSis && (
              <div className={styles.fuaObsSetiSis}>
                <strong>SETI-SIS:</strong> {fua.observacionesSetiSis}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

const FuaPatientWidget: React.FC<FuaPatientWidgetProps> = (props) => (
  <RequirePrivilege privilege={fuaReadPrivilege} hideUnauthorized>
    <FuaPatientWidgetContent {...props} />
  </RequirePrivilege>
);

export default FuaPatientWidget;

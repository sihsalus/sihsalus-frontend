import { CheckmarkFilled, CircleDash, EventSchedule, Time, WarningFilled } from '@carbon/react/icons';
import classNames from 'classnames';
import dayjs from 'dayjs';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { ControlStatus } from '../../../hooks/useCREDSchedule';

import styles from './cred-matrix.scss';

export interface CredTileProps {
  uuid?: string;
  controlNumber: number;
  label: string;
  date?: string | Date;
  status: ControlStatus;
  createdByCurrentUser?: boolean;
  onDelete?: (id: string) => void;
}

const STATUS_ICONS: Record<ControlStatus, typeof CheckmarkFilled> = {
  completed: CheckmarkFilled,
  scheduled: EventSchedule,
  overdue: WarningFilled,
  pending: Time,
  future: CircleDash,
};

const CredTile: React.FC<CredTileProps> = ({ label, date, status }) => {
  const { t } = useTranslation();

  const statusLabels: Record<ControlStatus, string> = {
    completed: t('statusCompleted', 'Realizado'),
    scheduled: t('statusScheduled', 'Programado'),
    overdue: t('statusOverdue', 'Vencido'),
    pending: t('statusPending', 'Pendiente'),
    future: t('statusFuture', 'Futuro'),
  };

  const StatusIcon = STATUS_ICONS[status];

  return (
    <div
      className={classNames(styles.ageTile, {
        [styles.tileCompleted]: status === 'completed',
        [styles.tileScheduled]: status === 'scheduled',
        [styles.tileOverdue]: status === 'overdue',
        [styles.tilePending]: status === 'pending',
        [styles.tileFuture]: status === 'future',
      })}
    >
      <div className={styles.tileHeader}>
        <strong>{t('idealAgeSlot', 'Edad programada')}</strong>
        <span className={classNames(styles.statusBadge, styles[`status-${status}`])}>
          <StatusIcon size={12} />
          {statusLabels[status]}
        </span>
      </div>
      <div className={styles.tileLabel}>{label}</div>
      {date && <div className={styles.tileDate}>{dayjs(date).format('DD/MM/YYYY')}</div>}
    </div>
  );
};

export default CredTile;

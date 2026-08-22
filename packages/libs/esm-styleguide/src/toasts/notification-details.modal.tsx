import { Modal } from '@carbon/react';
import { CheckmarkFilled, ErrorFilled, InformationFilled, WarningFilled } from '@carbon/react/icons';
import { getCoreTranslation } from '@openmrs/esm-translations';
import classnames from 'classnames';
import React from 'react';
import styles from './notification-details.module.scss';

export interface NotificationDetailsSection {
  title?: string;
  items: Array<string>;
}

interface NotificationDetailsModalProps {
  description: React.ReactNode;
  kind?: string;
  onClose(): void;
  open: boolean;
  sections?: Array<NotificationDetailsSection>;
  title: string;
}

const statusConfig = {
  error: { icon: ErrorFilled, style: styles.error },
  info: { icon: InformationFilled, style: styles.info },
  success: { icon: CheckmarkFilled, style: styles.success },
  warning: { icon: WarningFilled, style: styles.warning },
};

function getStatusConfig(kind?: string) {
  if (kind === 'error') return statusConfig.error;
  if (kind === 'warning' || kind === 'warning-alt') return statusConfig.warning;
  if (kind === 'info' || kind === 'info-square') return statusConfig.info;
  return statusConfig.success;
}

function PlainDescription({ description }: { description: React.ReactNode }) {
  if (typeof description !== 'string') return <div className={styles.description}>{description}</div>;

  const items = description.split(/,\s+/).filter(Boolean);
  if (items.length < 3) return <p className={styles.description}>{description}</p>;

  return (
    <ul className={styles.list}>
      {items.map((item, index) => (
        <li key={`${item}-${index}`}>{item}</li>
      ))}
    </ul>
  );
}

export function NotificationDetailsModal({
  description,
  kind,
  onClose,
  open,
  sections,
  title,
}: NotificationDetailsModalProps) {
  const { icon: StatusIcon, style: statusStyle } = getStatusConfig(kind);

  return (
    <Modal
      className={classnames(styles.modal, statusStyle)}
      open={open}
      passiveModal
      closeButtonLabel={getCoreTranslation('close', 'Close')}
      modalHeading={
        <span className={styles.heading}>
          <StatusIcon size={20} aria-hidden />
          <span>{title}</span>
        </span>
      }
      onRequestClose={onClose}
      size="sm"
    >
      {sections?.length ? (
        <div className={styles.sections}>
          {sections.map((section, index) => (
            <section key={`${section.title ?? 'details'}-${index}`}>
              {section.title ? <h3 className={styles.sectionTitle}>{section.title}</h3> : null}
              <ul className={styles.list}>
                {section.items.map((item, itemIndex) => (
                  <li key={`${item}-${itemIndex}`}>{item}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <PlainDescription description={description} />
      )}
    </Modal>
  );
}

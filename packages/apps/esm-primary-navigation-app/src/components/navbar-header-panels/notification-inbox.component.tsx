import { Button, HeaderGlobalAction, InlineLoading, InlineNotification, Tile } from '@carbon/react';
import { Notification } from '@carbon/icons-react';
import {
  ExtensionSlot,
  useAssignedExtensions,
  type NotificationInboxItem,
  type NotificationDetailState,
} from '@openmrs/esm-framework';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type useNotificationInbox } from '../../notification-inbox.resource';
import styles from './notification-inbox.scss';

type Inbox = ReturnType<typeof useNotificationInbox>;
export function NotificationInboxButton({
  inbox,
  expanded,
  toggle,
}: {
  inbox: Inbox;
  expanded: boolean;
  toggle: () => void;
}) {
  const { t } = useTranslation();
  if (!inbox.allowed) return null;
  const total = inbox.data?.total;
  return (
    <HeaderGlobalAction
      isActive={expanded}
      onClick={toggle}
      aria-label={
        total === undefined
          ? t('notifications', 'Notifications')
          : t('pendingNotificationCount', '{{count}} unread notifications', { count: total })
      }
    >
      <Notification size={20} />
      {total ? <span className={styles.count}>{total > 99 ? '99+' : total}</span> : null}
    </HeaderGlobalAction>
  );
}

export function NotificationInboxPanel({
  inbox,
  offset,
  setOffset,
}: {
  inbox: Inbox;
  offset: number;
  setOffset: (offset: number) => void;
}) {
  const { t, i18n } = useTranslation();
  const [selected, setSelected] = useState<NotificationInboxItem>();
  const extensions = useAssignedExtensions('notification-inbox-detail-slot');
  if (!inbox.allowed) return null;
  if (selected) {
    const matching = extensions.filter((extension) => extension.meta?.notificationType === selected.type);
    const state: NotificationDetailState = {
      notification: selected,
      sessionKey: inbox.sessionKey,
      markRead: () => inbox.markRead(selected.id),
      back: () => setSelected(undefined),
    };
    return matching.length === 1 ? (
      <ExtensionSlot
        name="notification-inbox-detail-slot"
        select={(assigned) => assigned.filter((extension) => extension.id === matching[0].id)}
        state={state}
      />
    ) : (
      <div className={styles.content}>
        <Button kind="ghost" size="sm" onClick={state.back}>
          {t('backToNotifications', 'Back to notifications')}
        </Button>
        <InlineNotification
          kind="error"
          lowContrast
          hideCloseButton
          title={t('notificationDetailUnavailable', 'This notification is unavailable. It remains unread.')}
        />
      </div>
    );
  }
  return (
    <div className={styles.content}>
      <Button
        kind="ghost"
        size="sm"
        onClick={() => void inbox.mutate().catch(() => undefined)}
        disabled={inbox.isValidating}
      >
        {t('refreshNotifications', 'Refresh')}
      </Button>
      {inbox.error ? (
        <InlineNotification
          kind="error"
          lowContrast
          hideCloseButton
          title={t('notificationInboxError', 'Could not load notifications. Retry to confirm the current list.')}
        />
      ) : null}
      {inbox.isLoading ? <InlineLoading description={t('loadingNotifications', 'Loading notifications')} /> : null}
      {!inbox.error && inbox.data?.total === 0 ? (
        <Tile>{t('noUnreadNotifications', 'No unread notifications')}</Tile>
      ) : null}
      <ul className={styles.list}>
        {inbox.data?.items.map((item) => (
          <li key={item.id} className={styles.item}>
            <strong>{item.content.title}</strong>
            <p>{item.content.subtitle}</p>
            <time dateTime={item.createdAt}>
              {new Date(item.createdAt).toLocaleString(i18n.resolvedLanguage || i18n.language, {
                dateStyle: 'short',
                timeStyle: 'short',
              })}
            </time>
            <Button kind="ghost" size="sm" onClick={() => setSelected(item)} disabled={Boolean(inbox.error)}>
              {t('openNotification', 'Open notification')}
            </Button>
          </li>
        ))}
      </ul>
      {offset > 0 || inbox.data?.hasMore ? (
        <div className={styles.actions}>
          <Button
            kind="ghost"
            size="sm"
            disabled={offset === 0 || inbox.isValidating}
            onClick={() => setOffset(Math.max(0, offset - 20))}
          >
            {t('previousNotifications', 'Previous')}
          </Button>
          <Button
            kind="ghost"
            size="sm"
            disabled={!inbox.data?.hasMore || inbox.isValidating}
            onClick={() => setOffset(offset + 20)}
          >
            {t('nextNotifications', 'Next')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

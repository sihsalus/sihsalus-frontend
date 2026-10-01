/** State passed by the common inbox to a trusted module's detail extension. */
export type NotificationInboxItem = {
  id: number;
  type: string;
  subjectUuid: string;
  createdAt: string;
  content: { title: string; subtitle: string; [key: string]: unknown };
};
export type NotificationDetailState = {
  notification: NotificationInboxItem;
  sessionKey: string | null;
  markRead: () => Promise<void>;
  back: () => void;
};

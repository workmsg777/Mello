export enum NotificationKind {
  MESSAGE = 'MESSAGE',
  LIKE = 'LIKE',
  MATCH = 'MATCH',
  DATE_INVITED = 'DATE_INVITED',
  DATE_ACCEPTED = 'DATE_ACCEPTED',
  DATE_DECLINED = 'DATE_DECLINED',
  DATE_CANCELLED = 'DATE_CANCELLED',
  DATE_REQUEST = 'DATE_REQUEST',
  VENUE_CONFIRMED = 'VENUE_CONFIRMED',
  VENUE_DECLINED = 'VENUE_DECLINED',
  OFFER_PUBLISHED = 'OFFER_PUBLISHED',
  EVENT_PUBLISHED = 'EVENT_PUBLISHED',
}
export type NotificationCategory =
  'messages' | 'dates' | 'matches' | 'likes' | 'offers';
export interface NotificationInput {
  key: string;
  kind: NotificationKind;
  category: NotificationCategory;
  title: string;
  body: string;
  data: {
    matchId?: string;
    planId?: string;
    venueId?: string;
    contentId?: string;
    messageId?: string;
    sequence?: number;
  };
}
export interface InboxNotification {
  id: string;
  kind: NotificationKind;
  category: NotificationCategory;
  title: string;
  body: string;
  data: NotificationInput['data'];
  createdAt: string;
  readAt: string | null;
}
export const notificationColumns = `id,kind,category,title,body,data,created_at AS "createdAt",read_at AS "readAt"`;
export const defaultPreferences = {
  messages: true,
  dates: true,
  matches: true,
  likes: true,
  offers: true,
  push: true,
};

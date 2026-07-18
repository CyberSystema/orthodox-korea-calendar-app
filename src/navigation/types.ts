import type { Announcement } from '../services/api/announcementsRepository';

export type MainTabsParamList = {
  Today: undefined;
  Month: { year?: number; month?: number } | undefined;
  Announcements: undefined;
};

export type RootStackParamList = {
  MainTabs: undefined;
  EventDetail: { eventId: string; dateISO?: string };
  AnnouncementDetail: { announcement: Announcement };
  Settings: undefined;
  SecretMenu: undefined;
};

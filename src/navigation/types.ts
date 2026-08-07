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
  Staff: undefined;
  /** Owner sideloads only — the route is not registered in store builds. */
  Diagnostics: undefined;
  SecretMenu: undefined;
};

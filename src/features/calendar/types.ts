import type { SupportedLanguage } from '../../types/language';

export type LocalizedText = {
  en: string;
  ko: string;
};

export type LiturgicalRank = 'great-feast' | 'major-feast' | 'commemoration' | 'fast-day';
export type EventRecurrence = 'none' | 'daily' | 'weekly' | 'monthly';
export type EventNotificationTarget = 'all' | 'english' | 'korean';

export type CelebrationEntry = {
  id: string;
  title: LocalizedText;
  highRank?: boolean;
  feast?: boolean;
  celeb?: boolean;
  readings?: string[];
  tone?: string;
  matinsGospel?: string;
};

export type LiturgicalDay = {
  dateISO: string;
  fast: boolean;
  cheese: boolean;
  fish: boolean;
  presanctified: boolean;
  saintBasil: boolean;
  divineLiturgy: boolean;
  readings: string[];
  readingsLocalized?: {
    en: string[];
    ko: string[];
  };
  celebrations: CelebrationEntry[];
  saints?: CelebrationEntry[];
  celebrationsLocalized?: {
    en: CelebrationEntry[];
    ko: CelebrationEntry[];
  };
  saintsLocalized?: {
    en: CelebrationEntry[];
    ko: CelebrationEntry[];
  };
  otherInformation?: string[];
};

export type LiturgicalEvent = {
  id: string;
  dateISO: string;
  seriesStartDate?: string;
  title: LocalizedText;
  summary: LocalizedText;
  details: LocalizedText;
  rank: LiturgicalRank;
  eventType?: string;
  color?: string;
  allDay?: boolean;
  notify?: boolean;
  notificationTarget?: EventNotificationTarget;
  recurrence?: EventRecurrence;
  /** Every N periods (e.g. 2 = every other week). Defaults to 1 when absent. */
  recurrenceInterval?: number;
  /** Series end date (YYYY-MM-DD); occurrences stop after it. Absent = open-ended. */
  recurrenceUntil?: string;
  createdAt?: string;
  updatedAt?: string;
  isAdminDraft?: boolean;
};

export function localized(value: LocalizedText, language: SupportedLanguage): string {
  return value[language] ?? value.en;
}

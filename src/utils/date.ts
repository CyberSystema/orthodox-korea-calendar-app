import dayjs from 'dayjs';
import 'dayjs/locale/ko';

export function formatDisplayDate(isoDate: string, language: 'en' | 'ko') {
  return dayjs(isoDate)
    .locale(language)
    .format(language === 'ko' ? 'YYYY년 M월 D일 dddd' : 'dddd, MMMM D, YYYY');
}

/**
 * Localized, self-contained relative time ("2 hours ago" / "2시간 전") from a Unix
 * epoch-seconds timestamp. Kept dependency-free (no dayjs relativeTime plugin) so
 * both locales are guaranteed regardless of plugin/locale registration order.
 * Falls back to an absolute date once the event is more than ~a week old.
 */
export function formatRelativeTime(
  unixSeconds: number,
  language: 'en' | 'ko',
  nowMs = Date.now(),
): string {
  const then = unixSeconds * 1000;
  const diffMs = nowMs - then;
  const isKo = language === 'ko';

  // Guard against clock skew (a timestamp slightly in the future).
  if (diffMs < 0) {
    return isKo ? '방금' : 'just now';
  }

  const sec = Math.floor(diffMs / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);

  if (sec < 45) return isKo ? '방금' : 'just now';
  if (min < 60) {
    const n = Math.max(1, min);
    return isKo ? `${n}분 전` : `${n} minute${n === 1 ? '' : 's'} ago`;
  }
  if (hr < 24) {
    return isKo ? `${hr}시간 전` : `${hr} hour${hr === 1 ? '' : 's'} ago`;
  }
  if (day < 7) {
    return isKo ? `${day}일 전` : `${day} day${day === 1 ? '' : 's'} ago`;
  }

  return dayjs(then)
    .locale(language)
    .format(isKo ? 'YYYY년 M월 D일' : 'MMM D, YYYY');
}

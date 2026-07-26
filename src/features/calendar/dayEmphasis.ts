/**
 * How a date should be emphasised in the UI — the single source of truth for the
 * "Sunday is red, Saturday is blue" colour code.
 *
 *   'crimson' — Sundays, high-rank commemorations, and Saturdays that carry a
 *               celebration (`"celeb": true` in the calendar JSON, which marks the
 *               national holidays). Rendered as the filled crimson date circle and
 *               the crimson day number.
 *   'blue'    — every other Saturday.
 *   'none'    — ordinary weekdays: outline circle, default number colour.
 *
 * Both the date circle (LiturgicalDayPanel) and the month grid (MonthScreen) read
 * this, so the two surfaces cannot drift apart.
 */
export type DayEmphasis = 'crimson' | 'blue' | 'none';

export function getDayEmphasis(input: {
  /** 0 = Sunday … 6 = Saturday, as returned by Date.getDay(). */
  dayOfWeek: number;
  hasHighRank: boolean;
  hasCelebration: boolean;
}): DayEmphasis {
  const { dayOfWeek, hasHighRank, hasCelebration } = input;
  const isSunday = dayOfWeek === 0;
  const isSaturday = dayOfWeek === 6;

  // Crimson wins: a Saturday that is also a high-rank day or a celebration is not
  // demoted to blue.
  if (isSunday || hasHighRank || (isSaturday && hasCelebration)) return 'crimson';
  if (isSaturday) return 'blue';
  return 'none';
}

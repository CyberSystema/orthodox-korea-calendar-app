export const spacing = {
  /** 4px — tight gaps, pip spacing */
  xs: 4,
  /** 8px — small gaps, intra-element */
  sm: 8,
  /** 12px — standard gap, card padding */
  md: 12,
  /** 16px — section gaps, screen padding */
  lg: 16,
  /** 24px — large sections */
  xl: 24,
  /** 32px — page-level spacing */
  xxl: 32,
} as const;

export const radii = {
  /** 4px — small elements (pips, ticks) */
  sm: 4,
  /** 8px — cards, inputs */
  md: 8,
  /** 14px — large cards, panels */
  lg: 14,
  /** 999px — pills, circular buttons */
  full: 999,
} as const;

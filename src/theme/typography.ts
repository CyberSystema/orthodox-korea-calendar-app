import { Platform } from 'react-native';

export const typography = {
  family: {
    /** Serif — headings, date numbers, liturgical titles */
    heading: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    /** Sans-serif — body copy, labels, buttons */
    body: Platform.select({ ios: 'System', android: 'sans-serif', default: 'sans-serif' }),
  },
  size: {
    /** 11px — pip labels, micro captions */
    xxs: 11,
    /** 12px — meta text, week headers */
    xs: 12,
    /** 13px — small labels, badges */
    sm: 13,
    /** 15px — body text (matches web 15px base) */
    md: 15,
    /** 17px — section titles, day names */
    lg: 17,
    /** 20px — month labels, modal titles */
    xl: 20,
    /** 28px — page heroes, large numerals */
    xxl: 28,
    /** 34px — date ring numbers */
    hero: 34,
  },
  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
} as const;

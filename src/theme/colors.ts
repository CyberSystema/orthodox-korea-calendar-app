/* ═══════════════════════════════════════════════════════════
   ORTHODOX KOREA CALENDAR — Byzantine Manuscript Color System
   Mirrors the web app's CSS custom properties for visual parity.
   ═══════════════════════════════════════════════════════════ */

export const colors = {
  // ── Manuscript Palette (wine / crimson / gold) ──
  primary: '#5C1414', // --wine
  primaryDeep: '#3A0A0A', // --wine-deep
  primarySoft: '#7A2020', // --wine-soft
  crimson: '#8C1B1B', // --crimson
  crimsonLight: '#A52A2A', // --crimson-light
  accent: '#B8942E', // --gold
  accentBright: '#D4AF52', // --gold-bright
  accentPale: '#E8D48A', // --gold-pale
  accentDim: 'rgba(184,148,46,0.35)', // --gold-dim
  accentGlow: 'rgba(184,148,46,0.08)', // --gold-glow
  accentSubtle: 'rgba(212,175,82,0.12)', // --gold-subtle (icon bg on dark surfaces)
  brandText: '#EEDFAE', // --gold-text (headings on dark surfaces)

  accentLine: 'rgba(212,175,82,0.35)', // --gold-line (decorative lines on dark surfaces)
  crimsonTint: 'rgba(140,27,27,0.05)', // --crimson-tint (high-rank backgrounds)

  // ── Parchment Surfaces ──
  background: '#F0E8D8', // --parchment
  backgroundLight: '#F7F2E8', // --parchment-light
  backgroundWarm: '#E8DDC8', // --parchment-warm
  backgroundDeep: '#D8CCB4', // --parchment-deep
  surface: '#FAF6EE', // --surface
  surfaceWhite: '#FFFDF8', // --surface-white

  // ── Inks ──
  textPrimary: '#1A1008', // --ink
  textBody: '#2C2418', // --ink-body
  textSoft: '#564A3A', // --ink-soft
  textSecondary: '#8A7C68', // --ink-muted
  textFaint: '#B0A48E', // --ink-faint
  textGhost: '#CCC2AE', // --ink-ghost

  // ── Structure ──
  border: '#D0C4AA', // --line
  borderLight: '#E0D8C4', // --line-light

  // ── Semantic ──
  danger: '#8C1B1B', // same as crimson
  /** Saturday emphasis — the blue counterpart to Sunday's crimson date circle.
   *  Same blue as the presanctified/event pips, so the palette stays coherent. */
  saturday: '#3060B8',

  // ── Pip / Indicator Colors (from web DayCell) ──
  pipFast: '#6D3CAD', // purple — fasting
  pipLiturgy: '#B8942E', // gold — divine liturgy
  pipPres: '#3060B8', // blue — presanctified
  pipBasil: '#A85C20', // brown — St. Basil
  pipEvent: '#3060B8', // blue — parish events

  // ── Tab Bar ──
  tabInactive: '#8A7C68',
  tabActive: '#5C1414',

  // ── Overlays ──
  backdropDark: 'rgba(26,16,8,0.42)',
} as const;

/* Pre-composed shadow styles for React Native */
export const shadows = {
  warm: {
    shadowColor: '#1A1008',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  lifted: {
    shadowColor: '#1A1008',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 6,
  },
  deep: {
    shadowColor: '#1A1008',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.15,
    shadowRadius: 48,
    elevation: 12,
  },
} as const;

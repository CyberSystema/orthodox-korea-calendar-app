import { useAppStore } from '../store/useAppStore';
import { useTheme } from './useTheme';

/**
 * The face for chrome React Navigation draws ITSELF — tab labels and native
 * header titles.
 *
 * These never reach ScaledText, so they were left on `typography.family.heading`,
 * which is a PLATFORM font: Georgia on iOS, `serif` on Android. Two consequences,
 * both visible:
 *
 *   - the app's own face (EB Garamond / Spectral) sat right above a tab bar set
 *     in Georgia, so the label and the page it labelled were different types;
 *   - Georgia has no Hangul, so the Korean labels fell out to the system gothic
 *     while the page was set in Nanum Myeongjo — a third face on one screen. And
 *     since Android resolves `serif` to Noto Serif, the same build looked
 *     different on the two platforms for no reason anyone chose.
 *
 * Chrome labels are ALWAYS translated strings, so unlike body text this can key
 * on the reader's language rather than on content: when the app is in Korean,
 * every one of these labels is Korean.
 */
export function useChromeFont(): string {
  const design = useTheme().design;
  const korean = useAppStore((state) => state.language) === 'ko';
  return korean ? design.fontKorean : design.fontHeading;
}

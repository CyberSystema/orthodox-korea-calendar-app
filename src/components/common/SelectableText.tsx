import type { TextProps } from 'react-native';

import { colors } from '../../theme/colors';
import { Text } from './ScaledText';

/**
 * Day content the reader is allowed to select, so a saint's name or a scripture
 * reference can be copied out and looked up online.
 *
 * SCOPE IS DELIBERATE — this is opt-in per element, not a blanket setting. It
 * goes on the day's CONTENT (readings, observances, saints, the extra tone and
 * matins lines) and nowhere else. Notably NOT on:
 *   - the liturgical flag badges (LiturgicalFlagsRow), which are status icons
 *     rather than text to research;
 *   - the date header and section headings, which are chrome;
 *   - parish events, whose card is a Pressable that opens the event — a text
 *     selection gesture there would fight the tap.
 *
 * Selection is the platform's own: long-press starts it, drag handles move the
 * start and end points, and the menu that appears is the OS one — Copy plus,
 * on both platforms, a web-search/look-up entry, which is the point of the
 * feature. Nothing here reimplements that; a hand-rolled menu would need a
 * native clipboard module and would offer strictly less.
 */
export function SelectableText(props: TextProps) {
  // `selectionColor` is Android-only for Text; iOS uses the system tint.
  return <Text selectable selectionColor={colors.accentDim} {...props} />;
}

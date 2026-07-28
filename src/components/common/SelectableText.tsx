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
 * Selection is the platform's own, and the two platforms differ — verified on
 * device and against the RN 0.86 sources, so do not assume parity:
 *
 *   Android — the full thing. Long-press selects a word, drag handles adjust the
 *   start and end points, and the OS menu offers Copy / Share / Select all plus
 *   a web-search entry in the overflow.
 *
 *   iOS — COPY ONLY, and it copies the WHOLE element. There are no drag handles
 *   and no partial selection. `RCTParagraphComponentView.canPerformAction:`
 *   answers YES for `copy:` and nothing else, and its `copy:` serialises
 *   `NSMakeRange(0, attributedText.length)` — the entire node. The legacy
 *   `RCTTextView` does the same, so this is not an architecture question.
 *
 * That is still enough for the feature's purpose (lift a saint's name or a
 * scripture reference and paste it into a search), which is why it stands.
 * Getting true start/end selection on iOS means rendering a read-only multiline
 * TextInput instead of Text — that buys UIKit's real selection UI, at the cost
 * of TextInput's layout quirks and of reading as a text field to VoiceOver.
 */
export function SelectableText(props: TextProps) {
  // `selectionColor` is Android-only for Text; iOS uses the system tint.
  return <Text selectable selectionColor={colors.accentDim} {...props} />;
}

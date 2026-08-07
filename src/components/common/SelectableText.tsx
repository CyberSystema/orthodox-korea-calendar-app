import { Children, isValidElement, type ReactNode } from 'react';
import { Platform, StyleSheet, type TextProps } from 'react-native';

import { useTheme, useThemedStyles, type ResolvedTheme } from '../../theme/useTheme';
import { Text, TextInput } from './ScaledText';

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
 * TWO IMPLEMENTATIONS, because `<Text selectable>` is not cross-platform.
 *
 *   Android renders a Text. That already gives the whole experience: long-press
 *   selects a word, drag handles adjust the start and end points, and the OS
 *   menu offers Copy / Share / Select-all plus web search.
 *
 *   iOS renders a READ-ONLY MULTILINE TextInput, because a Text there is
 *   Copy-only and copies the whole node: `RCTParagraphComponentView`'s
 *   `canPerformAction:` answers YES for `copy:` and nothing else, and its
 *   `copy:` serialises `NSMakeRange(0, attributedText.length)`. There are no
 *   selection handles and no selection rects, and legacy `RCTTextView` behaves
 *   the same, so it is not an old-arch/new-arch question. A non-editable
 *   UITextView keeps UIKit's real selection UI: RN maps `editable={false}`
 *   straight onto `UITextView.editable` and never touches `selectable` (which
 *   defaults YES), so handles, Copy, Look Up, Share and Translate all survive.
 *
 * Why this stays visually identical to a Text on iOS: RN drives
 * `textContainerInset` from the style's own padding and pins
 * `lineFragmentPadding` to 0, so `padding: 0` leaves no inset for the TextInput
 * to add. `scrollEnabled={false}` lets it size to its content instead of
 * becoming a scroller.
 *
 * Both branches go through ScaledText, so Settings → Text Size keeps working —
 * ScaledText exports a TextInput that applies the very same scaling.
 */
export function SelectableText({ children, style, ...rest }: TextProps) {
  const th = useTheme();
  const styles = useThemedStyles(makeStyles);
  const plain = Platform.OS === 'ios' ? toPlainText(children) : null;

  // Not iOS, or children this cannot faithfully flatten (an element child, say).
  // Falling back to Text loses iOS's selection range but never loses CONTENT,
  // which is the failure that would actually matter.
  if (plain === null) {
    return (
      <Text selectable selectionColor={th.accentDim} style={style} {...rest}>
        {children}
      </Text>
    );
  }

  return (
    <TextInput
      value={plain}
      editable={false}
      multiline
      scrollEnabled={false}
      selectionColor={th.accentDim}
      // Without this VoiceOver announces each of these as a text field.
      accessibilityRole="text"
      style={[styles.iosTextReset, style]}
      {...rest}
    />
  );
}

const makeStyles = (th: ResolvedTheme) =>
  ({
    // Listed BEFORE `style` so a caller's own padding still wins.
    iosTextReset: { padding: 0 },
  }) as const;

/**
 * Flatten JSX children to the plain string a TextInput needs for `value`.
 *
 * Call sites interpolate (`{labels.tone} {item.tone}` arrives as three separate
 * children — including the literal space), so this has to concatenate rather
 * than expect a single string. Returns null when it meets a node it cannot
 * represent, which is the caller's signal to render a Text instead.
 */
function toPlainText(children: ReactNode): string | null {
  let out = '';
  let ok = true;

  Children.toArray(children).forEach((child) => {
    if (typeof child === 'string' || typeof child === 'number') {
      out += String(child);
    } else if (isValidElement(child)) {
      ok = false;
    }
    // Children.toArray has already dropped null/undefined/boolean for us.
  });

  return ok ? out : null;
}

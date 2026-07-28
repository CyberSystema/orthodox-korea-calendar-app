import {
  StyleSheet,
  Text as RNText,
  TextInput as RNTextInput,
  type TextInputProps,
  type TextProps,
  type TextStyle,
} from 'react-native';

import { useAppStore } from '../../store/useAppStore';
import { MAX_TOTAL_FONT_SCALE } from '../../theme/fontScale';

/**
 * Multiply a style's own fontSize/lineHeight by the app scale, leaving every
 * other declaration (and every conditional array entry) untouched.
 */
function scaleTextStyle(style: TextProps['style'], appScale: number) {
  const flat = StyleSheet.flatten(style) as TextStyle | undefined;
  const fontSize = typeof flat?.fontSize === 'number' ? flat.fontSize : undefined;
  const lineHeight = typeof flat?.lineHeight === 'number' ? flat.lineHeight : undefined;

  // No own fontSize means the size is inherited from an enclosing Text that we
  // already scaled — leave it alone rather than double-applying.
  if (fontSize === undefined) return style;

  return [
    style,
    {
      fontSize: fontSize * appScale,
      ...(lineHeight === undefined ? null : { lineHeight: lineHeight * appScale }),
    },
  ];
}

/**
 * `Text`, but honouring the reader's in-app text size (Settings → Text Size).
 *
 * Screens import this INSTEAD of `react-native`'s `Text` — same name, same
 * props, so only the import line changes and every existing StyleSheet stays
 * exactly as written:
 *
 *     import { Pressable, StyleSheet, View } from 'react-native';
 *     import { Text } from '../../components/common/ScaledText';
 *
 * Why a wrapper and not something more central:
 *   - `Text.defaultProps` is dead — RN's Text is a function component and React
 *     19 dropped defaultProps for those, so it is silently ignored.
 *   - Style inheritance only flows Text-inside-Text, and every screen root is a
 *     `<View>`, so a root-level style reaches nothing.
 *   - `typography.size.*` is read inside module-level `StyleSheet.create` calls
 *     that run at import time, long before the persisted setting is readable
 *     (SecureStore has no synchronous read). Any solution has to apply at
 *     render time.
 *
 * Opting out: pass `allowFontScaling={false}`. That already means "this glyph is
 * pinned to a fixed box, don't grow it" for the OS scale, and here it suppresses
 * the app scale too — which is what every icon-as-text (✓, ‹ ›, the tab-bar day
 * number) wants.
 *
 * A matching `TextInput` is exported for the search and event-editor fields.
 * The two `secureTextEntry` passcode fields (PromptModal, Settings) keep using
 * react-native's own TextInput: they carry the native fixes for the iOS
 * Password AutoFill freeze, and nothing about a credential field is easier to
 * read for being bigger.
 */
export function Text({ style, ref, ...rest }: TextProps & { ref?: React.Ref<RNText> }) {
  const appScale = useAppStore((state) => state.fontScale);
  const enabled = rest.allowFontScaling !== false;

  // RN multiplies the OS scale on top of whatever size we hand it; this bounds
  // that half so appScale × osScale can never exceed MAX_TOTAL_FONT_SCALE — the
  // ceiling the fixed-geometry parts of the UI were verified against.
  const maxFontSizeMultiplier = MAX_TOTAL_FONT_SCALE / appScale;

  // Default install: one comparison per Text, no flatten, no new style object.
  if (!enabled || appScale === 1) {
    return (
      <RNText ref={ref} maxFontSizeMultiplier={maxFontSizeMultiplier} {...rest} style={style} />
    );
  }

  return (
    <RNText
      ref={ref}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      {...rest}
      style={scaleTextStyle(style, appScale)}
    />
  );
}

/** `TextInput` sized by the same setting. See the note in the header above. */
export function TextInput({
  style,
  ref,
  ...rest
}: TextInputProps & { ref?: React.Ref<RNTextInput> }) {
  const appScale = useAppStore((state) => state.fontScale);
  const enabled = rest.allowFontScaling !== false;
  const maxFontSizeMultiplier = MAX_TOTAL_FONT_SCALE / appScale;

  if (!enabled || appScale === 1) {
    return (
      <RNTextInput
        ref={ref}
        maxFontSizeMultiplier={maxFontSizeMultiplier}
        {...rest}
        style={style}
      />
    );
  }

  return (
    <RNTextInput
      ref={ref}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      {...rest}
      style={scaleTextStyle(style, appScale)}
    />
  );
}

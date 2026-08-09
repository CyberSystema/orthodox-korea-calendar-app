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
import { DIRECTION_DESIGN } from '../../theme/direction';
import { typography } from '../../theme/typography';

/**
 * The active direction's face for a style's declared family.
 *
 * WHY HERE. Every user-facing string already routes through this wrapper — the
 * `check:scaled-text` guard enforces it — so this one function can restyle the
 * whole app's typography. Screens keep writing
 * `fontFamily: typography.family.heading` and get Spectral or EB Garamond
 * depending on the direction, with not one stylesheet edited.
 *
 * KOREAN IS CHOSEN BY THE TEXT, NOT BY THE READER'S LANGUAGE.
 *
 * A serif picked for English has no Hangul, so Hangul set in it would fall back
 * to the system face and look unrelated — that much is real, and it is why a
 * Korean face exists. But the rule used to be "the reader chose Korean, so set
 * EVERYTHING in the Korean face", and a language setting is not a statement
 * about any particular string. Plenty of the app is not Korean even in Korean:
 * the brand name, which is never translated; scripture references; years, tones
 * and gospel numbers.
 *
 * Measured on the iPad, English against Korean, same string in the same box:
 * "ORTHODOX KOREA" was drawn 547px wide in one and 567px in the other, 9.7% of
 * its pixels different — the brand reset in a Korean serif for readers who never
 * asked for that and cannot turn it off.
 *
 * So the face follows the CONTENT. A run containing Hangul gets the Korean serif
 * because it must; everything else keeps the English face, in both languages.
 * Mixed strings ("2026년 8월") take the Korean face for the whole run, which is
 * correct — the alternative is a fallback hole where the Hangul should be.
 */
const HANGUL = /[가-힣ᄀ-ᇿ㄰-㆏ꥠ-꥿ힰ-퟿ﾠ-ￜ]/;

/**
 * Does this node's OWN text carry Hangul?
 *
 * Deliberately does not recurse into elements. A nested `<Text>` is itself a
 * ScaledText and answers this question for its own content, so descending would
 * make an outer run adopt the Korean face because of a child that had already
 * handled itself — which is the "everything becomes Korean" bug in miniature.
 */
function hasHangul(node: React.ReactNode): boolean {
  if (typeof node === 'string') return HANGUL.test(node);
  if (Array.isArray(node)) return node.some(hasHangul);
  return false;
}

/**
 * Is this weight asking for the heavier CUT of the face?
 *
 * >= 600, not > 400: there is no Medium file, so `typography.weight.medium`
 * ('500') has to stay on the regular cut rather than jumping to semibold.
 */
function wantsStrong(weight: TextStyle['fontWeight']): boolean {
  const n = typeof weight === 'number' ? weight : Number(weight);
  return Number.isFinite(n) ? n >= 600 : weight === 'bold';
}

/**
 * A DECLARED WEIGHT HAS TO REACH A REAL FACE.
 *
 * Spectral-SemiBold's name table calls it its own family — "Spectral SemiBold",
 * with no typographic-family record tying it back to "Spectral". So asking for
 * family "Spectral" at weight 600 finds ONE registered face on iOS, the closest-
 * weight search can only land on 400, and the weight is dropped in silence. On
 * Android it is worse at 700: nothing is cached for BOLD, so it falls through to
 * `Typeface.create("Spectral", BOLD)` and comes back as ROBOTO bold — the serif
 * lost outright.
 *
 * This did not bite while body copy was the system sans, which has real weights
 * at every step. It began to bite the moment both directions set a real family
 * for body. So the weight is resolved HERE, to the named strong file, and the
 * numeric weight is then cleared — otherwise the platform would try to embolden
 * an already-semibold face on top of it.
 */
function directionFamily(
  family: string | undefined,
  design: (typeof DIRECTION_DESIGN)[keyof typeof DIRECTION_DESIGN],
  korean: boolean,
  strong: boolean,
): string | undefined {
  if (family === undefined) return undefined;
  // Nanum Myeongjo is registered as a single face, so Korean has no heavier cut
  // to reach for. Leaving the weight in place is correct there.
  if (korean) return design.fontKorean;
  // Only the app's own two logical roles are remapped. Anything else (a system
  // font asked for deliberately, an icon face) is left exactly as written.
  if (family === typography.family.heading) {
    return strong ? (design.fontHeadingStrong ?? design.fontHeading) : design.fontHeading;
  }
  if (family === typography.family.body) {
    return strong
      ? (design.fontBodyStrong ?? design.fontBody ?? family)
      : (design.fontBody ?? family);
  }
  return family;
}

/**
 * Multiply a style's own fontSize/lineHeight by the app scale and swap in the
 * direction's typeface, leaving every other declaration untouched.
 */
function scaleTextStyle(
  style: TextProps['style'],
  appScale: number,
  design: (typeof DIRECTION_DESIGN)[keyof typeof DIRECTION_DESIGN],
  korean: boolean,
) {
  const flat = StyleSheet.flatten(style) as TextStyle | undefined;
  const fontSize = typeof flat?.fontSize === 'number' ? flat.fontSize : undefined;
  const lineHeight = typeof flat?.lineHeight === 'number' ? flat.lineHeight : undefined;
  const strong = !korean && wantsStrong(flat?.fontWeight);
  const fontFamily = directionFamily(flat?.fontFamily, design, korean, strong);

  const familyPatch =
    fontFamily && fontFamily !== flat?.fontFamily
      ? // Clearing the numeric weight is part of the substitution: the file IS
        // the semibold, and asking the platform for 600 on top of it invites a
        // synthetic emboldening or a fallback to a family that has one.
        strong
        ? { fontFamily, fontWeight: 'normal' as const }
        : { fontFamily }
      : null;

  // No own fontSize means the size is inherited from an enclosing Text that we
  // already scaled — leave the size alone rather than double-applying, but still
  // let the family through.
  if (fontSize === undefined) {
    return familyPatch ? [style, familyPatch] : style;
  }

  return [
    style,
    {
      fontSize: fontSize * appScale,
      ...(lineHeight === undefined ? null : { lineHeight: lineHeight * appScale }),
      ...familyPatch,
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
  const design = DIRECTION_DESIGN[useAppStore((state) => state.direction)];
  // From the CONTENT, not the language — see the note above directionFamily.
  const korean = hasHangul(rest.children);
  const enabled = rest.allowFontScaling !== false;

  // RN multiplies the OS scale on top of whatever size we hand it; this bounds
  // that half so appScale × osScale can never exceed MAX_TOTAL_FONT_SCALE — the
  // ceiling the fixed-geometry parts of the UI were verified against.
  const maxFontSizeMultiplier = MAX_TOTAL_FONT_SCALE / appScale;

  // Default install: one comparison per Text, no flatten, no new style object.
  if (!enabled || appScale === 1) {
    // Even at scale 1 the TYPEFACE still has to be swapped, so this path goes
    // through the same helper with a neutral multiplier.
    return (
      <RNText
        ref={ref}
        maxFontSizeMultiplier={maxFontSizeMultiplier}
        {...rest}
        style={scaleTextStyle(style, 1, design, korean)}
      />
    );
  }

  return (
    <RNText
      ref={ref}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      {...rest}
      style={scaleTextStyle(style, appScale, design, korean)}
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
  const design = DIRECTION_DESIGN[useAppStore((state) => state.direction)];
  // A field's text is its value and its placeholder — one face has to serve
  // both, so either carrying Hangul selects the Korean serif. (The read-only
  // TextInput that SelectableText renders on iOS also arrives here, which is how
  // a selectable Korean reading keeps the right face.)
  const korean = hasHangul(rest.value) || hasHangul(rest.placeholder);
  const enabled = rest.allowFontScaling !== false;
  const maxFontSizeMultiplier = MAX_TOTAL_FONT_SCALE / appScale;

  if (!enabled || appScale === 1) {
    return (
      <RNTextInput
        ref={ref}
        maxFontSizeMultiplier={maxFontSizeMultiplier}
        {...rest}
        style={scaleTextStyle(style, 1, design, korean)}
      />
    );
  }

  return (
    <RNTextInput
      ref={ref}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      {...rest}
      style={scaleTextStyle(style, appScale, design, korean)}
    />
  );
}

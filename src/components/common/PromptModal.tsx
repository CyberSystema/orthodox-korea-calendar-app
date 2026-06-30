import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors } from '../../theme/colors';
import { radii, spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

type PromptModalProps = {
  visible: boolean;
  title: string;
  message?: string;
  placeholder?: string;
  submitLabel: string;
  cancelLabel: string;
  secureTextEntry?: boolean;
  onSubmit: (value: string) => void;
  onCancel: () => void;
};

/**
 * Cross-platform replacement for the iOS-only `Alert.prompt`.
 * Renders a styled modal with a single text field so password / value
 * prompts work identically on iOS and Android.
 *
 * The secret-console passcode prompt had TWO independent hard-freeze causes on the
 * New Architecture, both fixed here:
 *   1. `autoFocus` on a TextInput inside a fade-animated Modal races the open
 *      transition -> deadlock. Fixed by focusing in `onShow` (after the animation).
 *   2. iOS Password AutoFill on a native `secureTextEntry` field freezes the app
 *      (recovers only after backgrounding) — the Fabric recycled-TextInput bug,
 *      facebook/react-native#53050. No prop disables autofill while secureTextEntry
 *      is set (#37236), so we DON'T use secureTextEntry: a plain TextInput never
 *      triggers autofill. We mask the value ourselves (bullets + Show/Hide toggle).
 */
export function PromptModal({
  visible,
  title,
  message,
  placeholder,
  submitLabel,
  cancelLabel,
  secureTextEntry,
  onSubmit,
  onCancel,
}: PromptModalProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState('');
  const [revealed, setRevealed] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // Reset the field each time the modal opens so stale input never leaks
  // between invocations.
  useEffect(() => {
    if (visible) {
      setValue('');
      setRevealed(false);
    }
  }, [visible]);

  const masked = !!secureTextEntry && !revealed;
  const displayValue = masked ? '•'.repeat(value.length) : value;

  const handleChangeText = (text: string) => {
    if (!masked) {
      setValue(text);
      return;
    }
    // Reconstruct the real value from append/backspace edits on the bullet string.
    if (text.length > value.length) {
      setValue(value + text.slice(value.length));
    } else if (text.length < value.length) {
      setValue(value.slice(0, text.length));
    }
  };

  const handleSubmit = () => {
    onSubmit(value);
  };

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="fade"
      onRequestClose={onCancel}
      // Focus only AFTER the open animation finishes — autoFocus inside a fade Modal
      // races the transition on the New Architecture and hard-freezes the app.
      onShow={() => {
        requestAnimationFrame(() => inputRef.current?.focus());
      }}
    >
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.card} onPress={() => {}}>
            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
            </View>
            {message ? <Text style={styles.message}>{message}</Text> : null}
            <View style={styles.inputRow}>
              <TextInput
                ref={inputRef}
                style={styles.input}
                value={displayValue}
                onChangeText={handleChangeText}
                placeholder={placeholder}
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
                // No native secureTextEntry (see the masking note above) — that is what
                // keeps iOS Password AutoFill and its New-Arch freeze from ever engaging.
                textContentType="none"
                autoComplete="off"
                importantForAutofill="no"
              />
              {secureTextEntry ? (
                <Pressable
                  onPress={() => setRevealed((prev) => !prev)}
                  style={({ pressed }) => [styles.revealButton, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel={revealed ? t('common.hide') : t('common.show')}
                >
                  <Text style={styles.revealText}>{revealed ? t('common.hide') : t('common.show')}</Text>
                </Pressable>
              ) : null}
            </View>
            <View style={styles.actions}>
              <Pressable
                style={({ pressed }) => [styles.buttonMuted, pressed && styles.pressed]}
                onPress={onCancel}
                accessibilityRole="button"
              >
                <Text style={styles.buttonMutedText}>{cancelLabel}</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.button, pressed && styles.pressed]}
                onPress={handleSubmit}
                accessibilityRole="button"
              >
                <Text style={styles.buttonText}>{submitLabel}</Text>
              </Pressable>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.backdropDark,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  header: {
    backgroundColor: colors.primaryDeep,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: colors.accent,
  },
  title: {
    fontFamily: typography.family.heading,
    fontSize: typography.size.lg,
    color: colors.brandText,
    textAlign: 'center',
  },
  message: {
    fontFamily: typography.family.body,
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    margin: spacing.md,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceWhite,
    color: colors.textBody,
    fontFamily: typography.family.body,
    fontSize: typography.size.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  revealButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  revealText: {
    fontFamily: typography.family.body,
    fontSize: typography.size.sm,
    color: colors.primary,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  button: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radii.full,
    backgroundColor: colors.accentGlow,
    paddingVertical: spacing.sm,
  },
  buttonText: {
    textAlign: 'center',
    fontFamily: typography.family.body,
    fontSize: typography.size.sm,
    color: colors.primaryDeep,
    fontWeight: typography.weight.semibold,
  },
  buttonMuted: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceWhite,
    paddingVertical: spacing.sm,
  },
  buttonMutedText: {
    textAlign: 'center',
    fontFamily: typography.family.body,
    fontSize: typography.size.sm,
    color: colors.primary,
  },
  pressed: {
    opacity: 0.7,
  },
});

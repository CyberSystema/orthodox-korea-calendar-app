import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

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
 * The iOS Password AutoFill freeze on this field was a native New-Architecture bug:
 * a `secureTextEntry` TextInput that Fabric RECYCLES after autofill comes back frozen
 * (facebook/react-native#53050). It is fixed natively in
 * `patches/react-native+0.85.3.patch` (TextInput opts out of view recycling), so this
 * component stays a plain native secureTextEntry field. We only defer focus to `onShow`
 * because `autoFocus` inside a fade Modal races the open transition on Fabric.
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
  const [value, setValue] = useState('');
  const inputRef = useRef<TextInput>(null);

  // Reset the field each time the modal opens so stale input never leaks
  // between invocations.
  useEffect(() => {
    if (visible) {
      setValue('');
    }
  }, [visible]);

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
            <TextInput
              ref={inputRef}
              style={styles.input}
              value={value}
              onChangeText={setValue}
              placeholder={placeholder}
              placeholderTextColor={colors.textSecondary}
              secureTextEntry={secureTextEntry}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
              // Hide the long-press edit menu on the passcode field. Its "AutoFill"
              // action is a SEPARATE iOS path from the keyboard's QuickType autofill
              // (the key icon, which works fine) and still hard-freezes the app even
              // with view-recycling disabled. This blocks only the broken context-menu
              // route — keyboard autofill and typing are unaffected.
              contextMenuHidden={!!secureTextEntry}
            />
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
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceWhite,
    color: colors.textBody,
    fontFamily: typography.family.body,
    fontSize: typography.size.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    margin: spacing.md,
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

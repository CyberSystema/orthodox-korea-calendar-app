import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

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
    <Modal visible={visible} transparent statusBarTranslucent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.card} onPress={() => {}}>
            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
            </View>
            {message ? <Text style={styles.message}>{message}</Text> : null}
            <TextInput
              style={styles.input}
              value={value}
              onChangeText={setValue}
              placeholder={placeholder}
              placeholderTextColor={colors.textSecondary}
              secureTextEntry={secureTextEntry}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
              // iOS Password AutoFill is broken for a secureTextEntry TextInput under the
              // New Architecture inside a Modal (facebook/react-native#53050 / #37236):
              // tapping the QuickType password suggestion neither fills the field nor
              // recovers, and hangs the app. We cannot make autofill work reliably here, so
              // we suppress the offer (textContentType="none" + autoComplete="off") AND
              // remove the structural deadlock — the modal no longer wraps the field in a
              // Keyboard.dismiss TouchableWithoutFeedback. The passcode is entered manually.
              textContentType="none"
              autoComplete="off"
              importantForAutofill="no"
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

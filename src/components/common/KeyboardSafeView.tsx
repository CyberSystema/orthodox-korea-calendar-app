import type { ReactElement } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, type KeyboardAvoidingViewProps, type StyleProp, type ViewStyle } from 'react-native';

type KeyboardSafeViewProps = {
  children: ReactElement;
  keyboardVerticalOffset?: number;
  behavior?: KeyboardAvoidingViewProps['behavior'];
  style?: StyleProp<ViewStyle>;
  enabled?: boolean;
};

export function KeyboardSafeView({
  children,
  keyboardVerticalOffset,
  behavior,
  style,
  enabled = true,
}: KeyboardSafeViewProps) {
  // On Android, combining behavior="height" with a non-zero vertical offset is a
  // known-buggy combination (jumpy / clipped layouts). Android already resizes the
  // window via adjustResize, so we let the OS handle the keyboard and apply
  // padding-based avoidance (with the offset) only on iOS.
  const resolvedBehavior = behavior ?? (Platform.OS === 'ios' ? 'padding' : undefined);

  return (
    <KeyboardAvoidingView
      style={style}
      behavior={resolvedBehavior}
      keyboardVerticalOffset={Platform.OS === 'ios' ? keyboardVerticalOffset : 0}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false} disabled={!enabled}>
        {children}
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

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
  return (
    <KeyboardAvoidingView
      style={style}
      behavior={behavior ?? (Platform.OS === 'ios' ? 'padding' : 'height')}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false} disabled={!enabled}>
        {children}
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

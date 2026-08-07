import { StyleSheet, View } from 'react-native';

import { useTheme, useThemedStyles, type ResolvedTheme } from '../../theme/useTheme';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { Text } from './ScaledText';

type Props = {
  text: string;
};

export function OrnamentTitle({ text }: Props) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.row}>
      <View style={styles.lineOuter} />
      <View style={styles.dot} />
      <Text style={styles.text}>{text}</Text>
      <View style={styles.dot} />
      <View style={styles.lineOuter} />
    </View>
  );
}

const makeStyles = (th: ResolvedTheme) =>
  ({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    lineOuter: {
      flex: 1,
      height: 1,
      backgroundColor: th.border,
    },
    dot: {
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: th.accent,
      opacity: 0.7,
    },
    text: {
      fontFamily: typography.family.heading,
      fontSize: typography.size.xs,
      color: th.accent,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      // Sits between two flex:1 rules — let it wrap rather than squeeze them out.
      flexShrink: 1,
      textAlign: 'center',
    },
  }) as const;

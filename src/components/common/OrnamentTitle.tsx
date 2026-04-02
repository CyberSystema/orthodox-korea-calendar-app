import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

type Props = {
  text: string;
};

export function OrnamentTitle({ text }: Props) {
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

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  lineOuter: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent,
    opacity: 0.7,
  },
  text: {
    fontFamily: typography.family.heading,
    fontSize: typography.size.xs,
    color: colors.accent,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
});

import { Image, StyleSheet, View } from 'react-native';

import { colors } from '../../theme/colors';
import { radii, spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import type { LiturgicalDay } from '../../features/calendar/types';
import { Text } from './ScaledText';

type Props = {
  day: LiturgicalDay;
  labels: {
    fast: string;
    cheese: string;
    fish: string;
    pres: string;
    basil: string;
    dl: string;
  };
};

type Flag = {
  key: string;
  label: string;
  image: number;
};

export function LiturgicalFlagsRow({ day, labels }: Props) {
  const flags: Flag[] = [];
  if (day.fast) {
    flags.push({
      key: 'fast',
      label: labels.fast,
      image: require('../../../assets/webapp-source/images/fast.jpeg'),
    });
  }
  if (day.cheese) {
    flags.push({
      key: 'cheese',
      label: labels.cheese,
      image: require('../../../assets/webapp-source/images/cheese.jpeg'),
    });
  }
  if (day.fish) {
    flags.push({
      key: 'fish',
      label: labels.fish,
      image: require('../../../assets/webapp-source/images/fish.jpeg'),
    });
  }
  if (day.presanctified) {
    flags.push({
      key: 'pres',
      label: labels.pres,
      image: require('../../../assets/webapp-source/images/pres.jpeg'),
    });
  }
  if (day.saintBasil) {
    flags.push({
      key: 'basil',
      label: labels.basil,
      image: require('../../../assets/webapp-source/images/bas_lit.jpeg'),
    });
  }
  if (day.divineLiturgy) {
    flags.push({
      key: 'dl',
      label: labels.dl,
      image: require('../../../assets/webapp-source/images/div_lit.jpeg'),
    });
  }

  if (flags.length === 0) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      {flags.map((flag) => (
        <View key={flag.key} style={styles.badge}>
          <Image source={flag.image} style={styles.badgeImage} resizeMode="cover" />
          <Text style={styles.badgeText}>{flag.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceWhite,
    borderRadius: radii.full,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    // Keep a long label inside the card instead of widening the wrap row.
    maxWidth: '100%',
  },
  badgeText: {
    color: colors.textBody,
    fontFamily: typography.family.body,
    fontSize: typography.size.xxs,
    flexShrink: 1,
  },
  badgeImage: {
    width: 22,
    height: 22,
    borderRadius: 11,
    flexShrink: 0,
  },
});

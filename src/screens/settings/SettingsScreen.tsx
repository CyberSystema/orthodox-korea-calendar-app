import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { KeyboardSafeView } from '../../components/common/KeyboardSafeView';
import { OrnamentTitle } from '../../components/common/OrnamentTitle';
import { Text } from '../../components/common/ScaledText';
import {
  type AdminLoginResult,
  loginStaffThroughCloudflare,
  logoutAdminThroughCloudflare,
  verifyAdminCloudflareSession,
} from '../../services/api/adminAuth';
import { canUseEventsApi } from '../../services/api/eventsRepository';
import { secureStorage } from '../../services/storage/secureStorage';
import { getAppVersionLabel } from '../../utils/appVersion';
import { useAppStore } from '../../store/useAppStore';
import { useNetworkStore } from '../../store/useNetworkStore';
import { colors } from '../../theme/colors';
import { FONT_SCALE_STEPS, type FontScale } from '../../theme/fontScale';
import { radii, spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

// We persist only that staff mode is enabled — never the raw passcode. The
// session token (stored by the SDK) is what authenticates requests.
const STAFF_MODE_KEY = 'auth.staffModeEnabled';

// One label per step. Typed as a total Record so adding a step to
// FONT_SCALE_STEPS fails typecheck here until it gets a label.
const FONT_SCALE_LABEL_KEYS: Record<FontScale, string> = {
  1: 'settings.fontSizeNormal',
  1.15: 'settings.fontSizeLarge',
  1.3: 'settings.fontSizeLarger',
  1.5: 'settings.fontSizeLargest',
};

export function SettingsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const {
    adminMode,
    cloudflareAdminAuthenticated,
    fontScale,
    setAdminMode,
    setCloudflareAdminAuthenticated,
    setFontScale,
  } = useAppStore();
  const isOnline = useNetworkStore((state) => state.isOnline);
  const [statusText, setStatusText] = useState('');
  const [passcodeDraft, setPasscodeDraft] = useState('');
  const [authBusy, setAuthBusy] = useState(false);

  // The passcode field is shown whenever the user is not actively authenticated:
  // either staff mode is off, or it's on but the session has expired.
  const needsAuthentication = !adminMode || !cloudflareAdminAuthenticated;

  // App version for the footer — read from the app config (app.json is the source of
  // truth under local versioning) so it tracks the release version even in sideloads,
  // where a stale generated native project can report an old version. See appVersion.ts.
  const versionLabel = getAppVersionLabel();

  const getLoginFailureMessage = (result: AdminLoginResult) => {
    if (result.ok) {
      return '';
    }

    if (result.code === 'RATE_LIMITED') {
      if (typeof result.retryAfter === 'number' && result.retryAfter > 0) {
        return t('settings.passcodeRateLimitedWithRetry', { seconds: result.retryAfter });
      }
      return t('settings.passcodeRateLimited');
    }

    if (result.code === 'UNAUTHORIZED') {
      return t('settings.passcodeFailed');
    }

    return result.message || t('settings.passcodeFailed');
  };

  // Authenticate with the entered passcode and enable staff mode. Only the
  // resulting session token is persisted (by the SDK) — never the passcode.
  const onSavePasscode = async () => {
    if (authBusy) return;

    setAuthBusy(true);
    try {
      if (!passcodeDraft.trim()) {
        setStatusText(t('settings.passcodeRequired'));
        return;
      }

      if (!canUseEventsApi()) {
        setStatusText(t('settings.apiUnavailable'));
        return;
      }

      const result = await loginStaffThroughCloudflare(passcodeDraft.trim());
      if (result.ok) {
        await secureStorage.setItem(STAFF_MODE_KEY, '1');
        setPasscodeDraft('');
        setCloudflareAdminAuthenticated(true);
        setAdminMode(true);
        setStatusText(t('settings.passcodeSaved'));
        return;
      }

      setCloudflareAdminAuthenticated(false);
      setStatusText(getLoginFailureMessage(result));
    } finally {
      setAuthBusy(false);
    }
  };

  const onToggleAdminMode = async (value: boolean) => {
    if (authBusy) return;

    setAuthBusy(true);
    try {
      if (!value) {
        // Disable staff mode: clear the flag and sign the session out.
        await secureStorage.deleteItem(STAFF_MODE_KEY);
        setPasscodeDraft('');
        setAdminMode(false);
        await logoutAdminThroughCloudflare();
        setCloudflareAdminAuthenticated(false);
        setStatusText(t('settings.passcodeCleared'));
        return;
      }

      if (!canUseEventsApi()) {
        setStatusText(t('settings.apiUnavailable'));
        return;
      }

      // Turning staff mode on: reuse a still-valid session if one exists,
      // otherwise authenticate with the entered passcode. We never read a stored
      // passcode because we no longer keep one.
      const existingSessionOk = await verifyAdminCloudflareSession();
      if (!existingSessionOk) {
        const passcode = passcodeDraft.trim();
        if (!passcode) {
          setStatusText(t('settings.passcodeRequired'));
          return;
        }
        const loginResult = await loginStaffThroughCloudflare(passcode);
        if (!loginResult.ok) {
          setCloudflareAdminAuthenticated(false);
          setStatusText(getLoginFailureMessage(loginResult));
          return;
        }
        setPasscodeDraft('');
      }

      await secureStorage.setItem(STAFF_MODE_KEY, '1');
      setCloudflareAdminAuthenticated(true);
      setAdminMode(true);
      setStatusText(t('settings.adminEnabled'));
    } finally {
      setAuthBusy(false);
    }
  };

  return (
    <KeyboardSafeView style={{ flex: 1 }} keyboardVerticalOffset={insets.top}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.lg },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      >
        <StatusBar style="light" />
        {/* ═══ TEXT SIZE ═══ */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <OrnamentTitle text={t('settings.fontSize')} />
          </View>
          <View style={styles.fontScaleRow}>
            {FONT_SCALE_STEPS.map((step) => {
              const selected = fontScale === step;
              return (
                <Pressable
                  key={step}
                  style={({ pressed }) => [
                    styles.fontScalePill,
                    selected && styles.fontScalePillActive,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => setFontScale(step)}
                  hitSlop={8}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={t(FONT_SCALE_LABEL_KEYS[step])}
                >
                  <Text
                    style={[styles.fontScalePillText, selected && styles.fontScalePillTextActive]}
                  >
                    {t(FONT_SCALE_LABEL_KEYS[step])}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {/* The preview is the whole screen: every label above re-renders at the
              chosen size the moment a pill is tapped. */}
          <Text style={styles.fontScalePreview}>{t('settings.fontSizePreview')}</Text>
          <Text style={styles.statusText}>{t('settings.fontSizeHint')}</Text>
        </View>

        {/* ═══ ADMIN MODE TOGGLE ═══ */}
        <View style={styles.rowCard}>
          <Text style={styles.rowTitle}>{t('settings.adminMode')}</Text>
          <Switch
            value={adminMode}
            disabled={authBusy || !isOnline}
            accessibilityLabel={t('settings.adminMode')}
            onValueChange={(value) => void onToggleAdminMode(value)}
            trackColor={{ false: colors.backgroundWarm, true: colors.accentDim }}
            thumbColor={adminMode ? colors.accent : colors.textFaint}
          />
        </View>

        {!isOnline ? (
          <Text style={styles.statusText}>{t('settings.offlineStaffDisabled')}</Text>
        ) : null}

        {/* ═══ WEB ADMIN SYNC ═══ */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <OrnamentTitle text={t('settings.webAdminSync')} />
          </View>
          <Text style={styles.statusText}>
            {canUseEventsApi() ? t('settings.apiConfigured') : t('settings.apiUnavailable')}
          </Text>
          {needsAuthentication ? (
            <>
              {adminMode && !cloudflareAdminAuthenticated ? (
                <Text style={styles.statusText}>{t('settings.sessionExpired')}</Text>
              ) : null}
              <TextInput
                secureTextEntry
                value={passcodeDraft}
                onChangeText={setPasscodeDraft}
                placeholder={t('settings.adminPasscodePlaceholder')}
                placeholderTextColor={colors.textSecondary}
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
                editable={isOnline}
              />
              <Pressable
                style={({ pressed }) => [
                  styles.buttonOutline,
                  (authBusy || !isOnline) && styles.buttonDisabled,
                  pressed && styles.pressed,
                ]}
                disabled={authBusy || !isOnline}
                onPress={onSavePasscode}
                accessibilityRole="button"
              >
                <Text style={styles.buttonOutlineText}>{t('settings.saveAdminPasscode')}</Text>
              </Pressable>
            </>
          ) : (
            <Text style={styles.statusText}>{t('settings.stuffPasscodeStored')}</Text>
          )}
        </View>

        {/* ═══ NOTIFICATIONS ═══ */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <OrnamentTitle text={t('settings.notifications')} />
          </View>
          <Text style={styles.statusText}>{t('settings.notificationsAutoPrompt')}</Text>
        </View>

        {/* ═══ APP VERSION ═══ */}
        {versionLabel ? (
          <Text style={styles.versionText}>{t('settings.version', { version: versionLabel })}</Text>
        ) : null}
      </ScrollView>
    </KeyboardSafeView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  pressed: {
    opacity: 0.7,
  },

  // ─── Toggle row ────────────────────────────────────────────────────────────
  rowCard: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowTitle: {
    fontFamily: typography.family.heading,
    fontSize: typography.size.md,
    color: colors.textPrimary,
    // Wrap next to the fixed-size Switch instead of pushing it off the card.
    flexShrink: 1,
  },

  // ─── Text size ─────────────────────────────────────────────────────────────
  fontScaleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  fontScalePill: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceWhite,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    flexShrink: 1,
  },
  fontScalePillActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentGlow,
  },
  fontScalePillText: {
    fontFamily: typography.family.body,
    fontSize: typography.size.sm,
    color: colors.primary,
  },
  fontScalePillTextActive: {
    color: colors.primaryDeep,
    fontWeight: typography.weight.semibold,
  },
  fontScalePreview: {
    fontFamily: typography.family.heading,
    fontSize: typography.size.md,
    color: colors.textBody,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
    backgroundColor: colors.surfaceWhite,
    borderRadius: radii.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },

  // ─── Settings card ─────────────────────────────────────────────────────────
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardHeader: {
    paddingBottom: spacing.xs,
  },

  // ─── Buttons ───────────────────────────────────────────────────────────────
  buttonOutline: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonOutlineText: {
    textAlign: 'center',
    color: colors.primary,
    fontFamily: typography.family.body,
    fontSize: typography.size.md,
  },

  // ─── Input ─────────────────────────────────────────────────────────────────
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    fontFamily: typography.family.body,
    fontSize: typography.size.md,
    color: colors.textBody,
    backgroundColor: colors.surfaceWhite,
  },

  // ─── Status ────────────────────────────────────────────────────────────────
  statusText: {
    fontFamily: typography.family.body,
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },

  // ─── Version footer ────────────────────────────────────────────────────────
  versionText: {
    fontFamily: typography.family.body,
    fontSize: typography.size.sm,
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});

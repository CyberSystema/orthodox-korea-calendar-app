import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { IlluminatedGround } from '../../components/common/IlluminatedGround';
import { KeyboardSafeView } from '../../components/common/KeyboardSafeView';
import { Text } from '../../components/common/ScaledText';
import {
  type AdminLoginResult,
  loginStaffThroughCloudflare,
  logoutAdminThroughCloudflare,
  verifyAdminCloudflareSession,
} from '../../services/api/adminAuth';
import { canUseEventsApi } from '../../services/api/eventsRepository';
import { secureStorage } from '../../services/storage/secureStorage';
import { useAppStore } from '../../store/useAppStore';
import { useNetworkStore } from '../../store/useNetworkStore';
import { useTheme, useThemedStyles, type ResolvedTheme } from '../../theme/useTheme';
import { radii, spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

// We persist only that staff mode is enabled — never the raw passcode. The
// session token (stored by the SDK) is what authenticates requests.
const STAFF_MODE_KEY = 'auth.staffModeEnabled';

/**
 * Event editing for parish staff, on its own screen.
 *
 * Split out of Settings so the store app shows parishioners nothing but their own
 * preferences: this is reached by one quiet "Parish staff" row, and everything
 * that used to sit in Settings and mean nothing to a reader — the passcode box,
 * the session state, the backend availability line — lives here instead.
 *
 * The auth flow is unchanged and deliberately so: the passcode is never stored,
 * only the verified session token (held by the SDK) and a flag saying staff mode
 * is on. Turning staff mode off signs the session out.
 */
export function StaffScreen() {
  const th = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { adminMode, cloudflareAdminAuthenticated, setAdminMode, setCloudflareAdminAuthenticated } =
    useAppStore();
  const isOnline = useNetworkStore((state) => state.isOnline);
  const [statusText, setStatusText] = useState('');
  const [passcodeDraft, setPasscodeDraft] = useState('');
  const [authBusy, setAuthBusy] = useState(false);

  // The passcode field is shown whenever the user is not actively authenticated:
  // either staff mode is off, or it's on but the session has expired.
  const needsAuthentication = !adminMode || !cloudflareAdminAuthenticated;

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
        setStatusText(t('settings.staffUnavailable'));
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
        setStatusText(t('settings.staffUnavailable'));
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
    <>
      {/* The leaf continues onto pushed screens. A Fragment sibling, not a
          child: this root is a scroll container, and a ground inside one would
          scroll away. absoluteFill then resolves against the navigator's own
          screen container, which fills the window. */}
      {th.direction === 'illuminated' ? <IlluminatedGround /> : null}
      <KeyboardSafeView style={styles.flex} keyboardVerticalOffset={insets.top}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.xl },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        >
          <StatusBar style="light" />

          <Text style={styles.intro}>{t('settings.staffIntro')}</Text>

          <View style={styles.rowCard}>
            <Text style={styles.rowTitle}>{t('settings.adminMode')}</Text>
            <Switch
              value={adminMode}
              disabled={authBusy || !isOnline}
              accessibilityLabel={t('settings.adminMode')}
              onValueChange={(value) => void onToggleAdminMode(value)}
              trackColor={{ false: th.backgroundWarm, true: th.accentDim }}
              thumbColor={adminMode ? th.accent : th.textFaint}
            />
          </View>

          {needsAuthentication ? (
            <View style={styles.card}>
              <TextInput
                secureTextEntry
                value={passcodeDraft}
                onChangeText={setPasscodeDraft}
                placeholder={t('settings.adminPasscodePlaceholder')}
                placeholderTextColor={th.textSecondary}
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
              {adminMode && !cloudflareAdminAuthenticated ? (
                <Text style={styles.statusText}>{t('settings.sessionExpired')}</Text>
              ) : null}
            </View>
          ) : (
            <Text style={styles.statusText}>{t('settings.stuffPasscodeStored')}</Text>
          )}

          {!isOnline ? (
            <Text style={styles.statusText}>{t('settings.offlineStaffDisabled')}</Text>
          ) : null}

          {statusText ? <Text style={styles.statusText}>{statusText}</Text> : null}
        </ScrollView>
      </KeyboardSafeView>
    </>
  );
}

const makeStyles = (th: ResolvedTheme) =>
  ({
    flex: { flex: 1 },
    container: {
      flex: 1,
      backgroundColor: th.direction === 'illuminated' ? 'transparent' : th.background,
      // Transparent under Illuminated: the ground is a sibling BEHIND this
      // scroll view, so an opaque background here would paint over the leaf.
    },
    content: {
      padding: spacing.lg,
      gap: spacing.lg,
    },
    pressed: { opacity: 0.7 },
    intro: {
      fontFamily: typography.family.body,
      fontSize: typography.size.sm,
      color: th.textSecondary,
      lineHeight: typography.size.sm * 1.5,
    },
    rowCard: {
      borderWidth: 1,
      borderColor: th.border,
      backgroundColor: th.surface,
      borderRadius: radii.lg,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    rowTitle: {
      flexShrink: 1,
      fontFamily: typography.family.heading,
      fontSize: typography.size.md,
      color: th.textBody,
    },
    card: {
      borderWidth: 1,
      borderColor: th.border,
      backgroundColor: th.surface,
      borderRadius: radii.lg,
      padding: spacing.lg,
      gap: spacing.md,
    },
    input: {
      borderWidth: 1,
      borderColor: th.border,
      borderRadius: radii.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontFamily: typography.family.body,
      fontSize: typography.size.md,
      color: th.textBody,
      backgroundColor: th.surfaceWhite,
    },
    buttonOutline: {
      borderWidth: 1,
      borderColor: th.accent,
      borderRadius: radii.md,
      paddingVertical: spacing.sm,
      alignItems: 'center',
    },
    buttonDisabled: { opacity: 0.5 },
    buttonOutlineText: {
      fontFamily: typography.family.heading,
      fontSize: typography.size.sm,
      color: th.accentText,
    },
    statusText: {
      fontFamily: typography.family.body,
      fontSize: typography.size.sm,
      color: th.textSecondary,
      lineHeight: typography.size.sm * 1.5,
    },
  }) as const;

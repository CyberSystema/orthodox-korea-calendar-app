import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { KeyboardSafeView } from '../../components/common/KeyboardSafeView';
import { OrnamentTitle } from '../../components/common/OrnamentTitle';
import {
  type AdminLoginResult,
  loginStaffThroughCloudflare,
  logoutAdminThroughCloudflare,
  verifyAdminCloudflareSession,
} from '../../services/api/adminAuth';
import { canUseEventsApi } from '../../services/api/eventsRepository';
import { secureStorage } from '../../services/storage/secureStorage';
import { useAppStore } from '../../store/useAppStore';
import { colors } from '../../theme/colors';
import { radii, spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

const STORED_STUFF_PASSCODE_KEY = 'auth.staffPasscode';

export function SettingsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const {
    adminMode,
    setAdminMode,
    setCloudflareAdminAuthenticated,
  } = useAppStore();
  const [statusText, setStatusText] = useState('');
  const [passcodeDraft, setPasscodeDraft] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [hasStoredStuffPasscode, setHasStoredStuffPasscode] = useState(adminMode);

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
        await secureStorage.setItem(STORED_STUFF_PASSCODE_KEY, passcodeDraft.trim());
        setHasStoredStuffPasscode(true);
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
        await secureStorage.deleteItem(STORED_STUFF_PASSCODE_KEY);
        setHasStoredStuffPasscode(false);
        setPasscodeDraft('');
        setAdminMode(false);
        await logoutAdminThroughCloudflare();
        setCloudflareAdminAuthenticated(false);
        setStatusText(t('settings.passcodeCleared'));
        return;
      }

      const storedPasscode = (await secureStorage.getItem(STORED_STUFF_PASSCODE_KEY)) || '';
      const passcode = (storedPasscode || passcodeDraft).trim();
      if (!passcode) {
        setStatusText(t('settings.passcodeRequired'));
        return;
      }

      if (!canUseEventsApi()) {
        setStatusText(t('settings.apiUnavailable'));
        return;
      }

      const existingSessionOk = await verifyAdminCloudflareSession();
      let ok = existingSessionOk;

      if (!ok) {
        const loginResult = await loginStaffThroughCloudflare(passcode);
        if (!loginResult.ok) {
          setCloudflareAdminAuthenticated(false);
          setStatusText(getLoginFailureMessage(loginResult));
          return;
        }
        ok = true;
      }

      if (!ok) {
        setCloudflareAdminAuthenticated(false);
        setStatusText(t('settings.passcodeFailed'));
        return;
      }

      setCloudflareAdminAuthenticated(true);
      if (!storedPasscode) {
        await secureStorage.setItem(STORED_STUFF_PASSCODE_KEY, passcode);
      }
      setHasStoredStuffPasscode(true);
      setAdminMode(true);
      setStatusText(t('settings.adminEnabled'));
    } finally {
      setAuthBusy(false);
    }
  };

  return (
    <KeyboardSafeView
      style={{ flex: 1 }}
      keyboardVerticalOffset={insets.top}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.lg }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      >
        <StatusBar style="light" />
        {/* ═══ ADMIN MODE TOGGLE ═══ */}
        <View style={styles.rowCard}>
          <Text style={styles.rowTitle}>{t('settings.adminMode')}</Text>
          <Switch
            value={adminMode}
            disabled={authBusy}
            onValueChange={(value) => void onToggleAdminMode(value)}
            trackColor={{ false: colors.backgroundWarm, true: colors.accentDim }}
            thumbColor={adminMode ? colors.accent : colors.textFaint}
          />
        </View>

        {/* ═══ WEB ADMIN SYNC ═══ */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <OrnamentTitle text={t('settings.webAdminSync')} />
          </View>
          <Text style={styles.statusText}>
            {canUseEventsApi()
              ? t('settings.apiConfigured')
              : t('settings.apiUnavailable')}
          </Text>
          {!adminMode || !hasStoredStuffPasscode ? (
            <>
              <TextInput
                secureTextEntry
                value={passcodeDraft}
                onChangeText={setPasscodeDraft}
                placeholder={t('settings.adminPasscodePlaceholder')}
                placeholderTextColor={colors.textSecondary}
                style={styles.input}
              />
              <Pressable style={({ pressed }) => [styles.buttonOutline, authBusy && styles.buttonDisabled, pressed && styles.pressed]} disabled={authBusy} onPress={onSavePasscode}>
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
});

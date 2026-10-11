import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../constants';
import { useLevelStore } from '../store/levelStore';
import { useSessionStore } from '../store/sessionStore';
import { useSettingsStore } from '../store/settingsStore';
import { useTimerStore } from '../store/timerStore';
import {
  createBackup,
  pickBackupFile,
  restoreBackupFromText,
  saveBackupFile,
} from '../utils/backup';

interface SettingRowProps {
  label: string;
  description: string;
  value: boolean;
  onToggle: (value: boolean) => void;
  darkMode: boolean;
}

function SettingRow({ label, description, value, onToggle, darkMode }: SettingRowProps) {
  return (
    <View style={[styles.row, darkMode && styles.rowDark]}>
      <View style={styles.rowTextContainer}>
        <Text style={[styles.rowLabel, darkMode && styles.textDark]}>{label}</Text>
        <Text style={[styles.rowDescription, darkMode && styles.subtextDark]}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: '#D0D0D0', true: COLORS.primaryLight }}
        thumbColor={value ? COLORS.primary : '#F4F4F4'}
      />
    </View>
  );
}

export default function SettingsScreen() {
  const {
    strictMode,
    notificationsEnabled,
    darkMode,
    loaded,
    loadSettings,
    setStrictMode,
    setNotificationsEnabled,
    setDarkMode,
  } = useSettingsStore();

  useEffect(() => {
    if (!loaded) {
      loadSettings();
    }
  }, [loaded, loadSettings]);

  const handleStrictMode = useCallback(
    (value: boolean) => setStrictMode(value),
    [setStrictMode],
  );

  const handleNotifications = useCallback(
    (value: boolean) => setNotificationsEnabled(value),
    [setNotificationsEnabled],
  );

  const handleDarkMode = useCallback(
    (value: boolean) => setDarkMode(value),
    [setDarkMode],
  );

  // ─── Backup / Restore (web only) ───
  const [backupBusy, setBackupBusy] = useState<'export' | 'import' | null>(null);
  const [backupStatus, setBackupStatus] = useState<{
    type: 'ok' | 'error';
    message: string;
  } | null>(null);

  const handleExport = useCallback(async () => {
    if (Platform.OS !== 'web') return;
    setBackupBusy('export');
    setBackupStatus(null);
    try {
      const payload = await createBackup();
      const result = await saveBackupFile(payload);
      if (result === 'cancelled') return;
      setBackupStatus({
        type: 'ok',
        message:
          result === 'saved'
            ? 'Backup saved successfully.'
            : 'Backup downloaded to your downloads folder.',
      });
    } catch (error) {
      setBackupStatus({
        type: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to export backup.',
      });
    } finally {
      setBackupBusy(null);
    }
  }, []);

  const handleImport = useCallback(async () => {
    if (Platform.OS !== 'web') return;
    setBackupBusy('import');
    setBackupStatus(null);
    try {
      const file = await pickBackupFile();
      if (!file) return;

      const count = await restoreBackupFromText(await file.text());

      // Refresh every store from the restored storage.
      await Promise.all([
        useSettingsStore.getState().loadSettings(),
        useSessionStore.getState().loadSessions(),
        useLevelStore.getState().loadLevelData(),
      ]);
      await useTimerStore.getState().restoreSession();

      setBackupStatus({
        type: 'ok',
        message: `Restored ${count} data sets from backup.`,
      });
    } catch (error) {
      setBackupStatus({
        type: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to import backup.',
      });
    } finally {
      setBackupBusy(null);
    }
  }, []);

  const isWeb = Platform.OS === 'web';

  return (
    <SafeAreaView style={[styles.container, darkMode && styles.containerDark]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.title, darkMode && styles.titleDark]}>Settings</Text>

        <Text style={[styles.sectionTitle, darkMode && styles.subtextDark]}>FOCUS</Text>
        <SettingRow
          label="Strict Mode"
          description="No grace period when leaving app. Timer fails immediately."
          value={strictMode}
          onToggle={handleStrictMode}
          darkMode={darkMode}
        />

        <Text style={[styles.sectionTitle, darkMode && styles.subtextDark]}>NOTIFICATIONS</Text>
        <SettingRow
          label="Notifications"
          description="Get notified when your focus session completes."
          value={notificationsEnabled}
          onToggle={handleNotifications}
          darkMode={darkMode}
        />

        <Text style={[styles.sectionTitle, darkMode && styles.subtextDark]}>APPEARANCE</Text>
        <SettingRow
          label="Dark Mode"
          description="Use dark theme throughout the app."
          value={darkMode}
          onToggle={handleDarkMode}
          darkMode={darkMode}
        />

        {isWeb && (
          <>
            <Text style={[styles.sectionTitle, darkMode && styles.subtextDark]}>DATA</Text>
            <View style={[styles.row, darkMode && styles.rowDark]}>
              <View style={styles.rowTextContainer}>
                <Text style={[styles.rowLabel, darkMode && styles.textDark]}>
                  Backup & Restore
                </Text>
                <Text style={[styles.rowDescription, darkMode && styles.subtextDark]}>
                  Export all sessions, settings and progress to a JSON file you
                  choose, or restore from a previous backup.
                </Text>
              </View>
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.backupBtn, backupBusy !== null && styles.btnDisabled]}
                onPress={handleExport}
                disabled={backupBusy !== null}
                activeOpacity={0.8}
              >
                {backupBusy === 'export' ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.backupBtnText}>Export backup</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.backupBtn,
                  styles.backupBtnSecondary,
                  darkMode && styles.backupBtnSecondaryDark,
                  backupBusy !== null && styles.btnDisabled,
                ]}
                onPress={handleImport}
                disabled={backupBusy !== null}
                activeOpacity={0.8}
              >
                {backupBusy === 'import' ? (
                  <ActivityIndicator color={COLORS.primary} size="small" />
                ) : (
                  <Text
                    style={[
                      styles.backupBtnText,
                      styles.backupBtnSecondaryText,
                      darkMode && styles.backupBtnSecondaryTextDark,
                    ]}
                  >
                    Import backup
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {backupStatus && (
              <Text
                style={[
                  styles.backupStatus,
                  backupStatus.type === 'error' && styles.backupStatusError,
                ]}
              >
                {backupStatus.message}
              </Text>
            )}
          </>
        )}

        <View style={styles.footer}>
          <Text style={[styles.footerText, darkMode && styles.subtextDark]}>
            Forest Focus – Focus Timer v1.0.0
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  containerDark: {
    backgroundColor: COLORS.backgroundDark,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.primaryDark,
    paddingVertical: 16,
  },
  titleDark: {
    color: COLORS.primaryLight,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: 24,
    marginBottom: 8,
    letterSpacing: 1,
  },
  subtextDark: {
    color: COLORS.textSecondaryDark,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  rowDark: {
    backgroundColor: COLORS.surfaceDark,
  },
  rowTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  textDark: {
    color: COLORS.textDark,
  },
  rowDescription: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  backupBtn: {
    flex: 1,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backupBtnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  backupBtnSecondaryDark: {
    borderColor: COLORS.primaryLight,
  },
  backupBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  backupBtnSecondaryText: {
    color: COLORS.primary,
  },
  backupBtnSecondaryTextDark: {
    color: COLORS.primaryLight,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  backupStatus: {
    marginTop: 12,
    fontSize: 13,
    color: COLORS.success,
    lineHeight: 18,
  },
  backupStatusError: {
    color: COLORS.error,
  },
  footer: {
    alignItems: 'center',
    marginTop: 40,
  },
  footerText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
});

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { useLevelStore } from '../src/store/levelStore';
import { useSessionStore } from '../src/store/sessionStore';
import { useSettingsStore } from '../src/store/settingsStore';
import { useTimerStore } from '../src/store/timerStore';

export default function RootLayout() {
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const loadSessions = useSessionStore((s) => s.loadSessions);
  const loadLevelData = useLevelStore((s) => s.loadLevelData);
  const restoreSession = useTimerStore((s) => s.restoreSession);
  const darkMode = useSettingsStore((s) => s.darkMode);

  useEffect(() => {
    // Load all stores first, then restore any active timer session
    Promise.all([
      loadSettings(),
      loadSessions(),
      loadLevelData(),
    ]).then(() => {
      restoreSession();
    });
  }, [loadSettings, loadSessions, loadLevelData, restoreSession]);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(drawer)" />
      </Stack>
      <StatusBar style={darkMode ? 'light' : 'dark'} />
    </>
  );
}
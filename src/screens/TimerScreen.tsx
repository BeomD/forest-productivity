import React, { useCallback } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { DurationSelector } from "../components/DurationSelector";
import { TimerControls } from "../components/TimerControls";
import { TreeGrowthAnimation } from "../components/TreeGrowthAnimation";
import { ProgressRing } from "../components/timer/ProgressRing";
import { COLORS, STATE_RESET_DELAY_MS } from "../constants";
import { useFocusTimer } from "../hooks/useFocusTimer";
import { useSettingsStore } from "../store/settingsStore";
import { useTimerStore } from "../store/timerStore";
import { formatTime } from "../utils/helpers";

export default function TimerScreen() {
  const {
    durationMinutes,
    remainingSeconds,
    status,
    progress,
    handleFail,
    resetTimer,
  } = useFocusTimer();

  const {
    setDuration,
    startTimer,
    pauseTimer,
    resumeTimer,
  } = useTimerStore();

  const darkMode = useSettingsStore((s) => s.darkMode);

  const handleSelectDuration = useCallback(
    (minutes: number) => {
      setDuration(minutes);
    },
    [setDuration],
  );

  const handleStart = useCallback(() => {
    if (status === "completed" || status === "failed") {
      resetTimer();
      setTimeout(() => {
        useTimerStore.getState().startTimer();
      }, STATE_RESET_DELAY_MS);
    } else {
      startTimer();
    }
  }, [status, resetTimer, startTimer]);

  const handleCancel = useCallback(() => {
    Alert.alert(
      "포기할까요?",
      "지금 포기하면 나무가 죽습니다. 정말 포기할까요?",
      [
        { text: "계속하기", style: "cancel" },
        {
          text: "포기",
          style: "destructive",
          onPress: () => handleFail(),
        },
      ],
    );
  }, [handleFail]);

  const isActive = status === "running" || status === "paused";

  const statusMessage = (() => {
    switch (status) {
      case "idle":
        return "집중할 준비 되셨나요?";
      case "running":
        return "집중 중... 🌱";
      case "paused":
        return "일시정지";
      case "completed":
        return "잘했어요! 🌳";
      case "failed":
        return "나무가 죽었어요 🥀";
      default:
        return "";
    }
  })();

  // ─── Determine ring color based on status ───
  const ringColor =
    status === "failed"
      ? COLORS.error
      : status === "completed"
        ? COLORS.success
        : COLORS.primaryLight;

  return (
    <SafeAreaView
      style={[styles.container, darkMode && styles.containerDark]}
      edges={["top"]}
    >
      <View style={styles.content}>
        <Text style={[styles.title, darkMode && styles.titleDark]}>
          집중
        </Text>

        <DurationSelector
          selectedDuration={durationMinutes}
          onSelect={handleSelectDuration}
          disabled={isActive}
          darkMode={darkMode}
        />

        {/* ── Tree + Progress Ring ── */}
        <View style={styles.treeContainer}>
          <ProgressRing
            progress={progress}
            size={260}
            strokeWidth={6}
            progressColor={ringColor}
            trackColor={
              darkMode ? "rgba(76,175,80,0.1)" : "rgba(76,175,80,0.15)"
            }
          />
          <TreeGrowthAnimation
            progress={progress}
            failed={status === "failed"}
          />
        </View>

        <Text style={[styles.timer, darkMode && styles.timerDark]}>
          {formatTime(remainingSeconds)}
        </Text>

        <Text style={[styles.statusText, darkMode && styles.statusTextDark]}>
          {statusMessage}
        </Text>

        {/* ── Timer action buttons ── */}
        <TimerControls
          status={status}
          onStart={handleStart}
          onPause={pauseTimer}
          onResume={resumeTimer}
          onCancel={handleCancel}
          darkMode={darkMode}
        />
      </View>
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
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: COLORS.primaryDark,
    marginBottom: 24,
  },
  titleDark: {
    color: COLORS.primaryLight,
  },
  treeContainer: {
    marginVertical: 8,
    width: 260,
    height: 280,
    alignItems: "center",
    justifyContent: "center",
  },
  timer: {
    fontSize: 56,
    fontWeight: "200",
    color: COLORS.text,
    fontVariant: ["tabular-nums"],
    marginBottom: 8,
  },
  timerDark: {
    color: COLORS.textDark,
  },
  statusText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  statusTextDark: {
    color: COLORS.textSecondaryDark,
  },
});

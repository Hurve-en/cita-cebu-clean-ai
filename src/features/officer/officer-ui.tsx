import type { PropsWithChildren } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Brand } from "@/components/brand";
import { Icon, palette, ui } from "@/features/resident/resident-ui";
import { useOfficer } from "./officer-state";
export function OfficerPage({
  title,
  description,
  back = false,
  children,
}: PropsWithChildren<{ title: string; description?: string; back?: boolean }>) {
  const { session } = useOfficer();
  return (
    <SafeAreaView
      style={ui.screen}
      edges={
        back ? ["top", "left", "right", "bottom"] : ["top", "left", "right"]
      }
    >
      <KeyboardAvoidingView
        style={ui.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={o.page}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={o.top}>
            {back && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back to officer workspace"
                style={ui.iconButton}
                onPress={() =>
                  router.canGoBack()
                    ? router.back()
                    : router.replace("/officer")
                }
              >
                <Icon name="back" />
              </Pressable>
            )}
            <Brand subtitle="Officer workspace" />
          </View>
          <View style={o.scope}>
            <Text style={o.scopeText}>
              {session?.barangayName ?? "Demo Barangay"} · Assigned community
            </Text>
          </View>
          <View style={{ gap: 8 }}>
            <Text accessibilityRole="header" style={ui.title}>
              {title}
            </Text>
            {!!description && <Text style={ui.copy}>{description}</Text>}
          </View>
          <Text style={o.demo}>
            OFFICER DEMO · Fictional data · Changes reset on logout or reload
          </Text>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export function Chips<T extends string>({
  options,
  selected,
  onChange,
  label,
}: {
  options: readonly T[];
  selected: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <View style={o.chips} accessibilityLabel={label}>
      {options.map((option) => (
        <Pressable
          key={option}
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${option}`}
          accessibilityState={{ selected: selected === option }}
          onPress={() => onChange(option)}
          style={({ pressed }) => [
            o.chip,
            selected === option && o.selectedChip,
            pressed && ui.pressed,
          ]}
        >
          <Text style={[o.chipText, selected === option && o.selectedText]}>
            {option}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
export function Status({ value }: { value: string }) {
  const done = value === "Resolved" || value === "Published";
  const pending = value === "Pending review" || value === "Draft";
  return (
    <View
      style={[
        o.status,
        { backgroundColor: done ? "#EAF2EC" : pending ? "#F5EEDC" : "#EDF0F6" },
      ]}
    >
      <Text
        style={{
          color: done ? palette.green : pending ? "#76531D" : "#455D80",
          fontSize: 12,
          fontWeight: "700",
        }}
      >
        {value}
      </Text>
    </View>
  );
}
export function Metric({
  label,
  count,
  onPress,
}: {
  label: string;
  count: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${count} ${label}`}
      onPress={onPress}
      style={({ pressed }) => [o.metric, pressed && ui.pressed]}
    >
      <Text style={o.metricCount}>{count}</Text>
      <Text style={o.metricLabel}>{label}</Text>
    </Pressable>
  );
}
export const errorText = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
export const formatDate = (date: string) => new Date(date).toLocaleString();
export const o = StyleSheet.create({
  page: {
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
    padding: 22,
    paddingBottom: 40,
    gap: 18,
  },
  top: { flexDirection: "row", alignItems: "center", gap: 14, paddingTop: 4 },
  scope: {
    backgroundColor: palette.pale,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  scopeText: {
    color: palette.green,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },
  demo: { color: palette.muted, fontSize: 11, lineHeight: 18 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "white",
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: "center",
  },
  selectedChip: { backgroundColor: palette.green, borderColor: palette.green },
  chipText: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },
  selectedText: { color: "white" },
  status: {
    alignSelf: "flex-start",
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  metric: {
    flexBasis: "45%",
    flexGrow: 1,
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "white",
    gap: 6,
    minHeight: 112,
  },
  metricCount: {
    color: palette.green,
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: -1,
  },
  metricLabel: { color: palette.muted, fontSize: 13, lineHeight: 20 },
  timeline: {
    gap: 8,
    borderLeftWidth: 2,
    borderLeftColor: palette.border,
    paddingLeft: 16,
    paddingBottom: 14,
  },
  hint: { color: palette.muted, fontSize: 12, lineHeight: 20 },
});

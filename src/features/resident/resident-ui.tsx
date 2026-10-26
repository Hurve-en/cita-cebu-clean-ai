import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useState, type PropsWithChildren, type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Brand } from "@/components/brand";

export const palette = {
  green: "#185D43",
  pale: "#EAF2EC",
  cream: "#F6F7F3",
  white: "#FFFFFF",
  text: "#192F26",
  muted: "#5D6E65",
  border: "#DCE5DE",
  error: "#A12D39",
  lime: "#DEEDB8",
  amber: "#80551E",
};

const symbols = {
  scan: {
    ios: "camera",
    android: "photo_camera",
    web: "photo_camera",
  },
  calendar: {
    ios: "calendar",
    android: "calendar_month",
    web: "calendar_month",
  },
  gift: {
    ios: "gift",
    android: "redeem",
    web: "redeem",
  },
  person: {
    ios: "person",
    android: "person",
    web: "person",
  },
  home: {
    ios: "house",
    android: "home",
    web: "home",
  },
  report: {
    ios: "exclamationmark.bubble",
    android: "report",
    web: "report",
  },
  bell: {
    ios: "bell",
    android: "notifications",
    web: "notifications",
  },
  leaf: {
    ios: "leaf",
    android: "eco",
    web: "eco",
  },
  arrow: {
    ios: "chevron.right",
    android: "chevron_right",
    web: "chevron_right",
  },
  back: {
    ios: "chevron.left",
    android: "chevron_left",
    web: "chevron_left",
  },
  settings: {
    ios: "gearshape",
    android: "settings",
    web: "settings",
  },
  history: {
    ios: "clock",
    android: "history",
    web: "history",
  },
  help: {
    ios: "questionmark.circle",
    android: "help_outline",
    web: "help_outline",
  },
  pin: {
    ios: "mappin.and.ellipse",
    android: "location_on",
    web: "location_on",
  },
} as const;

export type IconName = keyof typeof symbols;

export function Icon({
  name,
  color = palette.green,
  size = 22,
}: {
  name: IconName;
  color?: string;
  size?: number;
}) {
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants">
      <SymbolView name={symbols[name]} tintColor={color} size={size} />
    </View>
  );
}

export function openDetail(view: string, id?: string) {
  router.push({
    pathname: "/detail",
    params: {
      view,
      ...(id ? { id } : {}),
    },
  });
}

export function Page({
  title,
  subtitle,
  back = false,
  children,
  accessory,
}: PropsWithChildren<{
  title: string;
  subtitle?: string;
  back?: boolean;
  accessory?: ReactNode;
}>) {
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
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={ui.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={ui.header}>
            <View style={ui.row}>
              {back ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Go back"
                  style={ui.iconButton}
                  onPress={() =>
                    router.canGoBack() ? router.back() : router.replace("/")
                  }
                >
                  <Icon name="back" />
                </Pressable>
              ) : (
                <Brand />
              )}

              {accessory}
            </View>

            <Text accessibilityRole="header" style={ui.title}>
              {title}
            </Text>

            {!!subtitle && <Text style={ui.headerText}>{subtitle}</Text>}
          </View>

          <View style={ui.body}>
            <View style={ui.demoPill}>
              <View style={ui.dot} />
              <Text style={ui.demo}>Demo preview</Text>
            </View>

            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Card({
  children,
  onPress,
}: PropsWithChildren<{
  onPress?: () => void;
}>) {
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [ui.card, pressed && ui.pressed]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={ui.card}>{children}</View>;
}

export function Heading({ children }: PropsWithChildren) {
  return (
    <Text accessibilityRole="header" style={ui.heading}>
      {children}
    </Text>
  );
}

export function Copy({ children }: PropsWithChildren) {
  return <Text style={ui.copy}>{children}</Text>;
}

export function Section({
  title,
  action,
  onPress,
}: {
  title: string;
  action?: string;
  onPress?: () => void;
}) {
  return (
    <View style={ui.row}>
      <View style={ui.flex}>
        <Heading>{title}</Heading>
      </View>

      {action && onPress && (
        <Pressable
          accessibilityRole="button"
          onPress={onPress}
          style={ui.textButton}
        >
          <Text style={ui.link}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

export function Button({
  label,
  onPress,
  secondary = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        ui.button,
        secondary && ui.secondary,
        disabled && ui.disabled,
        pressed && !disabled && ui.pressed,
      ]}
    >
      <Text
        style={[
          ui.buttonText,
          secondary && { color: palette.green },
          disabled && { color: "#657269" },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Field({
  label,
  secureTextEntry,
  style,
  ...props
}: TextInputProps & {
  label: string;
}) {
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);

  return (
    <View style={ui.field}>
      <Text style={ui.label}>{label}</Text>

      <View style={[ui.inputFrame, focused && ui.inputFocused]}>
        <TextInput
          {...props}
          accessibilityLabel={label}
          secureTextEntry={secureTextEntry && !visible}
          placeholderTextColor={palette.muted}
          onFocus={(event) => {
            setFocused(true);
            props.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            props.onBlur?.(event);
          }}
          style={[ui.input, props.multiline && ui.multiline, style]}
        />

        {secureTextEntry && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={visible ? "Hide password" : "Show password"}
            onPress={() => setVisible((value) => !value)}
            style={ui.passwordToggle}
          >
            <Text style={ui.link}>{visible ? "Hide" : "Show"}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

export function Message({
  text,
  error = false,
}: {
  text: string;
  error?: boolean;
}) {
  if (!text) return null;

  return (
    <View style={[ui.messageBox, error && { backgroundColor: "#FBECEE" }]}>
      <Text
        accessibilityRole={error ? "alert" : undefined}
        accessibilityLiveRegion="polite"
        style={[ui.message, error && { color: palette.error }]}
      >
        {text}
      </Text>
    </View>
  );
}

export function MenuItem({
  title,
  detail,
  icon,
  onPress,
}: {
  title: string;
  detail?: string;
  icon: IconName;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [ui.menuItem, pressed && ui.pressed]}
    >
      <View style={ui.iconTile}>
        <Icon name={icon} />
      </View>

      <View style={ui.flex}>
        <Text style={ui.menuTitle}>{title}</Text>

        {detail && <Text style={ui.small}>{detail}</Text>}
      </View>

      <Icon name="arrow" size={18} color={palette.muted} />
    </Pressable>
  );
}

export function EmptyState({
  title,
  description,
  icon = "leaf",
}: {
  title: string;
  description: string;
  icon?: IconName;
}) {
  return (
    <View style={ui.empty}>
      <View style={ui.emptyIcon}>
        <Icon name={icon} size={30} />
      </View>

      <Heading>{title}</Heading>

      <Text style={[ui.copy, { textAlign: "center" }]}>{description}</Text>
    </View>
  );
}

export const ui = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.cream,
  },
  content: {
    flexGrow: 1,
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 4,
    gap: 12,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  brandMark: {
    backgroundColor: palette.green,
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  brand: {
    color: palette.green,
    fontWeight: "800",
    fontSize: 16,
    letterSpacing: -0.3,
  },
  title: {
    color: palette.text,
    fontSize: 30,
    lineHeight: 38,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  headerText: {
    color: palette.muted,
    fontSize: 15,
    lineHeight: 23,
  },
  white: {
    color: palette.white,
    fontWeight: "600",
    fontSize: 16,
  },
  back: {
    minHeight: 48,
    justifyContent: "center",
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: palette.white,
    borderColor: palette.border,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  body: {
    padding: 24,
    gap: 18,
    paddingBottom: 36,
  },
  demoPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.amber,
  },
  demo: {
    fontSize: 12,
    color: palette.muted,
    fontWeight: "500",
  },
  card: {
    padding: 20,
    borderRadius: 22,
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.border,
    gap: 12,
  },
  heading: {
    color: palette.text,
    fontSize: 19,
    lineHeight: 27,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  copy: {
    color: palette.muted,
    fontSize: 15,
    lineHeight: 23,
  },
  button: {
    backgroundColor: palette.green,
    minHeight: 54,
    paddingHorizontal: 18,
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  secondary: {
    backgroundColor: palette.pale,
  },
  buttonText: {
    color: palette.white,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  disabled: {
    backgroundColor: "#E2E7E1",
  },
  pressed: {
    opacity: 0.72,
  },
  field: {
    gap: 9,
  },
  label: {
    color: palette.text,
    fontWeight: "600",
    fontSize: 14,
  },
  inputFrame: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#C6D3C9",
    borderRadius: 15,
    backgroundColor: palette.white,
  },
  inputFocused: {
    borderColor: palette.green,
    borderWidth: 2,
  },
  input: {
    flex: 1,
    minWidth: 0,
    color: palette.text,
    fontSize: 16,
    padding: 15,
    minHeight: 54,
  },
  passwordToggle: {
    minWidth: 58,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  multiline: {
    minHeight: 128,
    textAlignVertical: "top",
  },
  messageBox: {
    backgroundColor: palette.pale,
    borderRadius: 14,
    padding: 14,
  },
  message: {
    color: palette.green,
    fontSize: 14,
    lineHeight: 22,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  category: {
    width: "47%",
    flexGrow: 1,
    minHeight: 108,
    borderRadius: 18,
    backgroundColor: palette.white,
    padding: 16,
    gap: 12,
    borderColor: palette.border,
    borderWidth: 1,
    justifyContent: "center",
  },
  categoryText: {
    color: palette.text,
    fontSize: 15,
    fontWeight: "700",
  },
  points: {
    color: palette.green,
    fontSize: 42,
    lineHeight: 52,
    fontWeight: "800",
    letterSpacing: -1.5,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  textButton: {
    minHeight: 48,
    justifyContent: "center",
    paddingLeft: 10,
  },
  link: {
    color: palette.green,
    fontWeight: "700",
    fontSize: 14,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: palette.white,
    borderColor: palette.border,
    borderWidth: 1,
    minHeight: 76,
  },
  menuTitle: {
    color: palette.text,
    fontSize: 15,
    fontWeight: "600",
  },
  small: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 19,
    marginTop: 3,
  },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.pale,
  },
  empty: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 20,
    gap: 12,
  },
  emptyIcon: {
    width: 76,
    height: 76,
    borderRadius: 28,
    backgroundColor: palette.pale,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  hero: {
    padding: 24,
    backgroundColor: palette.green,
    borderRadius: 26,
    gap: 14,
  },
  eyebrow: {
    color: "#D8EDB4",
    fontSize: 11,
    lineHeight: 18,
    fontWeight: "800",
    letterSpacing: 1.3,
  },
  heroTitle: {
    color: "white",
    fontSize: 28,
    lineHeight: 35,
    fontWeight: "800",
    letterSpacing: -0.7,
  },
  heroCopy: {
    color: "#E0EDE4",
    fontSize: 14,
    lineHeight: 22,
  },
  heroButton: {
    padding: 15,
    backgroundColor: palette.lime,
    borderRadius: 15,
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  heroButtonText: {
    color: "#193E2C",
    fontSize: 15,
    fontWeight: "800",
  },
  badge: {
    color: palette.green,
    fontSize: 12,
    fontWeight: "700",
    alignSelf: "flex-start",
    backgroundColor: palette.pale,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  divider: {
    height: 1,
    backgroundColor: palette.border,
  },
});

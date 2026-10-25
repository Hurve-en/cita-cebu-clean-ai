/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://unistyl.es/), etc.
 */

import "@/global.css";

import { Platform } from "react-native";

export const Colors = {
  light: {
    text: "#18392D",
    textSecondary: "#65776E",
    background: "#F5F5EF",
    backgroundElement: "#FFFFFF",
    backgroundSelected: "#E7EEE3",
    primary: "#16634A",
    onPrimary: "#FFFFFF",
    accent: "#D6F58A",
    onAccent: "#18392D",
    border: "#DCE4D9",
    success: "#16634A",
    error: "#A72E35",
    warning: "#805500",
    info: "#245888",
  },
  dark: {
    text: "#F0F5EF",
    textSecondary: "#B2C3B8",
    background: "#101D17",
    backgroundElement: "#193027",
    backgroundSelected: "#274638",
    primary: "#98D8B5",
    onPrimary: "#10251A",
    accent: "#D6F58A",
    onAccent: "#18392D",
    border: "#3B5548",
    success: "#98D8B5",
    error: "#FFB4AB",
    warning: "#F3CD83",
    info: "#A4C9F2",
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: "system-ui",
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: "ui-serif",
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: "ui-rounded",
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "var(--font-display)",
    serif: "var(--font-serif)",
    rounded: "var(--font-rounded)",
    mono: "var(--font-mono)",
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

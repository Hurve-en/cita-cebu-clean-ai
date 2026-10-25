import { Platform, StyleSheet, Text, type TextProps } from "react-native";

import { Fonts, ThemeColor } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export type ThemedTextProps = TextProps & {
  type?:
    | "default"
    | "title"
    | "small"
    | "smallBold"
    | "subtitle"
    | "link"
    | "linkPrimary"
    | "code";
  themeColor?: ThemeColor;
};

export function ThemedText({
  style,
  type = "default",
  themeColor,
  ...rest
}: ThemedTextProps) {
  const theme = useTheme();

  const color =
    theme[themeColor ?? (type === "linkPrimary" ? "primary" : "text")];

  return <Text style={[{ color }, styles[type], style]} {...rest} />;
}

const styles = StyleSheet.create({
  small: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500",
  },
  smallBold: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  default: {
    fontSize: 14,
    lineHeight: 24,
    fontWeight: "400",
  },
  title: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "700",
  },
  link: {
    fontSize: 14,
    lineHeight: 24,
    textDecorationLine: "underline",
  },
  linkPrimary: {
    fontSize: 14,
    lineHeight: 24,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  code: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: Platform.select({ android: "700", default: "500" }),
  },
});

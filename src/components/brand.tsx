import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";

type BrandProps = {
  size?: number;
  subtitle?: string;
};

export function Brand({ size = 40, subtitle }: BrandProps) {
  return (
    <View
      accessible
      accessibilityLabel={subtitle ? `CebuCleanAI, ${subtitle}` : "CebuCleanAI"}
      style={styles.container}
    >
      <Image
        source={require("@/assets/images/branding/logo.png")}
        style={{ width: size, height: size }}
        contentFit="contain"
        accessible={false}
      />

      <View style={styles.textContainer}>
        <Text style={styles.name}>
          CebuClean<Text style={styles.ai}>AI</Text>
        </Text>

        {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexShrink: 1,
  },
  textContainer: {
    flexShrink: 1,
    gap: 2,
  },
  name: {
    color: "#185D43",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
  ai: {
    color: "#476B32",
  },
  subtitle: {
    color: "#5D6E65",
    fontSize: 11,
    fontWeight: "500",
  },
});

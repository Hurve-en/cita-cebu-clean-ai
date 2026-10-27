import { Pressable, StyleSheet, Text, View } from "react-native";
import { CATEGORY_GUIDANCE } from "./resident-data";
import { openDetail, palette } from "./resident-ui";

const categories = Object.keys(CATEGORY_GUIDANCE);
const rows = Array.from(
  { length: Math.ceil(categories.length / 2) },
  (_, index) => categories.slice(index * 2, index * 2 + 2),
);

export function SortingGuide() {
  return (
    <View style={styles.grid}>
      {rows.map((row, rowIndex) => (
        <View key={row[0]} style={styles.row}>
          {row.map((name, columnIndex) => (
            <Pressable
              key={name}
              accessibilityRole="button"
              accessibilityLabel={`${name}: open sorting guide`}
              onPress={() => openDetail("category", name)}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            >
              <View style={styles.content}>
                <View style={styles.marker} accessible={false}>
                  <Text style={styles.markerText} allowFontScaling={false}>
                    {String(rowIndex * 2 + columnIndex + 1).padStart(2, "0")}
                  </Text>
                </View>

                <View style={styles.titleArea}>
                  <Text style={styles.title}>{name}</Text>
                </View>

                <View style={styles.action}>
                  <Text style={styles.actionText}>View guide</Text>
                </View>
              </View>
            </Pressable>
          ))}
          {row.length === 1 && <View style={styles.spacer} />}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    width: "100%",
    gap: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 12,
  },
  card: {
    flex: 1,
    minWidth: 0,
    minHeight: 156,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.white,
  },
  content: {
    alignSelf: "stretch",
    alignItems: "center",
    gap: 6,
  },
  spacer: {
    flex: 1,
    minWidth: 0,
  },
  marker: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EAF2EC",
  },
  markerText: {
    color: palette.green,
    fontSize: 12,
    fontWeight: "700",
  },
  titleArea: {
    alignSelf: "stretch",
    minHeight: 44,
    justifyContent: "center",
  },
  title: {
    color: palette.text,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  action: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  actionText: {
    color: palette.green,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
    textAlign: "center",
  },
  pressed: {
    opacity: 0.75,
    backgroundColor: "#F0F5EF",
  },
});

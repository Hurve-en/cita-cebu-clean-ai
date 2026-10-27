import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { useLiveResident } from "./live-state";
import { searchBarangays } from "./barangay-search";
import { Button, Copy, Icon, Message, palette } from "./resident-ui";

export function BarangayPicker({
  value,
  selectedName,
  disabled,
  onChange,
}: {
  value: string | null;
  selectedName: string | null;
  disabled: boolean;
  onChange: (id: string | null) => void;
}) {
  const { state, actions } = useLiveResident();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const data = state.barangays;
  // Search must cover every configured choice, not just the first cursor page.
  // Fetch bounded pages only while the picker is open; stop on any error.
  useEffect(() => {
    if (!open || data.loading || data.error) return;
    if (!data.loaded) void actions.loadBarangays();
    else if (data.more) void actions.loadBarangays(true);
  }, [open, data.loading, data.error, data.loaded, data.more, data.value.length, actions]);

  const name = data.value.find(row => row.id === value)?.name ?? selectedName;
  const rows = searchBarangays(data.value, query);
  const incomplete = !data.loaded || data.loading || data.more;
  function close() { Keyboard.dismiss(); setOpen(false); }
  function choose(id: string | null) { onChange(id); close(); }

  return (
    <>
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Your barangay</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Choose barangay. ${value ? name ?? "Existing selection" : "No barangay selected"}`}
          accessibilityHint="Opens a searchable list. Save account details to apply your choice."
          accessibilityState={{ disabled, expanded: open }}
          disabled={disabled}
          onPress={() => { setQuery(""); setOpen(true); }}
          style={({ pressed }) => [styles.selector, disabled && styles.disabled, pressed && styles.pressed]}
        >
          <View style={styles.pin}><Icon name="pin" size={21} /></View>
          <View style={styles.grow}>
            <Text style={styles.selection}>{value ? name ?? "Selected barangay" : "Choose your barangay"}</Text>
            <Text style={styles.hint}>{value ? "Tap to change community" : "Search by barangay name"}</Text>
          </View>
          <Icon name="arrow" size={18} />
        </Pressable>
        <Text style={styles.hint}>Your existing reports keep their original community.</Text>
      </View>

      {/* A native Modal needs a provider in its own presentation surface. */}
      <Modal visible={open} animationType="slide" presentationStyle="fullScreen" onRequestClose={close}>
        <SafeAreaProvider style={styles.screen}>
          <SafeAreaView style={styles.screen} edges={["top", "bottom", "left", "right"]} onAccessibilityEscape={close}>
            <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
              <View style={styles.header}>
                <View style={styles.grow}>
                  <Text accessibilityRole="header" style={styles.title}>Choose barangay</Text>
                  <Text style={styles.hint}>Find your community by name.</Text>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel="Close barangay picker"
                  onPress={close} style={styles.close}>
                  <Text style={styles.closeText}>Close</Text>
                </Pressable>
              </View>

              <View style={styles.search}>
                <TextInput
                  accessibilityLabel="Search barangays"
                  placeholder="Search, e.g. Lahug or Talamban"
                  placeholderTextColor={palette.muted}
                  value={query}
                  onChangeText={setQuery}
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="search"
                  onSubmitEditing={() => Keyboard.dismiss()}
                  style={styles.input}
                />
                {!!query && <Pressable accessibilityRole="button" accessibilityLabel="Clear barangay search"
                  onPress={() => setQuery("")} style={styles.clear}>
                  <Text style={styles.closeText}>Clear</Text>
                </Pressable>}
              </View>

              {value && <Text style={styles.current}>Selected: {name ?? "Your existing barangay"}</Text>}
              <Text accessibilityLiveRegion="polite" style={styles.count}>
                {data.error ? "Search is incomplete. Retry to load the remaining choices." : incomplete ? "Loading all barangays… You can search while we load." : `${rows.length} ${query.trim() ? "matching" : "available"} barangay${rows.length === 1 ? "" : "s"}`}
              </Text>

              <FlatList
                data={rows}
                extraData={value}
                keyExtractor={row => row.id}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                style={styles.list}
                contentContainerStyle={styles.listContent}
                renderItem={({ item }) => {
                  const selected = value === item.id;
                  return (
                    <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected }}
                      accessibilityLabel={item.name} onPress={() => choose(item.id)}
                      style={({ pressed }) => [styles.option, selected && styles.selected, pressed && styles.pressed]}>
                      <Text style={[styles.optionName, selected && styles.selectedText]}>{item.name}</Text>
                      <View accessible={false} style={[styles.radio, selected && styles.radioSelected]}>
                        {selected && <View style={styles.radioDot} />}
                      </View>
                    </Pressable>
                  );
                }}
                ListEmptyComponent={
                  <View style={styles.empty}>
                    <Text style={styles.emptyTitle}>{data.error ? "Barangays could not be loaded" : incomplete ? "Looking for your barangay…" : query.trim() ? "No matching barangay" : "No active barangays configured"}</Text>
                    <Copy>{data.error ? "Check your connection and retry below." : incomplete ? "Please wait while the remaining choices load." : query.trim() ? "Try a shorter name or another spelling." : "Ask the project administrator to configure your community."}</Copy>
                  </View>
                }
                ListFooterComponent={
                  <View style={styles.listFooter}>
                    {data.loading && <ActivityIndicator accessibilityLabel="Loading barangays" color={palette.green} />}
                    <Message error text={data.error} />
                    {!!data.error && <Button secondary label="Retry loading barangays" onPress={() => { void actions.loadBarangays(data.more); }} />}
                  </View>
                }
              />
              <View style={styles.footer}>
                <Button secondary label={value ? "Choose later · clear selection" : "Choose later"} onPress={() => choose(null)} />
                <Text style={styles.footerHint}>Your choice is applied when you save account details.</Text>
              </View>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </SafeAreaProvider>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.cream },
  container: { flex: 1, width: "100%", maxWidth: 560, alignSelf: "center", paddingHorizontal: 20 },
  fieldGroup: { gap: 10 },
  label: { color: palette.text, fontSize: 15, fontWeight: "700" },
  selector: { minHeight: 80, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.white, flexDirection: "row", alignItems: "center", gap: 12 },
  pin: { width: 42, height: 42, borderRadius: 14, backgroundColor: palette.pale, alignItems: "center", justifyContent: "center" },
  grow: { flex: 1, gap: 4 },
  selection: { color: palette.text, fontSize: 17, fontWeight: "700" },
  hint: { color: palette.muted, fontSize: 14, lineHeight: 21 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 20 },
  title: { color: palette.text, fontSize: 25, fontWeight: "800" },
  close: { minWidth: 56, minHeight: 48, justifyContent: "center", alignItems: "center" },
  closeText: { color: palette.green, fontSize: 15, fontWeight: "700" },
  search: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: palette.green, backgroundColor: palette.white, borderRadius: 15, paddingLeft: 15 },
  input: { flex: 1, minHeight: 54, color: palette.text, fontSize: 16, paddingVertical: 12 },
  clear: { minHeight: 48, paddingHorizontal: 12, justifyContent: "center" },
  current: { color: palette.green, fontSize: 14, fontWeight: "600", paddingTop: 14 },
  count: { color: palette.muted, fontSize: 13, lineHeight: 20, paddingVertical: 12 },
  list: { flex: 1 },
  listContent: { gap: 8, paddingBottom: 12 },
  option: { flexDirection: "row", alignItems: "center", gap: 14, minHeight: 62, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.white },
  selected: { borderColor: palette.green, backgroundColor: palette.pale },
  optionName: { flex: 1, color: palette.text, fontSize: 16, lineHeight: 23 },
  selectedText: { color: palette.green, fontWeight: "700" },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: palette.muted, alignItems: "center", justifyContent: "center" },
  radioSelected: { borderColor: palette.green },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: palette.green },
  empty: { paddingVertical: 30, gap: 8 },
  emptyTitle: { color: palette.text, fontSize: 18, fontWeight: "700" },
  listFooter: { gap: 10, paddingVertical: 10 },
  footer: { borderTopWidth: 1, borderTopColor: palette.border, paddingTop: 12, paddingBottom: 10, gap: 10 },
  footerHint: { color: palette.muted, fontSize: 12, lineHeight: 18, textAlign: "center" },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.75 },
});

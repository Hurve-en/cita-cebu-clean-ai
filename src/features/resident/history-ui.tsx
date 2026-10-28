import { router } from "expo-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../auth/auth-state";
import {
  historyStatus,
  type HistoryFilter,
  type HistoryItem,
} from "./history-model";
import { historyService } from "./history-service";
import { createHistoryStore } from "./history-store";
import { dateLabel } from "./live-model";
import { mediaService } from "./media-client";
import { materialLabel, type PendingMedia } from "./media-model";
import { PendingCard, PrivatePhoto } from "./media-ui";
import { PendingScanDelete } from "./pending-scan-delete";
import {
  Button,
  Card,
  Copy,
  Heading,
  Message,
  openDetail,
  ui,
} from "./resident-ui";
export function HistoryReports() {
  const { state } = useAuth();
  return state.user ? <HistoryContent key={state.user.id} /> : null;
}
function HistoryContent() {
  const auth = useAuth(),
    owner = auth.state.user!.id;
  const api = useMemo(() => historyService(auth.client!), [auth.client]),
    media = useMemo(() => mediaService(auth.client!), [auth.client]);
  const store = useMemo(
    () =>
      createHistoryStore((filter, cursor) => api.page(owner, filter, cursor)),
    [api, owner],
  );
  const list = useRef<FlatList<HistoryItem>>(null);
  const state = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
  const [pending, setPending] = useState<PendingMedia[]>([]),
    [pendingError, setPendingError] = useState(""),
    [busy, setBusy] = useState(false),
    [expanded, setExpanded] = useState<string | null>(null);
  const refreshPending = useCallback(async () => {
    try {
      setPending((await media.pending(owner)).filter((p) => p.kind === "scan"));
      setPendingError("");
    } catch {
      setPendingError(
        "Saved upload retries could not be loaded. They have not been discarded.",
      );
    }
  }, [media, owner]);
  useEffect(() => {
    store.activate();
    return () => store.dispose();
  }, [store]);
  useEffect(() => {
    let current = true;
    void media
      .pending(owner)
      .then((rows) => {
        if (current) setPending(rows.filter((p) => p.kind === "scan"));
      })
      .catch(() => {
        if (current)
          setPendingError("Saved upload retries could not be loaded.");
      });
    return () => {
      current = false;
    };
  }, [media, owner]);
  useEffect(() => {
    list.current?.scrollToOffset({ offset: 0, animated: false });
  }, [state.page, state.filter]);
  async function recover(p: PendingMedia, cancel = false) {
    if (busy) return;
    setBusy(true);
    setPendingError("");
    try {
      if (cancel) await media.cancelPending(p);
      else await media.resume(p);
      await refreshPending();
      await store.refresh();
    } catch (e) {
      setPendingError(
        e instanceof Error ? e.message : "Could not confirm upload. Retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  const localKeys = new Set(pending.map((p) => p.requestId));
  function row({ item: r }: { item: HistoryItem }) {
    return (
      <Card>
        <Pressable
          accessibilityRole="button"
          style={{ gap: 10 }}
          onPress={() => {
            if (r.kind === "scan") openDetail("scan-record", r.id);
            else if (r.kind === "report") openDetail("report", r.id);
            else setExpanded(expanded === r.key ? null : r.key);
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "flex-start",
            }}
          >
            <Text style={[ui.badge, { flexShrink: 1 }]}>
              {historyStatus(r)}
            </Text>
            <Text style={{ color: "#245A38", fontWeight: "700" }}>
              {r.points > 0 ? `+${r.points} pts` : "0 pts"}
            </Text>
          </View>
          <Heading>
            {r.kind === "scan"
              ? materialLabel(r.photo?.label ?? null)
              : r.title}
          </Heading>
          <Copy>
            {r.kind === "report"
              ? "Waste concern"
              : r.kind === "event"
                ? "Barangay participation"
                : r.event_id
                  ? "Event photo"
                  : "Independent photo"}{" "}
            · {dateLabel(r.occurred_at)}
          </Copy>
          {!!r.note && (
            <Text
              numberOfLines={expanded === r.key ? undefined : 2}
              style={{ color: "#536058", fontSize: 14, lineHeight: 21 }}
            >
              {r.note}
            </Text>
          )}
          {expanded === r.key && (
            <>
              <Copy>{r.location}</Copy>
              <Copy>{r.description}</Copy>
              {r.photo?.state === "ready" && (
                <PrivatePhoto row={r.photo} compact height={180} />
              )}
            </>
          )}
          {r.kind === "scan" && r.event_id && (
            <Copy>Event points appear once under participation.</Copy>
          )}
          <Copy>
            {r.kind === "scan"
              ? "Open photo and details"
              : r.kind === "report"
                ? "Open report and updates"
                : expanded === r.key
                  ? "Tap to collapse"
                  : "Tap for details"}
          </Copy>
        </Pressable>
        <PendingScanDelete
          item={r}
          onDeleted={async () => {
            await store.refresh();
            if (
              !store.getSnapshot().items.length &&
              store.getSnapshot().page > 1
            )
              await store.newer();
          }}
        />
      </Card>
    );
  }
  return (
    <SafeAreaView
      edges={["top", "bottom"]}
      style={{ flex: 1, backgroundColor: "#F5F7F2" }}
    >
      <FlatList
        style={{ flex: 1 }}
        ref={list}
        data={state.items.filter(
          (r) => !r.photo || !localKeys.has(r.photo.request_id),
        )}
        keyExtractor={(r) => r.key}
        renderItem={row}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={5}
        contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 32 }}
        ListHeaderComponent={
          <View style={{ gap: 14 }}>
            <Heading>History Reports</Heading>
            <Copy>Your saved photos, submissions and points in one place.</Copy>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {(["all", "saved", "submitted"] as HistoryFilter[]).map((f) => (
                <View key={f} style={{ flex: 1 }}>
                  <Button
                    secondary={state.filter !== f}
                    disabled={state.loading}
                    label={
                      f === "all"
                        ? "All"
                        : f === "saved"
                          ? "Saved"
                          : "Submitted"
                    }
                    onPress={() => {
                      setExpanded(null);
                      void store.filter(f);
                    }}
                  />
                </View>
              ))}
            </View>
            <Message error text={state.error || pendingError} />
            {pending.map((p) => (
              <PendingCard
                key={p.requestId}
                pending={p}
                busy={busy}
                retry={() => {
                  void recover(p);
                }}
                cancel={() => {
                  void recover(p, true);
                }}
              />
            ))}
            <Copy>
              Points appear only after a backend award. A resolved waste concern
              is separate from a verified rewards submission.
            </Copy>
          </View>
        }
        ListEmptyComponent={
          <Copy>
            {state.loading
              ? "Loading history…"
              : state.error
                ? "Retry to load your history."
                : "Nothing here yet. Save a scan now and submit it whenever you are ready."}
          </Copy>
        }
        ListFooterComponent={
          <View style={{ gap: 12 }}>
            {(state.page > 1 || state.more) && (
              <View style={{ gap: 10 }}>
                <Copy>
                  Page {state.page} · Showing up to 20 entries at a time
                </Copy>
                {state.page > 1 && (
                  <Button
                    secondary
                    disabled={state.loading || busy}
                    label="Previous page"
                    onPress={() => {
                      setExpanded(null);
                      void store.newer();
                    }}
                  />
                )}
                {state.more && (
                  <Button
                    secondary
                    disabled={state.loading || busy}
                    label="Next page"
                    onPress={() => {
                      setExpanded(null);
                      void store.older();
                    }}
                  />
                )}
              </View>
            )}
            <Button
              secondary
              disabled={state.loading || busy}
              label={state.loading ? "Refreshing…" : "Refresh history"}
              onPress={() => {
                void store.refresh();
                void refreshPending();
              }}
            />
            <Button
              secondary
              label="Report a waste concern"
              onPress={() => openDetail("new-report")}
            />
          </View>
        }
      />
      <View
        style={{
          paddingHorizontal: 20,
          paddingVertical: 12,
          borderTopWidth: 1,
          borderTopColor: "#DCE5DC",
          backgroundColor: "#F5F7F2",
        }}
      >
        <Button
          secondary
          label="Back"
          onPress={() =>
            router.canGoBack()
              ? router.back()
              : router.replace("/(tabs)/profile")
          }
        />
      </View>
    </SafeAreaView>
  );
}

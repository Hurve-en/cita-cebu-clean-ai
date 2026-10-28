import { uuid } from 'expo';
import { mediaService } from '@/features/resident/media-client';
import { MODEL_VERSION } from '@/features/resident/media-model';
import { useAuth } from "@/features/auth/auth-state";
import { useResident } from "@/features/resident/resident-state";
import { newRecordId } from "@/features/resident/resident-model";
import { Brand } from "@/components/brand";
import { CATEGORY_GUIDANCE } from "@/features/resident/resident-data";
import { Icon, openDetail } from "@/features/resident/resident-ui";
import {
  classifyPhoto,
  type WastePrediction,
} from "@/features/scanner/classify-photo";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router, useIsFocused } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type SelectedPhoto = { uri: string; source: "camera" | "library" };
const MATERIAL_NAMES: Record<string, string> = {
  glass: "Glass",
  metal: "Metal",
  "non-recyclable": "Non-recyclable",
  organic: "Organic",
  paper: "Paper",
  plastic: "Plastic",
};
const GREEN = "#185D43";
const INK = "#192F26";
const MUTED = "#5D6E65";

function Action({
  label,
  onPress,
  secondary = false,
  busy = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  busy?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        s.action,
        secondary && s.secondary,
        (disabled || busy) && s.disabled,
        pressed && s.pressed,
      ]}
    >
      {busy && (
        <ActivityIndicator size="small" color={secondary ? GREEN : "white"} />
      )}
      <Text style={[s.actionLabel, secondary && { color: GREEN }]}>
        {label}
      </Text>
    </Pressable>
  );
}
function Panel({ children }: PropsWithChildren) {
  return <View style={s.panel}>{children}</View>;
}
function Caption({ children }: PropsWithChildren) {
  return <Text style={s.copy}>{children}</Text>;
}
function Frame() {
  return (
    <View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={s.frame}
    >
      <View style={[s.corner, s.topLeft]} />
      <View style={[s.corner, s.topRight]} />
      <View style={[s.corner, s.bottomLeft]} />
      <View style={[s.corner, s.bottomRight]} />
    </View>
  );
}

function CaptureCamera({
  onCapture,
  onChoosePhoto,
  onTips,
}: {
  onCapture: (uri: string) => void;
  onChoosePhoto: () => void;
  onTips: () => void;
}) {
  const camera = useRef<CameraView>(null);
  const capturing = useRef(false);
  const alive = useRef(true);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraKey, setCameraKey] = useState(0);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  async function capture() {
    if (!camera.current || !ready || capturing.current) return;
    capturing.current = true;
    setBusy(true);
    setError(null);
    try {
      const photo = await camera.current.takePictureAsync({
        quality: 0.8,
        exif: false,
      });
      if (!photo?.uri) throw new Error("No photo returned");
      if (alive.current) onCapture(photo.uri);
    } catch {
      if (alive.current)
        setError(
          "Could not take the photo. Try again or choose one from your gallery.",
        );
    } finally {
      capturing.current = false;
      if (alive.current) setBusy(false);
    }
  }
  function restart() {
    setReady(false);
    setError(null);
    setCameraKey((value) => value + 1);
  }

  return (
    <>
      <View style={s.stage}>
        <CameraView
          ref={camera}
          key={cameraKey}
          style={StyleSheet.absoluteFill}
          facing="back"
          mode="picture"
          onCameraReady={() => setReady(true)}
          onMountError={() => {
            setReady(false);
            setError(
              "Camera unavailable. Check access or choose a gallery photo.",
            );
          }}
        />
        <View pointerEvents="none" style={s.stageTop}>
          <View style={s.livePill}>
            <View
              style={[
                s.dot,
                { backgroundColor: ready ? "#DEEDB8" : "#D3D9D4" },
              ]}
            />
            <Text style={s.stageText}>
              {error
                ? "Camera unavailable"
                : ready
                  ? "Ready to capture"
                  : "Starting camera…"}
            </Text>
          </View>
        </View>
        <Frame />
        <View pointerEvents="none" style={s.stageBottom}>
          <Text style={s.stageHint}>
            One item. Good light. Clear background.
          </Text>
        </View>
        {!ready && !error && (
          <View pointerEvents="none" style={s.center}>
            <ActivityIndicator color="white" size="large" />
          </View>
        )}
      </View>
      <View style={s.captureBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Choose a photo from gallery"
          disabled={busy}
          onPress={onChoosePhoto}
          style={({ pressed }) => [
            s.sideControl,
            pressed && s.pressed,
            busy && s.faded,
          ]}
        >
          <View style={s.sideIcon}>
            <SymbolView
              name={{
                ios: "photo",
                android: "photo_library",
                web: "photo_library",
              }}
              tintColor={GREEN}
              size={22}
            />
          </View>
          <Text style={s.controlLabel}>Gallery</Text>
        </Pressable>
        <View style={s.shutterGroup}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={busy ? "Taking photo" : "Take a photo of waste"}
            accessibilityState={{ disabled: !ready || busy, busy }}
            disabled={!ready || busy}
            onPress={capture}
            style={({ pressed }) => [
              s.shutter,
              (!ready || busy) && s.faded,
              pressed && s.pressed,
            ]}
          >
            <View style={s.shutterInner}>
              {busy ? (
                <ActivityIndicator color="white" />
              ) : (
                <Icon name="scan" color="white" size={29} />
              )}
            </View>
          </Pressable>
          <Text style={s.captureLabel}>
            {busy ? "Capturing…" : "Take photo"}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Show photo tips"
          disabled={busy}
          onPress={onTips}
          style={({ pressed }) => [
            s.sideControl,
            pressed && s.pressed,
            busy && s.faded,
          ]}
        >
          <View style={s.sideIcon}>
            <Icon name="help" size={22} />
          </View>
          <Text style={s.controlLabel}>Photo tips</Text>
        </Pressable>
      </View>
      {!!error && (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      )}
      {!!error && (
        <Action
          label="Restart camera"
          onPress={restart}
          secondary
          disabled={busy}
        />
      )}
    </>
  );
}
function ScanExperience({ live }: { live: boolean }) {
  const auth = useAuth();
  const media = useMemo(() => auth.client ? mediaService(auth.client) : null, [auth.client]);
  const isFocused = useIsFocused();
  const { state, saveScan } = useResident();
  const scanId = useRef<string | null>(null);
  const saveBusy = useRef(false);
  const [savedId,setSavedId]=useState<string|null>(null);
  const [historySaved, setHistorySaved] = useState(false);
  const [savingHistory, setSavingHistory] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [tips, setTips] = useState(false);
  const [imageReady, setImageReady] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  const [permission, requestPermission, refreshPermission] =
    useCameraPermissions();

  const pickerOpen = useRef(false);
  const analyzingRef = useRef(false);
  const requestId = useRef(0);

  const [photo, setPhoto] = useState<SelectedPhoto | null>(null);

  const [picking, setPicking] = useState(false);
  const [permissionBusy, setPermissionBusy] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const [prediction, setPrediction] = useState<WastePrediction | null>(null);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      requestId.current += 1;
    };
  }, []);

  function acceptPhoto(selected: SelectedPhoto) {
    scanId.current = live ? uuid.v4() : newRecordId();
    setHistorySaved(false);
    setSavedId(null);
    setHistoryError("");
    requestId.current += 1;
    setError(null);
    setPrediction(null);
    setImageReady(false);
    setImageFailed(false);
    setPhoto(selected);
  }

  async function choosePhoto() {
    if (pickerOpen.current || analyzingRef.current || saveBusy.current) {
      return;
    }

    pickerOpen.current = true;
    setPicking(true);
    setError(null);

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: false,
        allowsEditing: false,
        quality: 0.8,
        exif: false,
        base64: false,
      });

      // Cancellation preserves the previous photo and result.
      if (result.canceled) {
        return;
      }

      const selected = result.assets[0];

      if (!selected?.uri) {
        throw new Error("No image returned");
      }

      acceptPhoto({
        uri: selected.uri,
        source: "library",
      });
    } catch {
      setError(
        "The photo could not be opened. Try another image or check photo access in device settings.",
      );
    } finally {
      pickerOpen.current = false;
      setPicking(false);
    }
  }

  async function persistPrediction(result: WastePrediction, operation: number) {
    if (!photo || saveBusy.current) return;
    const id = scanId.current ?? (live ? uuid.v4() : newRecordId());
    scanId.current = id;
    saveBusy.current = true;
    setSavingHistory(true);
    setHistoryError("");
    setHistorySaved(false);
    try {
      if (live) {
        if (!media || !auth.state.user) throw Error("Sign in again before saving this scan.");
        const saved=await media.save(auth.state.user.id, id, {
          kind: 'scan', reportId: null, label: result.label,
          score: result.score.toFixed(8), modelVersion: MODEL_VERSION,
        }, photo.uri);
        if(operation===requestId.current)setSavedId(saved.id);
      } else {
        await saveScan({ id, label: result.label, photoUri: photo.uri });
      }
      if (operation === requestId.current) setHistorySaved(true);
    } catch (reason) {
      if (operation === requestId.current)
        setHistoryError(
          reason instanceof Error
            ? reason.message
            : "The result is ready, but history could not be saved. Try saving again.",
        );
    } finally {
      saveBusy.current = false;
      if (operation === requestId.current) setSavingHistory(false);
    }
  }

  async function analyzePhoto() {
    if (
      !photo ||
      !imageReady ||
      imageFailed ||
      analyzingRef.current ||
      saveBusy.current
    ) {
      return;
    }

    const current = ++requestId.current;

    analyzingRef.current = true;
    setAnalyzing(true);
    setPrediction(null);
    setError(null);

    try {
      const result = await classifyPhoto(photo.uri);

      if (current === requestId.current) {
        setPrediction(result);
        await persistPrediction(result, current);
      }
    } catch (reason) {
      console.warn("Local waste classification failed:", reason);

      if (current === requestId.current) {
        setError(
          "We could not analyze this photo. Try a clearer image. If the problem continues, restart your development app.",
        );
      }
    } finally {
      analyzingRef.current = false;

      if (current === requestId.current) {
        setAnalyzing(false);
      }
    }
  }

  async function allowCamera() {
    setPermissionBusy(true);
    setError(null);

    try {
      await requestPermission();
    } catch {
      setError("Camera permission could not be requested.");
    } finally {
      setPermissionBusy(false);
    }
  }

  async function openSettings() {
    setError(null);

    try {
      await Linking.openSettings();
    } catch {
      setError("Open your device settings to allow camera access.");
    }
  }

  async function checkPermission() {
    setError(null);

    try {
      await refreshPermission();
    } catch {
      setError("Could not check camera permission. Try again.");
    }
  }

  function useCamera() {
    if (analyzingRef.current || saveBusy.current) {
      return;
    }

    requestId.current += 1;
    setError(null);
    setPrediction(null);
    setPhoto(null);
  }

  const material = prediction ? MATERIAL_NAMES[prediction.label] : undefined;
  const guidance = material ? CATEGORY_GUIDANCE[material] : undefined;
  const blocked = analyzing || picking || permissionBusy || savingHistory;
  const title = prediction
    ? "Your sorting suggestion"
    : photo
      ? "Ready for a closer look?"
      : "What are we sorting?";

  return (
    <SafeAreaView style={s.screen} edges={["top", "left", "right"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.content}
      >
        <View style={s.header}>
          <Brand subtitle="Waste scanner" />
          <Text accessibilityRole="header" style={s.title}>
            {title}
          </Text>
          <Text style={s.subtitle}>
            {prediction
              ? "Check the item and your local disposal rules."
              : photo
                ? "Make sure the whole item is clearly visible."
                : "Take a photo to explore its material."}
          </Text>
          <View
            style={s.steps}
            accessibilityLabel={`Step ${prediction ? 3 : photo ? 2 : 1} of 3: ${prediction ? "Check result" : photo ? "Review photo" : "Capture photo"}`}
          >
            {["Capture", "Review", "Result"].map((label, index) => {
              const active = index <= (prediction ? 2 : photo ? 1 : 0);
              return (
                <View key={label} style={s.step}>
                  <View
                    style={[s.stepLine, active && { backgroundColor: GREEN }]}
                  />
                  <Text
                    style={[
                      s.stepLabel,
                      active && { color: GREEN, fontWeight: "700" },
                    ]}
                  >
                    {label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {live && !prediction && <Text style={s.privacy}>
          Completed scans save a resized photo and sorting suggestion to your private account history.
        </Text>}
        {picking ? (
          <Panel>
            <View style={s.empty}>
              <ActivityIndicator color={GREEN} size="large" />
              <Text style={s.heading}>Choose one photo</Text>
              <Caption>Select an image or cancel to return here.</Caption>
            </View>
          </Panel>
        ) : photo ? (
          <>
            <View style={s.photoStage}>
              <Image
                key={photo.uri}
                source={{ uri: photo.uri }}
                style={StyleSheet.absoluteFill}
                contentFit="contain"
                accessibilityLabel={
                  photo.source === "camera"
                    ? "Your captured waste photo"
                    : "Your chosen waste photo"
                }
                onLoad={() => {
                  setImageReady(true);
                  setImageFailed(false);
                }}
                onError={() => {
                  setImageReady(false);
                  setImageFailed(true);
                  setError(
                    "This image could not be displayed. Choose another photo.",
                  );
                }}
              />
              <View pointerEvents="none" style={s.photoTag}>
                <Text style={s.stageText}>
                  {photo.source === "camera" ? "Camera photo" : "Gallery photo"}
                </Text>
              </View>
              {((!imageReady && !imageFailed) || analyzing) && (
                <View style={s.analysisOverlay} pointerEvents="none">
                  <ActivityIndicator color="white" size="large" />
                  <Text style={s.overlayTitle}>
                    {analyzing
                      ? savingHistory
                        ? "Saving your result…"
                        : "Taking a closer look…"
                      : "Loading photo…"}
                  </Text>
                  {analyzing && (
                    <Text style={s.overlayCopy}>Analyzing on your iPhone</Text>
                  )}
                </View>
              )}
            </View>
            {prediction ? (
              <>
                <Panel>
                  <View style={s.resultHeader}>
                    <View style={s.resultIcon}>
                      <Icon name="leaf" size={25} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.kicker}>MODEL SUGGESTION</Text>
                      <Text accessibilityRole="header" style={s.resultTitle}>
                        {material || "Material not recognized"}
                      </Text>
                    </View>
                  </View>
                  <View style={s.divider} />
                  <Text style={s.heading}>Before you dispose</Text>
                  <Caption>
                    {guidance ||
                      "Try a clearer photo with one item against a plain background. Check the material yourself before disposal."}
                  </Caption>
                  <View style={s.caution}>
                    <Text style={s.cautionText}>
                      A suggestion, not a guarantee. AI can misidentify
                      materials.
                    </Text>
                  </View>
                </Panel>
                <View accessibilityLiveRegion="polite">
                  <Text style={s.copy}>
                    {savingHistory
                      ? live ? "Saving your photo and result to your account…" : "Saving photo and result on this device…"
                      : historySaved
                        ? live ? "Photo and result saved to your account scan history." : "Saved to scan history on this device."
                        : "Result ready. History saving has not been confirmed yet."}
                  </Text>
                </View>
                {!!historyError && (
                  <Text accessibilityRole="alert" style={s.error}>
                    {historyError}
                  </Text>
                )}
                {!live && !!state.storageError && (
                  <Text accessibilityRole="alert" style={s.error}>
                    {state.storageError}
                  </Text>
                )}
                {!historySaved && !savingHistory && (
                  <Action
                    secondary
                    label="Retry saving scan"
                    disabled={blocked}
                    onPress={() => {
                      if (prediction)
                        void persistPrediction(prediction, requestId.current);
                    }}
                  />
                )}
                <Action
                  secondary
                  label="View History Reports"
                  disabled={blocked}
                  onPress={() => openDetail("history")}
                />
                {live&&historySaved&&savedId&&<Action secondary label="Submit this photo" disabled={blocked} onPress={()=>router.push({pathname:'/reward-scan',params:{photo:savedId}})}/>}
                <Action
                  label="Scan another item"
                  onPress={useCamera}
                  disabled={blocked}
                />
              </>
            ) : (
              <>
                <View style={s.reviewNote}>
                  <View style={s.noteIcon}>
                    <Icon name="scan" size={20} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.heading}>
                      {analyzing ? "Analyzing your photo" : "Looks clear?"}
                    </Text>
                    <Caption>
                      {analyzing
                        ? "Keep this screen open while the model finishes."
                        : "Use one item, good lighting, and a simple background."}
                    </Caption>
                  </View>
                </View>
                {Platform.OS === "ios" ? (
                  <Action
                    label={analyzing ? "Analyzing…" : "Identify material"}
                    onPress={analyzePhoto}
                    busy={analyzing}
                    disabled={!imageReady || imageFailed || picking}
                  />
                ) : (
                  <Panel>
                    <Text style={s.heading}>Photo preview is available</Text>
                    <Caption>
                      Local classification currently requires your iPhone
                      development build.
                    </Caption>
                  </Panel>
                )}
              </>
            )}
            <View style={s.alternatives}>
              <View style={s.half}>
                <Action
                  secondary
                  label={prediction ? "Different photo" : "Choose another"}
                  onPress={choosePhoto}
                  disabled={blocked}
                />
              </View>
              <View style={s.half}>
                <Action
                  secondary
                  label={
                    prediction
                      ? "Analyze again"
                      : photo.source === "camera"
                        ? "Retake photo"
                        : "Use camera"
                  }
                  onPress={prediction ? analyzePhoto : useCamera}
                  disabled={blocked || (!!prediction && Platform.OS !== "ios")}
                />
              </View>
            </View>
          </>
        ) : (
          <>
            {!permission ? (
              <Panel>
                <View style={s.empty}>
                  <ActivityIndicator color={GREEN} />
                  <Caption>Checking camera access…</Caption>
                </View>
              </Panel>
            ) : !permission.granted ? (
              <>
                <Panel>
                  <View style={s.empty}>
                    <View style={s.permissionIcon}>
                      <Icon name="scan" size={38} />
                    </View>
                    <Text accessibilityRole="header" style={s.permissionTitle}>
                      A photo is a good start.
                    </Text>
                    <Text style={s.centeredCopy}>
                      Allow camera access to capture an item. You can also
                      choose an existing photo without enabling the camera.
                    </Text>
                  </View>
                  {permission.canAskAgain ? (
                    <Action
                      label="Enable camera"
                      onPress={allowCamera}
                      busy={permissionBusy}
                    />
                  ) : (
                    <>
                      <Caption>
                        {Platform.OS === "web"
                          ? "Allow camera access in your browser site settings, then check again."
                          : "Camera access is off. Enable it in device settings and return here."}
                      </Caption>
                      {Platform.OS !== "web" && (
                        <Action
                          label="Open device settings"
                          onPress={openSettings}
                          disabled={blocked}
                        />
                      )}
                      <Action
                        label="Check camera access"
                        secondary
                        onPress={checkPermission}
                        disabled={blocked}
                      />
                    </>
                  )}
                </Panel>
                <Action
                  secondary
                  label="Choose from gallery"
                  onPress={choosePhoto}
                  disabled={blocked}
                />
              </>
            ) : isFocused ? (
              <CaptureCamera
                onCapture={(uri) => acceptPhoto({ uri, source: "camera" })}
                onChoosePhoto={choosePhoto}
                onTips={() => setTips((value) => !value)}
              />
            ) : null}
          </>
        )}

        {!!error && (
          <View style={s.errorBox}>
            <Text accessibilityRole="alert" style={s.error}>
              {error}
            </Text>
          </View>
        )}
        <View style={s.support}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: tips }}
            onPress={() => setTips((value) => !value)}
            style={s.helpButton}
          >
            <Icon name="help" size={18} />
            <Text style={s.helpLabel}>
              {tips ? "Hide photo tips" : "Tips for a better scan"}
            </Text>
            <Text style={s.helpLabel}>{tips ? "−" : "+"}</Text>
          </Pressable>
          {tips && (
            <View style={s.tips}>
              <Text style={s.tip}>01 Capture one item at a time.</Text>
              <Text style={s.tip}>02 Keep the entire item in the photo.</Text>
              <Text style={s.tip}>
                03 Use bright, even light and avoid glare.
              </Text>
              <Text style={s.tip}>
                04 The frame is a guide, not an automatic crop.
              </Text>
            </View>
          )}
          <Text style={s.privacy}>
            {live
              ? "Analysis runs on this device. Completed scans upload a resized photo and result to your private account history. Pending saves keep a retry copy on this device; other temporary copies may remain in the app cache."
              : "Saved scan photos stay on this device until you delete their records. Other copies may remain in the app cache."}
          </Text>
          <Text style={s.limit}>
            Hazardous waste is not supported. Scans do not verify disposal or
            earn points.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F6F7F3" },
  content: {
    padding: 20,
    paddingBottom: 32,
    width: "100%",
    maxWidth: 580,
    alignSelf: "center",
    gap: 18,
  },
  header: { gap: 10, paddingTop: 8 },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  brandMark: {
    width: 32,
    height: 32,
    borderRadius: 11,
    backgroundColor: GREEN,
    alignItems: "center",
    justifyContent: "center",
  },
  brand: { color: GREEN, fontSize: 14, fontWeight: "700" },
  brandDivider: { color: "#A5B7AA" },
  title: {
    color: INK,
    fontSize: 29,
    lineHeight: 36,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  subtitle: { color: MUTED, fontSize: 14, lineHeight: 22 },
  steps: { flexDirection: "row", gap: 10, marginTop: 8 },
  step: { flex: 1, gap: 7 },
  stepLine: { height: 3, borderRadius: 2, backgroundColor: "#DCE5DE" },
  stepLabel: { color: MUTED, fontSize: 11, lineHeight: 18 },
  stage: {
    width: "100%",
    aspectRatio: 0.9,
    maxHeight: 460,
    borderRadius: 26,
    overflow: "hidden",
    backgroundColor: "#14251C",
  },
  stageTop: {
    position: "absolute",
    left: 16,
    right: 16,
    top: 16,
    alignItems: "flex-start",
  },
  livePill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#14251CD9",
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  stageText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
  },
  stageBottom: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 14,
    padding: 10,
    borderRadius: 12,
    backgroundColor: "#14251CD9",
  },
  stageHint: {
    color: "white",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 19,
  },
  frame: {
    position: "absolute",
    left: "12%",
    right: "12%",
    top: "20%",
    bottom: "23%",
  },
  corner: {
    position: "absolute",
    width: 30,
    height: 30,
    borderColor: "#DEEDB8",
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 13,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 13,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 13,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 13,
  },
  center: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  captureBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: 2,
  },
  sideControl: { width: 80, alignItems: "center", gap: 7, paddingVertical: 8 },
  sideIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: "#EAF2EC",
    alignItems: "center",
    justifyContent: "center",
  },
  controlLabel: { color: MUTED, fontSize: 11, fontWeight: "600" },
  shutterGroup: { alignItems: "center", gap: 8 },
  shutter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 2,
    borderColor: GREEN,
    padding: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  shutterInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: GREEN,
    alignItems: "center",
    justifyContent: "center",
  },
  captureLabel: { color: GREEN, fontSize: 12, fontWeight: "700" },
  panel: {
    backgroundColor: "white",
    borderColor: "#DCE5DE",
    borderWidth: 1,
    borderRadius: 23,
    padding: 20,
    gap: 14,
  },
  empty: { alignItems: "center", gap: 16, paddingVertical: 22 },
  permissionIcon: {
    width: 88,
    height: 88,
    borderRadius: 30,
    backgroundColor: "#EAF2EC",
    alignItems: "center",
    justifyContent: "center",
  },
  permissionTitle: {
    color: INK,
    fontSize: 22,
    lineHeight: 29,
    fontWeight: "700",
    textAlign: "center",
  },
  centeredCopy: {
    color: MUTED,
    fontSize: 14,
    lineHeight: 23,
    textAlign: "center",
  },
  copy: { color: MUTED, fontSize: 14, lineHeight: 23 },
  heading: { color: INK, fontSize: 16, lineHeight: 24, fontWeight: "700" },
  photoStage: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 25,
    overflow: "hidden",
    backgroundColor: "#14251C",
  },
  photoTag: {
    position: "absolute",
    top: 14,
    left: 14,
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 10,
    backgroundColor: "#14251CD9",
  },
  analysisOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "#10251BCC",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    padding: 20,
  },
  overlayTitle: {
    color: "white",
    fontSize: 19,
    fontWeight: "700",
    textAlign: "center",
  },
  overlayCopy: { color: "#D7E8DC", fontSize: 13, textAlign: "center" },
  reviewNote: { flexDirection: "row", alignItems: "center", gap: 12 },
  noteIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#EAF2EC",
    alignItems: "center",
    justifyContent: "center",
  },
  resultHeader: { flexDirection: "row", alignItems: "center", gap: 14 },
  resultIcon: {
    width: 54,
    height: 54,
    borderRadius: 19,
    backgroundColor: "#EAF2EC",
    alignItems: "center",
    justifyContent: "center",
  },
  kicker: {
    color: GREEN,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    lineHeight: 18,
  },
  resultTitle: {
    color: INK,
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
  divider: { height: 1, backgroundColor: "#DCE5DE" },
  caution: { padding: 12, borderRadius: 12, backgroundColor: "#F5F3E8" },
  cautionText: { color: "#6A562B", fontSize: 12, lineHeight: 19 },
  action: {
    minHeight: 54,
    backgroundColor: GREEN,
    borderRadius: 16,
    padding: 15,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 9,
  },
  actionLabel: {
    color: "white",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  secondary: { backgroundColor: "#EAF2EC" },
  disabled: { opacity: 0.5 },
  faded: { opacity: 0.45 },
  pressed: { opacity: 0.7 },
  alternatives: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  half: { flexGrow: 1, flexBasis: 140 },
  support: { gap: 10, marginTop: 2 },
  helpButton: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    justifyContent: "center",
  },
  helpLabel: { color: GREEN, fontSize: 13, fontWeight: "600" },
  tips: { gap: 10, backgroundColor: "#EAF2EC", borderRadius: 16, padding: 16 },
  tip: { color: GREEN, fontSize: 13, lineHeight: 21 },
  privacy: { color: MUTED, fontSize: 11, lineHeight: 18, textAlign: "center" },
  limit: { color: MUTED, fontSize: 11, lineHeight: 18, textAlign: "center" },
  errorBox: { backgroundColor: "#FBECEE", padding: 14, borderRadius: 14 },
  error: { color: "#A12D39", fontSize: 13, lineHeight: 21 },
});

export default function ScanScreen() {
  const { state } = useAuth();
  return <ScanExperience key={state.user?.id ?? "demo"} live={Boolean(state.user)} />;
}

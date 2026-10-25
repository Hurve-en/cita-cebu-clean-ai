import { CameraView, useCameraPermissions } from "expo-camera";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useIsFocused } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Linking, Platform, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { AppButton } from "@/components/ui/app-button";
import { AppCard } from "@/components/ui/app-card";
import { AppScreen } from "@/components/ui/app-screen";
import {
  classifyPhoto,
  type WastePrediction,
} from "@/features/scanner/classify-photo";

type SelectedPhoto = {
  uri: string;
  source: "camera" | "library";
};

type CaptureCameraProps = {
  onCapture: (uri: string) => void;
  onChoosePhoto: () => void;
};

const MATERIAL_NAMES: Record<string, string> = {
  glass: "Glass",
  metal: "Metal",
  "non-recyclable": "Non-recyclable",
  organic: "Organic material",
  paper: "Paper / cardboard",
  plastic: "Plastic",
};

function CaptureCamera({ onCapture, onChoosePhoto }: CaptureCameraProps) {
  const camera = useRef<CameraView>(null);
  const capturing = useRef(false);

  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraKey, setCameraKey] = useState(0);

  async function capturePhoto() {
    if (!camera.current || !ready || capturing.current) {
      return;
    }

    capturing.current = true;
    setBusy(true);
    setError(null);

    try {
      const photo = await camera.current.takePictureAsync({
        quality: 0.8,
        exif: false,
      });

      if (!photo?.uri) {
        throw new Error("No photo returned");
      }

      onCapture(photo.uri);
    } catch {
      setError("The photo could not be captured. Please try again.");
    } finally {
      capturing.current = false;
      setBusy(false);
    }
  }

  function restartCamera() {
    setReady(false);
    setError(null);
    setCameraKey((value) => value + 1);
  }

  return (
    <>
      <View style={styles.cameraContainer}>
        <CameraView
          key={cameraKey}
          ref={camera}
          style={styles.camera}
          facing="back"
          mode="picture"
          onCameraReady={() => setReady(true)}
          onMountError={() => {
            setReady(false);
            setError(
              "The camera could not start. Check permissions or choose a photo instead.",
            );
          }}
        />
      </View>

      <ThemedText themeColor="textSecondary">
        Frame one item in good light against a plain background.
      </ThemedText>

      {error && (
        <ThemedText accessibilityRole="alert" themeColor="error">
          {error}
        </ThemedText>
      )}

      <AppButton
        label={busy ? "Taking photo…" : "Take photo"}
        onPress={capturePhoto}
        loading={busy}
        disabled={!ready}
      />

      <AppButton
        label="Choose a photo"
        variant="secondary"
        onPress={onChoosePhoto}
        disabled={busy}
      />

      {error && (
        <AppButton
          label="Restart camera"
          variant="secondary"
          onPress={restartCamera}
          disabled={busy}
        />
      )}
    </>
  );
}

export default function ScanScreen() {
  const isFocused = useIsFocused();

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
    requestId.current += 1;
    setError(null);
    setPrediction(null);
    setPhoto(selected);
  }

  async function choosePhoto() {
    if (pickerOpen.current || analyzingRef.current) {
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

  async function analyzePhoto() {
    if (!photo || analyzingRef.current) {
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
      }
    } catch (reason) {
      console.warn("Local waste classification failed:", reason);

      if (current === requestId.current) {
        setError(
          "Analysis failed. Try another photo. If it keeps failing, check the terminal and confirm the development app was rebuilt.",
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
    if (analyzingRef.current) {
      return;
    }

    requestId.current += 1;
    setError(null);
    setPrediction(null);
    setPhoto(null);
  }

  return (
    <AppScreen
      title={photo ? "Review your photo" : "Waste scanner"}
      description={
        photo
          ? "Check the item, then request a local AI suggestion."
          : "Take a photo or choose one from your library."
      }
    >
      {picking ? (
        <AppCard variant="soft">
          <ThemedText>Choose a photo or cancel to return.</ThemedText>
        </AppCard>
      ) : photo ? (
        <>
          <Image
            source={{ uri: photo.uri }}
            style={styles.photo}
            contentFit="contain"
            accessibilityLabel={
              photo.source === "camera"
                ? "Your captured waste photo"
                : "Your selected library photo"
            }
            onError={() => {
              setError(
                "This image could not be displayed. Please choose another photo.",
              );
            }}
          />

          {prediction ? (
            <AppCard variant="soft" accessibilityLiveRegion="polite">
              <ThemedText type="smallBold">
                Model suggestion · check before sorting
              </ThemedText>

              <ThemedText type="subtitle">
                {MATERIAL_NAMES[prediction.label] ?? prediction.label}
              </ThemedText>

              <ThemedText>
                AI can misidentify materials. Check the item and your barangay’s
                accepted waste categories before disposal.
              </ThemedText>

              <ThemedText type="small" themeColor="textSecondary">
                Hazardous waste is not supported. A scan does not verify
                disposal or earn reward points.
              </ThemedText>
            </AppCard>
          ) : (
            <AppCard variant="soft">
              <ThemedText type="smallBold">
                {analyzing ? "Analyzing on your phone…" : "Ready to analyze"}
              </ThemedText>

              <ThemedText>
                Use one clear item. The model covers glass, metal, organic
                material, paper/cardboard, plastic, and non-recyclable waste.
              </ThemedText>
            </AppCard>
          )}

          {Platform.OS === "ios" ? (
            <AppButton
              label={
                analyzing
                  ? "Analyzing…"
                  : prediction
                    ? "Analyze again"
                    : "Analyze photo"
              }
              onPress={analyzePhoto}
              loading={analyzing}
            />
          ) : (
            <ThemedText themeColor="textSecondary">
              Local classification is currently enabled in the iPhone
              development build only.
            </ThemedText>
          )}

          <AppButton
            label="Choose another photo"
            variant="secondary"
            onPress={choosePhoto}
            disabled={analyzing}
          />

          <AppButton
            label={photo.source === "camera" ? "Retake photo" : "Use camera"}
            variant="secondary"
            onPress={useCamera}
            disabled={analyzing}
          />
        </>
      ) : (
        <>
          {!permission ? (
            <ThemedText>Checking camera permission…</ThemedText>
          ) : !permission.granted ? (
            <>
              <AppCard variant="soft">
                <ThemedText type="smallBold">Camera access</ThemedText>

                <ThemedText>
                  Allow camera access to take a photo, or select an existing
                  image below. Gallery selection does not require camera access.
                </ThemedText>
              </AppCard>

              {permission.canAskAgain ? (
                <AppButton
                  label="Allow camera"
                  onPress={allowCamera}
                  loading={permissionBusy}
                />
              ) : (
                <>
                  <ThemedText themeColor="textSecondary">
                    {Platform.OS === "web"
                      ? "Allow camera access in your browser’s site settings, then check permission again."
                      : "Allow camera access in device settings, then return here."}
                  </ThemedText>

                  {Platform.OS !== "web" && (
                    <AppButton label="Open settings" onPress={openSettings} />
                  )}

                  <AppButton
                    label="Check permission again"
                    variant="secondary"
                    onPress={checkPermission}
                  />
                </>
              )}
            </>
          ) : isFocused ? (
            <CaptureCamera
              onCapture={(uri) => {
                acceptPhoto({
                  uri,
                  source: "camera",
                });
              }}
              onChoosePhoto={choosePhoto}
            />
          ) : null}

          {!permission?.granted && (
            <AppButton
              label="Choose a photo"
              variant="secondary"
              onPress={choosePhoto}
              disabled={permissionBusy}
            />
          )}
        </>
      )}

      {error && (
        <ThemedText accessibilityRole="alert" themeColor="error">
          {error}
        </ThemedText>
      )}

      <ThemedText type="small" themeColor="textSecondary">
        Photos are not uploaded. Original gallery images are unchanged. Selected
        or captured copies may remain in the app’s local cache.
      </ThemedText>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  cameraContainer: {
    width: "100%",
    aspectRatio: 3 / 4,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#18392D",
  },
  camera: {
    flex: 1,
  },
  photo: {
    width: "100%",
    aspectRatio: 3 / 4,
    borderRadius: 24,
    backgroundColor: "#18392D",
  },
});

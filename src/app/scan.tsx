import { CameraView, useCameraPermissions } from "expo-camera";
import { Image } from "expo-image";
import { useIsFocused } from "expo-router";
import { useRef, useState } from "react";
import { Linking, Platform, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { AppButton } from "@/components/ui/app-button";
import { AppCard } from "@/components/ui/app-card";
import { AppScreen } from "@/components/ui/app-screen";

type CaptureCameraProps = {
  onCapture: (uri: string) => void;
};

function CaptureCamera({ onCapture }: CaptureCameraProps) {
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
              "The camera could not start. Check permissions and close other apps using it.",
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

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [permissionBusy, setPermissionBusy] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  async function allowCamera() {
    setPermissionBusy(true);
    setPermissionError(null);

    try {
      await requestPermission();
    } catch {
      setPermissionError("Camera permission could not be requested.");
    } finally {
      setPermissionBusy(false);
    }
  }

  async function openSettings() {
    setPermissionError(null);

    try {
      await Linking.openSettings();
    } catch {
      setPermissionError("Open your device settings to allow camera access.");
    }
  }

  async function checkPermission() {
    setPermissionError(null);

    try {
      await refreshPermission();
    } catch {
      setPermissionError("Could not check camera permission. Try again.");
    }
  }

  return (
    <AppScreen
      title={photoUri ? "Review your photo" : "Waste scanner"}
      description={
        photoUri
          ? "Make sure the item is clear and easy to see."
          : "One item. A little more clarity."
      }
    >
      {photoUri ? (
        <>
          <Image
            source={{ uri: photoUri }}
            style={styles.photo}
            contentFit="contain"
            accessibilityLabel="Your captured waste photo"
          />

          <AppCard variant="soft">
            <ThemedText type="smallBold">Photo captured</ThemedText>

            <ThemedText>
              This preview does not identify waste or award points.
              Classification will be added after camera capture is tested.
            </ThemedText>
          </AppCard>

          <AppButton label="Retake photo" onPress={() => setPhotoUri(null)} />
        </>
      ) : !permission ? (
        <ThemedText>Checking camera permission…</ThemedText>
      ) : !permission.granted ? (
        <>
          <AppCard variant="soft">
            <ThemedText type="smallBold">Camera access</ThemedText>

            <ThemedText>
              Allow access to photograph a waste item. This feature does not
              request microphone or location access.
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
                  : "Allow camera access in your device settings, then return here."}
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
        <CaptureCamera onCapture={setPhotoUri} />
      ) : null}

      {permissionError && (
        <ThemedText accessibilityRole="alert" themeColor="error">
          {permissionError}
        </ThemedText>
      )}

      <ThemedText type="small" themeColor="textSecondary">
        Photos are not uploaded or saved to your gallery. Captures may remain
        temporarily in the app’s local cache.
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

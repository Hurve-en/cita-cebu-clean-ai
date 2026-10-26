import { useState } from "react";
import { Image } from "expo-image";
import { Text, View } from "react-native";
import { savedPhotoUri } from "./local-records";
export function SavedPhoto({
  fileName,
  label,
}: {
  fileName: string;
  label: string;
}) {
  return <PhotoContent key={fileName} fileName={fileName} label={label} />;
}
function PhotoContent({
  fileName,
  label,
}: {
  fileName: string;
  label: string;
}) {
  const [failed, setFailed] = useState(false);
  const uri = savedPhotoUri(fileName);
  return (
    <View
      style={{
        width: "100%",
        aspectRatio: 1.2,
        borderRadius: 16,
        overflow: "hidden",
        backgroundColor: "#EAF2EC",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {failed || !uri ? (
        <Text style={{ padding: 20, color: "#5D6E65", textAlign: "center" }}>
          Photo unavailable. The record is still saved.
        </Text>
      ) : (
        <Image
          source={{ uri }}
          style={{ width: "100%", height: "100%" }}
          contentFit="contain"
          accessibilityLabel={label}
          onError={() => setFailed(true)}
        />
      )}
    </View>
  );
}

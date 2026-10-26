import { ResidentProvider } from "@/features/resident/resident-state";
import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <ResidentProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </ResidentProvider>
  );
}

import { ResidentProvider } from "@/features/resident/resident-state";
import { OfficerProvider } from "@/features/officer/officer-state";
import { Stack } from "expo-router";
export default function RootLayout() {
  return (
    <OfficerProvider>
      <ResidentProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </ResidentProvider>
    </OfficerProvider>
  );
}

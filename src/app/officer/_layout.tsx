import { Redirect, Stack } from "expo-router";
import { useOfficer } from "@/features/officer/officer-state";
export default function OfficerLayout() {
  const { session } = useOfficer();
  if (!session) return <Redirect href="/account" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}

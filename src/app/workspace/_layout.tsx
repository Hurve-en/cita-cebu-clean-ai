import { Redirect, Stack } from "expo-router";
import { useAuth } from "@/features/auth/auth-state";
export default function WorkspaceLayout() {
  const { state } = useAuth();
  if (!state.user) return <Redirect href="/account" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}

import { Redirect } from "expo-router";
import { useAuth } from "@/features/auth/auth-state";
import { AccessStatus } from "@/features/auth/workspace";
export default function Screen() {
  const { state } = useAuth();
  if (state.phase !== "ready") return <AccessStatus />;
  if (state.access?.product_role !== "resident")
    return <Redirect href="/workspace" />;
  return <Redirect href="/(tabs)/home" />;
}

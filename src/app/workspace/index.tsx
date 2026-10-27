import { Redirect } from "expo-router";
import { useAuth } from "@/features/auth/auth-state";
import { AccessStatus } from "@/features/auth/workspace";
export default function WorkspaceEntry() {
  const { state } = useAuth();
  if (state.phase !== "ready" || !state.access) return <AccessStatus />;
  if (state.access.product_role === "resident")
    return <Redirect href="/workspace/resident" />;
  if (state.access.product_role === "officer")
    return <Redirect href="/workspace/officer" />;
  return <Redirect href="/workspace/admin" />;
}

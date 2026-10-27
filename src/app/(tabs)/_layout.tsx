import { Redirect } from "expo-router";
import AppTabs from "@/components/app-tabs";
import { useResident } from "@/features/resident/resident-state";
import { useAuth } from "@/features/auth/auth-state";
import { AccessStatus } from "@/features/auth/workspace";
export default function ResidentTabsLayout() {
  const { state } = useResident();
  const auth = useAuth();
  if (auth.state.user) {
    if (auth.state.phase === "loading") return <AppTabs />;
    if (auth.state.phase !== "ready") return <AccessStatus />;
    if (auth.state.access?.product_role !== "resident")
      return <Redirect href="/workspace" />;
    return <AppTabs />;
  }
  if (!state.profile) return <Redirect href="/account" />;
  return <AppTabs />;
}

import { Redirect } from "expo-router";

import AppTabs from "@/components/app-tabs";
import { useResident } from "@/features/resident/resident-state";

export default function ResidentTabsLayout() {
  const { state } = useResident();

  if (!state.profile) return <Redirect href="/" />;

  return <AppTabs />;
}

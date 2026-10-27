import { Stack } from "expo-router";
import {
  ResidentProvider,
  useResident,
} from "@/features/resident/resident-state";
import { OfficerProvider, useOfficer } from "@/features/officer/officer-state";
import { AuthProvider, useAuth } from "@/features/auth/auth-state";
import { DemoProvider, useDemo } from "@/features/auth/demo-state";
function Routes() {
  const auth = useAuth();
  const demo = useDemo();
  const resident = useResident();
  const officer = useOfficer();
  const preview = __DEV__ && auth.state.phase === "signedOut";
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="account" />
      <Stack.Protected guard={Boolean(auth.state.user)}>
        <Stack.Screen name="workspace" />
      </Stack.Protected>
      <Stack.Protected guard={preview}>
        <Stack.Screen name="demo" />
      </Stack.Protected>
      <Stack.Protected
        guard={
          preview && demo.role === "resident" && Boolean(resident.state.profile)
        }
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="detail" />
      </Stack.Protected>
      <Stack.Protected
        guard={preview && demo.role === "officer" && Boolean(officer.session)}
      >
        <Stack.Screen name="officer" />
      </Stack.Protected>
      <Stack.Protected guard={preview && demo.role === "admin"}>
        <Stack.Screen name="admin" />
      </Stack.Protected>
    </Stack>
  );
}
export default function RootLayout() {
  return (
    <AuthProvider>
      <OfficerProvider>
        <ResidentProvider>
          <DemoProvider>
            <Routes />
          </DemoProvider>
        </ResidentProvider>
      </OfficerProvider>
    </AuthProvider>
  );
}

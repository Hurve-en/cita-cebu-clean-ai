import { useAuth } from "@/features/auth/auth-state";
import { LiveProfile } from "@/features/resident/live-ui";
import { Redirect } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";

import { useResident } from "@/features/resident/resident-state";
import {
  Button,
  Card,
  Copy,
  Heading,
  Icon,
  MenuItem,
  openDetail,
  Page,
  Section,
  ui,
} from "@/features/resident/resident-ui";

function DemoProfileScreen() {
  const { state, dispatch } = useResident();
  const [confirmingLogout, setConfirmingLogout] = useState(false);

  if (!state.profile) {
    return <Redirect href="/" />;
  }

  function logout() {
    dispatch({ type: "logout" });
  }

  if (confirmingLogout) {
    return (
      <Page
        title="Leave the demo?"
        subtitle="You can come back and explore anytime."
      >
        <Card>
          <Heading>Your demo session will end</Heading>
          <Copy>
            Your temporary profile, reports, points, and redemption history will
            reset.
          </Copy>
        </Card>

        <Button label="Confirm logout" onPress={logout} />

        <Button
          secondary
          label="Keep exploring"
          onPress={() => setConfirmingLogout(false)}
        />
      </Page>
    );
  }

  return (
    <Page title="Your space" subtitle="Manage your details and preferences.">
      <Card>
        <View style={ui.row}>
          <View
            style={[
              ui.emptyIcon,
              {
                width: 64,
                height: 64,
                borderRadius: 22,
                marginBottom: 0,
              },
            ]}
          >
            <Icon name="person" size={30} />
          </View>

          <View style={ui.flex}>
            <Heading>{state.profile.name}</Heading>
            <Copy>{state.profile.email}</Copy>
          </View>
        </View>

        <View style={ui.divider} />

        <Text style={ui.badge}>Resident · Demo session</Text>
      </Card>

      <Section title="Account" />

      <MenuItem
        icon="person"
        title="Personal details"
        detail="Name and community"
        onPress={() => openDetail("edit-profile")}
      />

      <MenuItem
        icon="pin"
        title="My barangay"
        detail={state.profile.barangay || "Choose your community"}
        onPress={() => openDetail("barangay")}
      />

      <Section title="Your activity" />

      <MenuItem
        icon="report"
        title="My reports"
        detail={`${state.reports.length} reports this session`}
        onPress={() => openDetail("reports")}
      />

      <MenuItem
        icon="history"
        title="Scan history"
        detail="Saved scanning activity"
        onPress={() => openDetail("history")}
      />

      <MenuItem
        icon="gift"
        title="Redemption history"
        detail={`${state.redemptions.length} demo redemptions`}
        onPress={() => openDetail("redemptions")}
      />

      <Section title="Preferences & support" />

      <MenuItem
        icon="settings"
        title="Settings"
        detail="Reminder preferences"
        onPress={() => openDetail("settings")}
      />

      <MenuItem
        icon="help"
        title="Help & privacy"
        detail="About CebuCleanAI and your data"
        onPress={() => openDetail("help")}
      />

      <Button
        secondary
        label="Log out of demo"
        onPress={() => setConfirmingLogout(true)}
      />
    </Page>
  );
}

export default function ProfileScreen() {
  const { state } = useAuth();
  return state.user ? <LiveProfile /> : <DemoProfileScreen />;
}

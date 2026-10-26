import { useState } from "react";
import { Redirect } from "expo-router";
import { Text } from "react-native";
import { useOfficer } from "@/features/officer/officer-state";
import { OfficerPage } from "@/features/officer/officer-ui";
import {
  Button,
  Card,
  Copy,
  Heading,
  ui,
} from "@/features/resident/resident-ui";
export default function OfficerProfile() {
  const { session, endDemo } = useOfficer();
  const [leaving, setLeaving] = useState(false);
  if (!session) return <Redirect href="/account" />;
  if (leaving)
    return (
      <OfficerPage
        title="Leave the officer demo?"
        description="Your resident records stay separate."
      >
        <Card>
          <Heading>Demo changes will reset</Heading>
          <Copy>
            Schedule edits, report statuses, and internal notes are temporary
            and will be reset when this demo ends.
          </Copy>
        </Card>
        <Button label="Confirm logout" onPress={endDemo} />
        <Button
          secondary
          label="Keep working"
          onPress={() => setLeaving(false)}
        />
      </OfficerPage>
    );
  return (
    <OfficerPage
      title="Your officer profile"
      description="Your assignment and access in this preview."
    >
      <Card>
        <Heading>{session.name}</Heading>
        <Copy>{session.email}</Copy>
        <Text style={ui.badge}>Officer · Development preview</Text>
      </Card>
      <Card>
        <Heading>Assigned community</Heading>
        <Copy>{session.barangayName}</Copy>
        <Copy>
          Officers review reports and manage collection schedules for their
          assigned barangay. Assignment changes belong to an admin.
        </Copy>
      </Card>
      <Card>
        <Heading>What is connected?</Heading>
        <Copy>
          This is an in-memory demo. No real login, role authorization,
          published schedules, notifications, or resident report synchronization
          is connected.
        </Copy>
      </Card>
      <Button
        secondary
        label="Log out of officer demo"
        onPress={() => setLeaving(true)}
      />
    </OfficerPage>
  );
}

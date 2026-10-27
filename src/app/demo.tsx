import { Redirect, router } from "expo-router";
import { useState } from "react";
import { useAuth } from "@/features/auth/auth-state";
import { useDemo } from "@/features/auth/demo-state";
import {
  Button,
  Card,
  Copy,
  Heading,
  Message,
  Page,
} from "@/features/resident/resident-ui";
export default function DemoScreen() {
  const auth = useAuth();
  const demo = useDemo();
  const [error, setError] = useState("");
  if (!__DEV__) return <Redirect href="/account" />;
  if (auth.state.user) return <Redirect href="/workspace" />;
  return (
    <Page
      title="Explore a preview"
      subtitle="Development only · Sample data"
      back
    >
      <Card>
        <Heading>No real account access</Heading>
        <Copy>
          These previews use sample data. Their role selection does not sign you
          in or grant database permissions.
        </Copy>
      </Card>
      <Message error text={error} />
      {(["resident", "officer", "admin"] as const).map((role) => (
        <Button
          key={role}
          label={`Open ${role} preview`}
          disabled={auth.state.phase !== "signedOut"}
          onPress={() => {
            try {
              demo.start(role);
              router.replace(
                role === "resident"
                  ? "/(tabs)/home"
                  : role === "officer"
                    ? "/officer"
                    : "/admin",
              );
            } catch (e) {
              setError(e instanceof Error ? e.message : "Preview unavailable.");
            }
          }}
        />
      ))}
    </Page>
  );
}

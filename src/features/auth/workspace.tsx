import { Redirect } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "./auth-state";
import type { ProductRole } from "./auth-model";
import { Mfa } from "./mfa";
import {
  Button,
  Card,
  Copy,
  Field,
  Heading,
  Message,
  Page,
} from "@/features/resident/resident-ui";
function SignOut() {
  const { signOut } = useAuth();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  return (
    <>
      <Message error text={error} />
      <Button
        secondary
        disabled={busy}
        label={busy ? "Signing out…" : "Sign out of this device"}
        onPress={() => {
          if (running.current) return;
          running.current = true;
          setBusy(true);
          setError("");
          void signOut()
            .catch((e) =>
              setError(
                e instanceof Error ? e.message : "Sign-out failed. Retry.",
              ),
            )
            .finally(() => {
              running.current = false;
              setBusy(false);
            });
        }}
      />
    </>
  );
}
export function AccessStatus() {
  const auth = useAuth();
  if (!auth.state.user && auth.state.phase === "signedOut")
    return <Redirect href="/account" />;
  const showMfa =
    auth.state.phase === "mfa" ||
    (auth.state.phase === "loading" && auth.state.mfaPending);
  return (
    <Page
      title={showMfa ? "Secure your account." : "Account access"}
      badge="Account access"
    >
      {showMfa ? (
        <Mfa />
      ) : auth.state.phase === "loading" ? (
        <Copy>Checking your session and current account access…</Copy>
      ) : (
        <Message
          error
          text={auth.state.message || "Workspace access is unavailable."}
        />
      )}
      {auth.state.phase !== "loading" && (
        <Button
          secondary
          label="Check account access again"
          onPress={() => {
            void auth.refresh();
          }}
        />
      )}
      {auth.state.user && <SignOut />}
    </Page>
  );
}
export function RoleWorkspace({ role }: { role: ProductRole }) {
  const { state } = useAuth();
  if (state.phase !== "ready" || !state.access || !state.user)
    return <AccessStatus />;
  if (state.access.product_role !== role) return <Redirect href="/workspace" />;
  return (
    <Page
      title={
        role === "resident"
          ? "Your community account"
          : role === "officer"
            ? "Your officer account"
            : "Your administrator account"
      }
      subtitle={state.user.email}
      badge={`${role === "admin" ? "Administrator" : role === "officer" ? "Officer" : "Resident"} · Signed in`}
    >
      <ProfilePanel key={state.user.id} role={role} userId={state.user.id} />
      <Card>
        <Heading>Community features are being connected</Heading>
        <Copy>
          {role === "resident"
            ? "Live schedules, report submission, scan history, and rewards will be connected in later branches."
            : role === "officer"
              ? "Live report review and schedule publishing will be connected after the trusted write workflows are implemented."
              : "Live officer provisioning, activation, and assignment management will be connected through audited administrator workflows."}
        </Copy>
        <Copy>
          Your real account does not load sample records or grant access to the
          development previews.
        </Copy>
      </Card>
      <SignOut />
    </Page>
  );
}
type Profile = {
  user_id: string;
  display_name: string;
  resident_barangay_id: string | null;
  version: number;
};
type Barangay = { id: string; name: string };
function ProfilePanel({ role, userId }: { role: ProductRole; userId: string }) {
  const { client, state, refresh } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [barangays, setBarangays] = useState<Barangay[]>([]);
  const [name, setName] = useState("");
  const [barangay, setBarangay] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  const running = useRef(false);
  useEffect(() => {
    mounted.current = true;
    async function load() {
      if (!client) return;
      const [own, communities] = await Promise.all([
        client
          .from("profiles")
          .select("user_id,display_name,resident_barangay_id,version")
          .eq("user_id", userId)
          .single(),
        client
          .from("barangays")
          .select("id,name")
          .eq("enabled", true)
          .order("name"),
      ]);
      if (!mounted.current) return;
      if (
        own.error ||
        communities.error ||
        !own.data ||
        own.data.user_id !== userId ||
        !Number.isSafeInteger(own.data.version)
      ) {
        setError("Could not load your profile. Check account access again.");
        return;
      }
      setProfile(own.data as Profile);
      setName(own.data.display_name);
      setBarangay(own.data.resident_barangay_id);
      setBarangays((communities.data ?? []) as Barangay[]);
    }
    void load().catch(() => {
      if (mounted.current)
        setError("Could not load your profile. Retry account access.");
    });
    return () => {
      mounted.current = false;
    };
  }, [client, userId]);
  async function save() {
    if (running.current || !profile || !client) return;
    if (name.trim().length < 2 || name.trim().length > 80) {
      setError("Enter a name between 2 and 80 characters.");
      return;
    }
    running.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await client.rpc("update_own_profile", {
        p_display_name: name.trim(),
        p_resident_barangay_id:
          role === "resident" ? barangay : profile.resident_barangay_id,
        p_expected_version: profile.version,
      });
      if (result.error)
        throw Error(
          result.error.code === "40001"
            ? "Your profile changed elsewhere. Check account access again before saving."
            : "Your profile could not be saved. Check your access and try again.",
        );
      const row = (
        Array.isArray(result.data) ? result.data[0] : result.data
      ) as Profile | null;
      if (!row || row.user_id !== userId || !Number.isSafeInteger(row.version))
        throw Error(
          "The saved profile could not be confirmed. Reload before trying again.",
        );
      if (mounted.current) {
        setProfile(row);
        setName(row.display_name);
        setBarangay(row.resident_barangay_id);
        setNotice("Your profile was saved to your account.");
      }
    } catch (e) {
      if (mounted.current)
        setError(
          e instanceof Error ? e.message : "Your profile could not be saved.",
        );
    } finally {
      running.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <>
      <Card>
        <Heading>Account details</Heading>
        <Copy>Role: {role}</Copy>
        {role === "officer" && (
          <Copy>
            Assigned barangay:{" "}
            {barangays.find((b) => b.id === state.access?.assigned_barangay_id)
              ?.name ?? "Loading assignment…"}
          </Copy>
        )}
        <Copy>
          Your role and activation are managed by the service. Editing your
          profile cannot change them.
        </Copy>
      </Card>
      <Message error text={error} />
      <Message text={notice} />
      {profile ? (
        <>
          <Field
            label="Display name"
            value={name}
            onChangeText={setName}
            maxLength={80}
            editable={!busy}
            autoComplete="name"
          />
          {role === "resident" && (
            <>
              <Heading>Your barangay</Heading>
              {barangays.length ? (
                <>
                  <Copy>
                    Choose your community for future collection information.
                  </Copy>
                  {barangays.map((b) => (
                    <Button
                      secondary
                      key={b.id}
                      label={`${barangay === b.id ? "Selected: " : ""}${b.name}`}
                      disabled={busy}
                      onPress={() => setBarangay(b.id)}
                    />
                  ))}
                  <Button
                    secondary
                    label={
                      barangay === null
                        ? "Selected: No barangay yet"
                        : "Choose later"
                    }
                    disabled={busy}
                    onPress={() => setBarangay(null)}
                  />
                </>
              ) : (
                <Copy>
                  No active barangays are configured yet. You can save your name
                  and choose a community later.
                </Copy>
              )}
            </>
          )}
          <Button
            disabled={busy}
            label={busy ? "Saving…" : "Save account details"}
            onPress={() => {
              void save();
            }}
          />
        </>
      ) : (
        !error && <Copy>Loading your profile…</Copy>
      )}
      <Button
        secondary
        disabled={busy}
        label="Check account access again"
        onPress={() => {
          void refresh();
        }}
      />
    </>
  );
}

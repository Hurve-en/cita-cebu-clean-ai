import { useEffect, useRef, useState } from "react";
import { Text } from "react-native";
import { useAuth } from "./auth-state";
import {
  Button,
  Card,
  Copy,
  Field,
  Heading,
  Message,
} from "@/features/resident/resident-ui";
import { authError } from "./auth-actions";
export function Mfa() {
  const { client, refresh } = useAuth();
  const [factors, setFactors] = useState<
    { id: string; friendly_name?: string }[] | null
  >(null);
  const [enrollment, setEnrollment] = useState<{
    id: string;
    secret: string;
  } | null>(null);
  const [chosen, setChosen] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const mounted = useRef(true);
  const pending = useRef<string | null>(null);
  useEffect(() => {
    mounted.current = true;
    async function load() {
      if (!client) return;
      const result = await client.auth.mfa.listFactors();
      if (!mounted.current) return;
      if (result.error) {
        setError("Could not load verification methods. Retry account access.");
        return;
      }
      setFactors(result.data.totp);
      setChosen(result.data.totp[0]?.id ?? "");
    }
    void load().catch(() => {
      if (mounted.current)
        setError("Could not load verification methods. Retry account access.");
    });
    return () => {
      mounted.current = false;
    }; // Never auto-delete a factor during an auth-event race.
  }, [client]);
  async function run(operation: () => Promise<void>) {
    if (running.current || !client) return;
    running.current = true;
    setBusy(true);
    setError("");
    try {
      await operation();
    } catch (e) {
      if (mounted.current)
        setError(e instanceof Error ? e.message : "Verification failed.");
    } finally {
      running.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <>
      <Card>
        <Heading>Two-step verification</Heading>
        <Copy>
          Staff accounts require an authenticator code before opening this
          workspace. Residents with an enrolled authenticator also complete this
          check.
        </Copy>
      </Card>
      {factors === null ? (
        <Copy>Loading verification methods…</Copy>
      ) : factors.length > 0 ? (
        factors.map((f) => (
          <Button
            secondary
            key={f.id}
            disabled={busy}
            label={`${chosen === f.id ? "Selected: " : ""}${f.friendly_name || "Authenticator"}`}
            onPress={() => {
              setChosen(f.id);
              setCode("");
            }}
          />
        ))
      ) : enrollment ? (
        <Card>
          <Heading>Add CebuCleanAI to your authenticator</Heading>
          <Copy>
            Choose manual setup with a time-based key. Keep this key private.
            After adding it, enter the code below.
          </Copy>
          <Text selectable accessibilityLabel="Authenticator setup key">
            {enrollment.secret}
          </Text>
        </Card>
      ) : (
        <Button
          label="Set up an authenticator"
          disabled={busy}
          onPress={() => {
            void run(async () => {
              const result = await client!.auth.mfa.enroll({
                factorType: "totp",
                friendlyName: `CebuCleanAI ${Date.now()}`,
              });
              if (result.error) throw Error(authError(result.error));
              if (!mounted.current) {
                await client!.auth.mfa.unenroll({ factorId: result.data.id });
                return;
              }
              pending.current = result.data.id;
              setEnrollment({
                id: result.data.id,
                secret: result.data.totp.secret,
              });
              setChosen(result.data.id);
            });
          }}
        />
      )}
      {chosen && (
        <>
          <Field
            label="Authenticator code"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            maxLength={6}
            editable={!busy}
            autoComplete="one-time-code"
          />
          <Button
            disabled={busy}
            label={busy ? "Verifying…" : "Verify authenticator"}
            onPress={() => {
              void run(async () => {
                if (!/^\d{6}$/.test(code))
                  throw Error("Enter the six-digit authenticator code.");
                const result = await client!.auth.mfa.challengeAndVerify({
                  factorId: chosen,
                  code,
                });
                if (result.error)
                  throw Error(
                    "The code could not be verified. Check the code and try again.",
                  );
                pending.current = null;
                setCode("");
                setEnrollment(null);
                await refresh();
              });
            }}
          />
        </>
      )}
      <Message error text={error} />
    </>
  );
}

import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { useAuth } from "@/features/auth/auth-state";
import { Mfa } from "@/features/auth/mfa";
import { createAccountActions } from "@/features/auth/auth-actions";
import {
  Button,
  Card,
  Copy,
  Field,
  Heading,
  Message,
  Page,
} from "@/features/resident/resident-ui";
type Mode = "login" | "register" | "verify" | "forgot" | "recovery" | "reset";
const titles: Record<Mode, string> = {
  login: "Welcome back.",
  register: "Join your community.",
  verify: "Verify your email.",
  forgot: "Recover your account.",
  recovery: "Check your email.",
  reset: "Choose a new password.",
};
export default function AccountScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const auth = useAuth();
  const actions = useMemo(
    () => (auth.client ? createAccountActions(auth.client) : null),
    [auth.client],
  );
  const [mode, setMode] = useState<Mode>(
    params.mode === "register" ? "register" : "login",
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [passwordUpdated, setPasswordUpdated] = useState(false);
  const running = useRef(false);
  // Recovery sessions must remain on the reset flow until completed or cancelled.
  const recovery = mode === "recovery" || mode === "reset";
  if (auth.state.user && !recovery && !busy)
    return <Redirect href="/workspace" />;
  function changeMode(next: Mode) {
    setMode(next);
    setError("");
    setMessage("");
    setPassword("");
    setConfirm("");
    setCode("");
    if (next !== "reset") actions?.clearRecovery();
  }
  async function run(operation: () => Promise<void>) {
    if (running.current || !actions) return;
    running.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await operation();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The request could not be completed.",
      );
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  function submit() {
    if (!actions) return;
    void run(async () => {
      if (mode === "login") {
        try {
          await actions.login(email, password);
        } finally {
          setPassword("");
        }
      } else if (mode === "register") {
        await actions.register(name, email, password, confirm);
        setPassword("");
        setConfirm("");
        setCode("");
        setMode("verify");
        setMessage(
          "If this address needs confirmation, check your inbox for a code. Existing users can return to sign in or recover their account.",
        );
      } else if (mode === "verify") {
        await actions.verify(email, code, false);
        setCode("");
      } else if (mode === "forgot") {
        await actions.recover(email);
        setCooldown(Date.now() + 60_000);
        setMode("recovery");
        setMessage(
          "If this address has an account, a recovery code will arrive. Check your inbox and spam folder.",
        );
      } else if (mode === "recovery") {
        await actions.verify(email, code, true);
        setCode("");
        setMode("reset");
      } else {
        await actions.reset(password, confirm);
        setPassword("");
        setConfirm("");
        setPasswordUpdated(true);
        await auth.signOut();
        setPasswordUpdated(false);
        changeMode("login");
        setMessage("Password updated. Sign in with your new password.");
      }
    });
  }
  function backToLogin() {
    if (auth.state.user && recovery) {
      void run(async () => {
        await auth.signOut();
        actions?.clearRecovery();
        changeMode("login");
      });
    } else changeMode("login");
  }
  function resend() {
    if (!actions) return;
    if (Date.now() < cooldown) {
      setError("Wait at least one minute before requesting another code.");
      return;
    }
    void run(async () => {
      if (mode === "recovery") await actions.recover(email);
      else await actions.resend(email);
      setCooldown(Date.now() + 60_000);
      setMessage(
        "If this address is eligible, another code will arrive. Only use the newest code.",
      );
    });
  }
  if (passwordUpdated)
    return (
      <Page title="Password updated." badge="Account recovery">
        <Copy>
          Your new password was saved. Finish signing out before signing in
          again.
        </Copy>
        <Message error text={error} />
        <Button
          disabled={busy}
          label={busy ? "Signing out…" : "Finish signing out"}
          onPress={() => {
            void run(async () => {
              await auth.signOut();
              setPasswordUpdated(false);
              changeMode("login");
              setMessage("Password updated. Sign in with your new password.");
            });
          }}
        />
      </Page>
    );
  if (
    mode === "reset" &&
    (auth.state.phase === "mfa" ||
      (auth.state.phase === "loading" && auth.state.mfaPending))
  )
    return (
      <Page title="Verify your authenticator" badge="Account recovery">
        <Mfa />
        <Button
          secondary
          disabled={busy}
          label="Cancel recovery and sign out"
          onPress={backToLogin}
        />
      </Page>
    );
  const codeMode = mode === "verify" || mode === "recovery";
  return (
    <Page
      title={titles[mode]}
      subtitle="CebuCleanAI account access"
      badge="Account access"
    >
      {!auth.client && (
        <Message
          error
          text={auth.state.message || "Preparing account access…"}
        />
      )}
      {mode === "register" && (
        <>
          <Field
            label="Full name"
            value={name}
            onChangeText={setName}
            autoComplete="name"
            maxLength={80}
            editable={!busy}
          />
          <Copy>
            Registration creates a resident account. Choose your barangay after
            verifying your email.
          </Copy>
        </>
      )}
      {mode !== "reset" && (
        <Field
          label="Email address"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={254}
          editable={!busy}
        />
      )}
      {(mode === "login" || mode === "register" || mode === "reset") && (
        <Field
          label={mode === "reset" ? "New password" : "Password"}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          placeholder={
            mode === "login" ? "Your password" : "At least 12 characters"
          }
          editable={!busy}
        />
      )}
      {(mode === "register" || mode === "reset") && (
        <Field
          label="Confirm password"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          editable={!busy}
        />
      )}
      {codeMode && (
        <>
          <Card>
            <Heading>Enter your email code</Heading>
            <Copy>
              Use the newest code sent to your email address. Never share it
              with another person.
            </Copy>
          </Card>
          <Field
            label="Verification code"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            maxLength={10}
            editable={!busy}
          />
        </>
      )}
      <Message error text={error} />
      <Message text={message} />
      <Button
        disabled={
          busy ||
          !actions ||
          (mode === "reset" && auth.state.phase === "loading")
        }
        label={
          busy
            ? "Please wait…"
            : mode === "login"
              ? "Sign in"
              : mode === "register"
                ? "Create resident account"
                : mode === "forgot"
                  ? "Send recovery code"
                  : mode === "reset"
                    ? "Update password"
                    : "Verify code"
        }
        onPress={submit}
      />
      {codeMode && (
        <Button
          secondary
          disabled={busy || !actions}
          label="Send another code"
          onPress={resend}
        />
      )}
      {mode === "login" ? (
        <>
          <Button
            secondary
            disabled={busy}
            label="Create a resident account"
            onPress={() => changeMode("register")}
          />
          <Button
            secondary
            disabled={busy}
            label="Forgot password?"
            onPress={() => changeMode("forgot")}
          />
          <Button
            secondary
            disabled={busy}
            label="Verify email"
            onPress={() => changeMode("verify")}
          />
          {__DEV__ && (
            <Button
              secondary
              disabled={busy || auth.state.phase !== "signedOut"}
              label="Explore development previews"
              onPress={() => router.push("/demo")}
            />
          )}
        </>
      ) : (
        <Button
          secondary
          disabled={busy}
          label={
            recovery && auth.state.user
              ? "Cancel recovery and sign out"
              : "Back to sign in"
          }
          onPress={backToLogin}
        />
      )}
      <Copy>
        Officer and administrator access is assigned by an authorized
        administrator. Public registration cannot choose a staff role.
      </Copy>
    </Page>
  );
}

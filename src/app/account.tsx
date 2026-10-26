import { useState } from "react";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useResident } from "@/features/resident/resident-state";
import {
  Button,
  Card,
  Copy,
  Field,
  Heading,
  Icon,
  Message,
  Page,
} from "@/features/resident/resident-ui";
type Mode = "login" | "register" | "forgot" | "reset" | "verify";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export default function AccountScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const { state, dispatch } = useResident();
  const [mode, setMode] = useState<Mode>(
    params.mode === "register" ? "register" : "login",
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [barangay, setBarangay] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  if (state.profile) return <Redirect href="/(tabs)/home" />;
  function changeMode(next: Mode) {
    setMode(next);
    setError("");
    setMessage("");
    setPassword("");
    setConfirm("");
  }
  function enterDemo(quick = false) {
    dispatch({
      type: "enter",
      profile: {
        name: quick ? "Demo resident" : name.trim() || "Demo resident",
        email: quick ? "demo@example.com" : email.trim().toLowerCase(),
        barangay: quick ? "" : barangay.trim(),
      },
    });
    setPassword("");
    setConfirm("");
    router.replace("/(tabs)/home");
  }
  function submit() {
    setError("");
    setMessage("");
    if (mode !== "reset" && !EMAIL.test(email.trim())) {
      setError("Enter an email address such as demo@example.com.");
      return;
    }
    if (mode === "forgot") {
      setMessage(
        "Recovery preview ready. No email was sent. You can explore the reset screen below.",
      );
      return;
    }
    if (mode === "register" && (!name.trim() || !barangay.trim())) {
      setError("Add your name and barangay to continue.");
      return;
    }
    if (mode === "login" && !password) {
      setError("Enter a throwaway password, or choose Try the demo.");
      return;
    }
    if (
      (mode === "register" || mode === "reset") &&
      (password.length < 8 || password !== confirm)
    ) {
      setError("Use at least 8 characters and enter the same password twice.");
      return;
    }
    if (mode === "register") {
      setPassword("");
      setConfirm("");
      setMode("verify");
      return;
    }
    if (mode === "reset") {
      changeMode("login");
      setMessage("Reset preview complete. No password was changed.");
      return;
    }
    enterDemo();
  }
  const titles: Record<Mode, string> = {
    login: "Good to see you again.",
    register: "Make cleaner habits together.",
    forgot: "Let’s get you back in.",
    reset: "A fresh start.",
    verify: "One more step.",
  };
  const descriptions: Record<Mode, string> = {
    login: "Sign in to your community space.",
    register: "Create your resident profile.",
    forgot: "Enter your email to preview account recovery.",
    reset: "Choose a new password for the reset preview.",
    verify: "Preview your email verification journey.",
  };
  return (
    <Page title={titles[mode]} subtitle={descriptions[mode]} back>
      {mode === "verify" ? (
        <>
          <Card>
            <Icon name="person" size={32} />
            <Heading>Check your inbox</Heading>
            <Copy>
              A connected account service would send a verification link to{" "}
              {email}. This demo has not created an account or sent an email.
            </Copy>
          </Card>
          <Button label="Continue to demo" onPress={() => enterDemo()} />
          <Button
            secondary
            label="Back to sign in"
            onPress={() => changeMode("login")}
          />
        </>
      ) : (
        <>
          {mode === "register" && (
            <>
              <Field
                label="Full name"
                placeholder="Your name"
                value={name}
                onChangeText={setName}
                autoComplete="name"
              />
              <Field
                label="Barangay"
                placeholder="Your community"
                value={barangay}
                onChangeText={setBarangay}
              />
            </>
          )}
          {mode !== "reset" && (
            <Field
              label="Email address"
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
            />
          )}
          {mode !== "forgot" && (
            <Field
              label={mode === "reset" ? "New password" : "Password"}
              placeholder={
                mode === "login"
                  ? "Enter a throwaway password"
                  : "At least 8 characters"
              }
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCorrect={false}
              autoCapitalize="none"
            />
          )}
          {(mode === "register" || mode === "reset") && (
            <Field
              label="Confirm password"
              placeholder="Enter it again"
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
              autoCorrect={false}
              autoCapitalize="none"
            />
          )}
          <Message error text={error} />
          <Message text={message} />
          <Button
            label={
              mode === "login"
                ? "Sign in to demo"
                : mode === "register"
                  ? "Preview account creation"
                  : mode === "forgot"
                    ? "Preview recovery"
                    : "Preview password reset"
            }
            onPress={submit}
          />
          {mode === "login" && (
            <>
              <Button
                secondary
                label="Try the demo · no login needed"
                onPress={() => enterDemo(true)}
              />
              <Button
                secondary
                label="Forgot password?"
                onPress={() => changeMode("forgot")}
              />
              <Button
                secondary
                label="New here? Create an account"
                onPress={() => changeMode("register")}
              />
            </>
          )}
          {mode === "forgot" && !!message && (
            <Button
              label="Explore reset screen"
              onPress={() => changeMode("reset")}
            />
          )}
          {mode !== "login" && (
            <Button
              secondary
              label="Back to sign in"
              onPress={() => changeMode("login")}
            />
          )}
          <Copy>
            Use sample details only. This preview does not verify credentials or
            save passwords.
          </Copy>
        </>
      )}
    </Page>
  );
}

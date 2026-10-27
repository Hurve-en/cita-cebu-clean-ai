import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizedEmail, passwordError, validEmail } from "./auth-model";
export function authError(error: unknown) {
  const code = (error as { code?: string })?.code;
  if (code === "invalid_credentials")
    return "The email or password is incorrect.";
  if (code === "email_not_confirmed")
    return "Verify your email first. Choose Verify email below.";
  if (code === "otp_expired")
    return "That code is invalid or expired. Request a new code.";
  if (code === "weak_password")
    return "Choose a stronger password that meets the account password policy.";
  if (code?.includes("rate_limit") || code === "over_request_rate_limit")
    return "Too many attempts. Wait before trying again.";
  return "The request could not be completed. Check your connection and try again.";
}
export function createAccountActions(client: SupabaseClient) {
  let recoveryUser: string | null = null;
  const emailFor = (s: string) => {
    const email = normalizedEmail(s);
    if (!validEmail(email)) throw Error("Enter a valid email address.");
    return email;
  };
  return {
    async login(raw: string, password: string) {
      const email = emailFor(raw);
      if (!password) throw Error("Enter your password.");
      const result = await client.auth.signInWithPassword({ email, password });
      if (result.error) throw Error(authError(result.error));
    },
    async register(
      name: string,
      raw: string,
      password: string,
      confirm: string,
    ) {
      const email = emailFor(raw);
      const cleanName = name.trim();
      if (cleanName.length < 2 || cleanName.length > 80)
        throw Error("Enter a name between 2 and 80 characters.");
      const invalid = passwordError(password, confirm);
      if (invalid) throw Error(invalid);
      const result = await client.auth.signUp({
        email,
        password,
        options: { data: { display_name: cleanName } },
      });
      if (result.error) throw Error(authError(result.error));
      // Do not fabricate a successful login or role for an obfuscated duplicate response.
      return Boolean(result.data.session);
    },
    async resend(raw: string) {
      const result = await client.auth.resend({
        email: emailFor(raw),
        type: "signup",
      });
      if (result.error) throw Error(authError(result.error));
    },
    async recover(raw: string) {
      recoveryUser = null;
      const result = await client.auth.resetPasswordForEmail(emailFor(raw));
      if (result.error) throw Error(authError(result.error));
    },
    async verify(raw: string, code: string, recovery: boolean) {
      recoveryUser = null;
      if (!/^\d{6,10}$/.test(code.trim()))
        throw Error("Enter the verification code from your email.");
      const result = await client.auth.verifyOtp({
        email: emailFor(raw),
        token: code.trim(),
        type: recovery ? "recovery" : "email",
      });
      if (result.error || !result.data.user || !result.data.session)
        throw Error(
          result.error
            ? authError(result.error)
            : "Verification did not create a session. Try again.",
        );
      if (recovery) recoveryUser = result.data.user.id;
    },
    async reset(password: string, confirm: string) {
      const invalid = passwordError(password, confirm);
      if (invalid) throw Error(invalid);
      if (!recoveryUser)
        throw Error("Verify a recovery code before choosing a new password.");
      const result = await client.auth.getUser();
      if (result.error || result.data.user?.id !== recoveryUser) {
        recoveryUser = null;
        throw Error(
          "The recovery session changed. Request a new recovery code.",
        );
      }
      const updated = await client.auth.updateUser({ password });
      if (updated.error) throw Error(authError(updated.error));
      recoveryUser = null;
    },
    clearRecovery() {
      recoveryUser = null;
    },
  };
}

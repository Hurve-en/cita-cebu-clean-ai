export type ProductRole = "resident" | "officer" | "admin";
export type Access = {
  user_id: string;
  product_role: ProductRole;
  enabled: boolean;
  provisioning_state: "pending" | "ready";
  email_verified: boolean;
  eligible: boolean;
  access_version: number;
  assigned_barangay_id: string | null;
};
export function parseAccess(value: unknown, userId: string): Access {
  if (!value || typeof value !== "object")
    throw new Error("Account access is unavailable.");
  const a = value as Record<string, unknown>;
  if (
    a.user_id !== userId ||
    !["resident", "officer", "admin"].includes(String(a.product_role)) ||
    typeof a.enabled !== "boolean" ||
    typeof a.email_verified !== "boolean" ||
    typeof a.eligible !== "boolean" ||
    !["pending", "ready"].includes(String(a.provisioning_state)) ||
    !Number.isSafeInteger(a.access_version) ||
    Number(a.access_version) < 1 ||
    !(
      a.assigned_barangay_id === null ||
      typeof a.assigned_barangay_id === "string"
    )
  ) {
    throw new Error("Account access is unavailable. Retry or contact support.");
  }
  // Do not accept a contradictory response as an eligible role.
  if (
    a.eligible &&
    (!a.enabled ||
      !a.email_verified ||
      a.provisioning_state !== "ready" ||
      (a.product_role === "officer" && !a.assigned_barangay_id))
  ) {
    throw new Error("Account access could not be verified.");
  }
  return a as Access;
}
export function accessMessage(a: Access) {
  if (!a.enabled)
    return "This account is disabled or awaiting activation. Contact your administrator.";
  if (a.provisioning_state !== "ready")
    return "Your account setup is awaiting an administrator.";
  if (!a.email_verified) return "Verify your email address before continuing.";
  if (a.product_role === "officer" && !a.assigned_barangay_id)
    return "An active barangay assignment is required. Contact your administrator.";
  return "Your account is not eligible for workspace access. Contact your administrator.";
}
export function needsMfa(
  a: Access,
  level: string | null,
  nextLevel: string | null,
) {
  return (
    a.eligible &&
    (a.product_role !== "resident" || nextLevel === "aal2") &&
    level !== "aal2"
  );
}
export function publicConfig(url: string | undefined, key: string | undefined) {
  try {
    const parsed = new URL(url ?? "");
    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash ||
      parsed.pathname !== "/"
    )
      throw Error();
    if (!key || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) throw Error();
    return { url: parsed.origin, key };
  } catch {
    throw new Error(
      "Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, then restart Expo. Use a publishable key, never a database password or secret key.",
    );
  }
}
export const normalizedEmail = (s: string) => s.trim().toLowerCase();
export const validEmail = (s: string) =>
  s.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
export function passwordError(password: string, confirm: string) {
  if (password.length < 12) return "Use at least 12 characters.";
  if (password !== confirm) return "The passwords do not match.";
  return "";
}

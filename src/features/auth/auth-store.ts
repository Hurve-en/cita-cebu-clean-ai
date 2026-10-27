import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import {
  accessMessage,
  needsMfa,
  parseAccess,
  type Access,
} from "./auth-model";
export type AuthState = {
  phase: "loading" | "signedOut" | "ready" | "blocked" | "mfa" | "error";
  user: User | null;
  access: Access | null;
  message: string;
  // UI continuity only; never establishes eligibility or a role.
  mfaPending?: boolean;
};
const initial: AuthState = {
  phase: "loading",
  user: null,
  access: null,
  message: "",
};
export function createAuthStore(client: SupabaseClient) {
  let state: AuthState = initial;
  let epoch = 0;
  let alive = true;
  let queued: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<() => void>();
  const publish = (next: AuthState) => {
    if (alive) {
      state = next;
      listeners.forEach((fn) => fn());
    }
  };
  async function inspect(session: Session | null) {
    const current = ++epoch;
    if (!session) {
      publish({ phase: "signedOut", user: null, access: null, message: "" });
      return;
    }
    publish({
      phase: "loading",
      user: session.user,
      access: null,
      message: "",
      mfaPending:
        state.user?.id === session.user.id && Boolean(state.mfaPending),
    });
    try {
      // Verify the stored session with Auth; stored user metadata never establishes a role.
      const verified = await client.auth.getUser();
      if (
        verified.error ||
        !verified.data.user ||
        verified.data.user.id !== session.user.id
      )
        throw Error("Your session could not be verified. Retry or sign out.");
      const [response, assurance] = await Promise.all([
        client.rpc("get_current_access"),
        client.auth.mfa.getAuthenticatorAssuranceLevel(),
      ]);
      if (response.error || assurance.error)
        throw Error(
          "Could not check account access. Check your connection and retry.",
        );
      const access = parseAccess(response.data, verified.data.user.id);
      if (!alive || current !== epoch) return;
      const phase = !access.eligible
        ? "blocked"
        : needsMfa(
              access,
              assurance.data.currentLevel,
              assurance.data.nextLevel,
            )
          ? "mfa"
          : "ready";
      publish({
        phase,
        user: verified.data.user,
        access,
        mfaPending: phase === "mfa",
        message: phase === "blocked" ? accessMessage(access) : "",
      });
    } catch (error) {
      if (alive && current === epoch)
        publish({
          phase: "error",
          user: session.user,
          access: null,
          message:
            error instanceof Error
              ? error.message
              : "Account access could not be checked.",
        });
    }
  }
  async function refresh() {
    // Invalidate in-flight permission reads before awaiting local session restoration.
    const current = ++epoch;
    publish({ ...state, phase: "loading", access: null, message: "" });
    try {
      const result = await client.auth.getSession();
      if (!alive || current !== epoch) return;
      if (result.error) throw result.error;
      await inspect(result.data.session);
    } catch {
      if (alive && current === epoch)
        publish({
          ...state,
          phase: "error",
          access: null,
          message: "Could not restore your session. Retry or sign out.",
        });
    }
  }
  function start() {
    alive = true;
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      ++epoch;
      if (queued) clearTimeout(queued);
      // No awaited SDK calls in this callback. Clear access before scheduling verification.
      publish({
        phase: session ? "loading" : "signedOut",
        user: session?.user ?? null,
        access: null,
        message: "",
        mfaPending: Boolean(
          session && state.user?.id === session.user.id && state.mfaPending,
        ),
      });
      queued = setTimeout(() => {
        void inspect(session);
      }, 0);
    });
    void refresh();
    return () => {
      alive = false;
      ++epoch;
      if (queued) clearTimeout(queued);
      data.subscription.unsubscribe();
    };
  }
  async function signOut() {
    ++epoch;
    if (queued) clearTimeout(queued);
    publish({ ...state, phase: "loading", access: null, message: "" });
    try {
      const { error } = await client.auth.signOut({ scope: "local" });
      if (error) throw error;
      ++epoch;
      publish({ phase: "signedOut", user: null, access: null, message: "" });
    } catch {
      ++epoch;
      publish({
        ...state,
        phase: "error",
        access: null,
        message: "Sign-out did not complete. Check your connection and retry.",
      });
      throw Error("Sign-out did not complete. Retry while online.");
    }
  }
  return {
    subscribe: (fn: () => void) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    getSnapshot: () => state,
    start,
    refresh,
    signOut,
  };
}

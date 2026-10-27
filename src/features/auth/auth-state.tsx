import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type PropsWithChildren,
} from "react";
import { AppState, Platform } from "react-native";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import { createAuthStore, type AuthState } from "./auth-store";
type Context = {
  state: AuthState;
  client: SupabaseClient | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};
const AuthContext = createContext<Context | null>(null);
export function AuthProvider({ children }: PropsWithChildren) {
  const [runtime, setRuntime] = useState<{
    client: SupabaseClient;
    store: ReturnType<typeof createAuthStore>;
  } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    async function initialize() {
      const client = getSupabase();
      await client.auth.initialize();
      if (active) setRuntime({ client, store: createAuthStore(client) });
    }
    void initialize().catch((e) => {
      if (active)
        setError(
          e instanceof Error
            ? e.message
            : "Authentication configuration is missing.",
        );
    });
    return () => {
      active = false;
    };
  }, []);
  if (runtime)
    return <ConnectedAuth runtime={runtime}>{children}</ConnectedAuth>;
  return (
    <AuthContext.Provider
      value={{
        state: {
          phase: error ? "error" : "loading",
          user: null,
          access: null,
          message: error,
        },
        client: null,
        refresh: async () => {},
        signOut: async () => {},
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
function ConnectedAuth({
  runtime,
  children,
}: PropsWithChildren<{
  runtime: {
    client: SupabaseClient;
    store: ReturnType<typeof createAuthStore>;
  };
}>) {
  const { client, store } = runtime;
  const state = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
  useEffect(() => store.start(), [store]);
  useEffect(() => {
    const onActive = () => {
      client.auth.startAutoRefresh();
      void store.refresh();
    };
    const sub = AppState.addEventListener("change", (value) => {
      if (value === "active") onActive();
      else client.auth.stopAutoRefresh();
    });
    if (Platform.OS !== "web" && AppState.currentState === "active")
      client.auth.startAutoRefresh();
    return () => {
      sub.remove();
      client.auth.stopAutoRefresh();
    };
  }, [client, store]);
  return (
    <AuthContext.Provider
      value={{ state, client, refresh: store.refresh, signOut: store.signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw Error("useAuth requires AuthProvider");
  return value;
}

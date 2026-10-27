import "react-native-url-polyfill/auto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { authStorage } from "./auth-storage";
import { publicConfig } from "../features/auth/auth-model";
let client: SupabaseClient | undefined;
export function getSupabase() {
  if (client) return client;
  const config = publicConfig(
    process.env.EXPO_PUBLIC_SUPABASE_URL,
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
  client = createClient(config.url, config.key, {
    auth: {
      storage: authStorage,
      storageKey: "cebuclean:auth:v1",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  return client;
}

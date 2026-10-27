import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { publicConfig } from '../auth/auth-model';
import { createMediaService } from './media-service';
import { mediaSpool } from './media-local';
import { preparePhoto } from './media-photo';
export function mediaService(client:SupabaseClient){
  return createMediaService(client,token=>{
    const config=publicConfig(process.env.EXPO_PUBLIC_SUPABASE_URL,process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
    // A private instance pins ALL HTTP operations (including Storage) to the
    // original identity. It has no persistent Auth session or privileged key.
    return createClient(config.url,config.key,{accessToken:async()=>token,
      auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  },mediaSpool,preparePhoto);
}

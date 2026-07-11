import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdminConfig } from './guideApplicationsApi.js';

export function createAdminSupabaseClient(config = getSupabaseAdminConfig()) {
  if (!config.isConfigured) {
    throw new Error('Supabase environment values are missing.');
  }
  const client = createClient(config.url, config.publishableKey, {
    global: {
      headers: config.accessToken ? { Authorization: `Bearer ${config.accessToken}` } : {}
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
  if (config.accessToken) client.realtime.setAuth(config.accessToken);
  return client;
}

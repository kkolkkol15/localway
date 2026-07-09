import { createClient } from '@supabase/supabase-js';

const defaultSupabaseConfig = {
  url: 'https://qrabzkcibqaslealvdar.supabase.co',
  publishableKey: 'sb_publishable_QYusbitKD__5tfmQSLzNbg_Tb3wrVMa'
};

export function getSupabaseConfig(env = import.meta.env) {
  const url = env.VITE_SUPABASE_URL ?? defaultSupabaseConfig.url;
  const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY ?? defaultSupabaseConfig.publishableKey;
  return { url, publishableKey, isConfigured: Boolean(url && publishableKey) };
}

export function buildSupabaseAuthOptions(browserWindow = typeof window === 'undefined' ? null : window) {
  return {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      ...(browserWindow?.sessionStorage ? { storage: browserWindow.sessionStorage } : {})
    }
  };
}

export async function createBrowserSupabaseClient(env = import.meta.env) {
  const config = getSupabaseConfig(env);
  if (!config.isConfigured) {
    throw new Error('Supabase URL and publishable key are not configured.');
  }

  return createClient(config.url, config.publishableKey, buildSupabaseAuthOptions());
}

export function mapAuthUser(authUser, profile = null) {
  const displayName = profile?.display_name || authUser.user_metadata?.display_name || authUser.email?.split('@')[0] || 'Traveler';

  return {
    id: authUser.id,
    email: authUser.email,
    name: displayName,
    avatar: profile?.avatar_path || authUser.user_metadata?.avatar_url || '',
    role: profile?.role || 'traveler'
  };
}

export function mapGuideProfile(profile = null) {
  if (!profile) return null;
  const [nativeLanguage = '', ...additionalLanguages] = profile.languages ?? [];
  return {
    id: profile.id,
    userId: profile.user_id,
    city: profile.city,
    nativeLanguage,
    additionalLanguages,
    intro: profile.intro,
    profilePhotoUrl: profile.profile_image_path || '',
    status: profile.status
  };
}

export function buildSignupDisplayName(firstName, lastName) {
  const cleanFirstName = firstName.trim();
  const cleanLastName = lastName.trim();

  if (!cleanFirstName || !cleanLastName) {
    throw new Error('First name and last name are required.');
  }

  return `${cleanFirstName} ${cleanLastName}`;
}

export function getAuthErrorMessage(error) {
  const message = error?.message || 'Email authentication failed.';

  if (/email not confirmed/i.test(message)) {
    return 'Please confirm your email before logging in.';
  }

  return message;
}

async function getProfile(client, userId) {
  const { data, error } = await client
    .from('profiles')
    .select('display_name, avatar_path, role')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function getGuideProfile(client, userId) {
  const { data, error } = await client
    .from('guide_profiles')
    .select('id, user_id, city, languages, intro, profile_image_path, status')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function signUpWithEmail(client, { email, password, displayName }) {
  const normalizedEmail = email.trim().toLowerCase();
  const cleanName = displayName.trim();
  const { data, error } = await client.auth.signUp({
    email: normalizedEmail,
    password,
    options: { data: { display_name: cleanName } }
  });

  if (error) throw error;
  if (!data.user) throw new Error('No user returned from signup.');

  const profilePayload = {
    id: data.user.id,
    email: normalizedEmail,
    display_name: cleanName,
    role: 'traveler'
  };

  if (!data.session) {
    return {
      user: mapAuthUser(data.user, profilePayload),
      requiresEmailConfirmation: true
    };
  }

  const { error: profileError } = await client.from('profiles').insert(profilePayload);
  if (profileError) throw profileError;

  return {
    user: mapAuthUser(data.user, profilePayload),
    requiresEmailConfirmation: false
  };
}

export async function signInWithEmail(client, { email, password }) {
  const normalizedEmail = email.trim().toLowerCase();
  const { data, error } = await client.auth.signInWithPassword({
    email: normalizedEmail,
    password
  });

  if (error) throw error;
  if (!data.user) throw new Error('No user returned from login.');

  const profile = await getProfile(client, data.user.id);
  const guideProfile = ['guide', 'admin'].includes(profile?.role) ? await getGuideProfile(client, data.user.id) : null;
  return { user: mapAuthUser(data.user, profile), guideProfile: mapGuideProfile(guideProfile) };
}

export async function fetchActiveGuideProfile(client, userId) {
  if (!userId) return null;
  return mapGuideProfile(await getGuideProfile(client, userId));
}

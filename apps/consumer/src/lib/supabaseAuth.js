import { createClient } from '@supabase/supabase-js';

const defaultSupabaseConfig = {
  url: 'https://qrabzkcibqaslealvdar.supabase.co',
  publishableKey: 'sb_publishable_QYusbitKD__5tfmQSLzNbg_Tb3wrVMa'
};

export function getSupabaseConfig(env = import.meta.env ?? {}) {
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

function cleanStorageFileName(name = 'avatar') {
  return String(name).replace(/[^a-zA-Z0-9._-]/g, '-');
}

function isRenderableAvatarUrl(value = '') {
  return /^(https?:|data:|blob:)/i.test(String(value));
}

function isPrivateGuideVerificationPath(value = '') {
  const path = String(value || '').trim();
  return Boolean(path && !isRenderableAvatarUrl(path) && (path.startsWith('guide-verification/') || path.includes('/guide-profile-')));
}

function encodeStoragePath(path = '') {
  return String(path)
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/');
}

export function resolvePublicStorageUrl(bucket, storagePath = '', env = import.meta.env ?? {}) {
  const path = String(storagePath || '').trim();
  if (!path || isRenderableAvatarUrl(path)) return path;
  const objectPath = path.startsWith(`${bucket}/`) ? path.slice(bucket.length + 1) : path;
  const config = getSupabaseConfig(env);
  if (!config.url) return path;
  return `${config.url.replace(/\/$/, '')}/storage/v1/object/public/${bucket}/${encodeStoragePath(objectPath)}`;
}

export function resolveAvatarUrl(client, avatarPath = '') {
  const path = String(avatarPath || '').trim();
  if (!path || isRenderableAvatarUrl(path)) return path;
  const objectPath = path.startsWith('avatars/') ? path.slice('avatars/'.length) : path;
  const result = client?.storage?.from?.('avatars')?.getPublicUrl?.(objectPath);
  return result?.data?.publicUrl || resolvePublicStorageUrl('avatars', path);
}

export function resolveGuideProfileImageUrl(client, profileImagePath = '', fallback = '') {
  const path = String(profileImagePath || '').trim();
  if (!path) return fallback;
  if (isPrivateGuideVerificationPath(path)) return fallback;
  if (isRenderableAvatarUrl(path)) return path;
  if (!path.startsWith('avatars/')) return fallback;
  return resolveAvatarUrl(client, path);
}

function resolveProfileAvatar(client, profile = null) {
  if (!profile?.avatar_path) return profile;
  return {
    ...profile,
    avatar_path: resolveAvatarUrl(client, profile.avatar_path)
  };
}

async function uploadSignupAvatar(client, { userId, avatarFile }) {
  if (!avatarFile?.size) return '';
  return uploadPublicAvatar(client, { userId, file: avatarFile, prefix: 'avatar' });
}

export async function uploadPublicAvatar(client, { userId, file, prefix = 'avatar', includeBucketPrefix = false }) {
  if (!file?.size) return '';
  const path = `${userId}/avatar-${Date.now()}-${cleanStorageFileName(file.name)}`.replace('/avatar-', `/${prefix}-`);
  const { error } = await client.storage
    .from('avatars')
    .upload(path, file, { upsert: true });
  if (error) throw error;
  return includeBucketPrefix ? `avatars/${path}` : path;
}

export function mapAuthUser(authUser, profile = null) {
  const displayName = profile?.display_name || authUser.user_metadata?.display_name || authUser.email?.split('@')[0] || 'Traveler';
  const isGuide = Boolean(profile?.is_guide || profile?.role === 'guide');
  const role = isGuide && profile?.role !== 'admin' ? 'guide' : profile?.role || 'traveler';

  return {
    id: authUser.id,
    email: authUser.email,
    name: displayName,
    avatar: profile?.avatar_path || authUser.user_metadata?.avatar_url || '',
    role,
    isGuide
  };
}

export function mapGuideProfile(profile = null) {
  if (!profile) return null;
  const [nativeLanguage = '', ...additionalLanguages] = profile.languages ?? [];
  const metadata = profile.metadata ?? {};
  return {
    id: profile.id,
    userId: profile.user_id,
    city: profile.city,
    nationality: profile.nationality || '',
    gender: profile.gender || '',
    birthYear: profile.birth_year || '',
    birthMonth: metadata.birthMonth || '',
    birthDay: metadata.birthDay || '',
    years: profile.residence_years ?? 0,
    nativeLanguage,
    additionalLanguages,
    languageLevels: metadata.languageLevels ?? {},
    intro: profile.intro,
    profilePhotoUrl: resolveGuideProfileImageUrl(null, profile.profile_image_path || ''),
    profilePhotoName: metadata.profilePhotoName || '',
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
    .select('display_name, avatar_path, role, is_guide')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function getGuideProfile(client, userId) {
  const { data, error } = await client
    .from('guide_profiles')
    .select('id, user_id, city, languages, intro, profile_image_path, status, nationality, gender, birth_year, residence_years, metadata')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function signUpWithEmail(client, { email, password, displayName, avatarFile = null }) {
  const normalizedEmail = email.trim().toLowerCase();
  const cleanName = displayName.trim();
  const { data, error } = await client.auth.signUp({
    email: normalizedEmail,
    password,
    options: { data: { display_name: cleanName } }
  });

  if (error) throw error;
  if (!data.user) throw new Error('No user returned from signup.');

  if (!data.session) {
    const pendingProfilePayload = {
      id: data.user.id,
      email: normalizedEmail,
      display_name: cleanName,
      role: 'traveler'
    };
    return {
      user: mapAuthUser(data.user, pendingProfilePayload),
      requiresEmailConfirmation: true
    };
  }

  const avatarPath = await uploadSignupAvatar(client, { userId: data.user.id, avatarFile });
  const profilePayload = {
    id: data.user.id,
    email: normalizedEmail,
    display_name: cleanName,
    role: 'traveler',
    ...(avatarPath ? { avatar_path: avatarPath } : {})
  };

  const { error: profileError } = await client.from('profiles').insert(profilePayload);
  if (profileError) throw profileError;

  return {
    user: mapAuthUser(data.user, resolveProfileAvatar(client, profilePayload)),
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

  const profile = resolveProfileAvatar(client, await getProfile(client, data.user.id));
  const guideProfile = (profile?.is_guide || ['guide', 'admin'].includes(profile?.role)) ? await getGuideProfile(client, data.user.id) : null;
  return { user: mapAuthUser(data.user, profile), guideProfile: mapGuideProfile(guideProfile) };
}

export async function fetchCurrentAuthState(client) {
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  if (!data?.user) return null;

  const profile = resolveProfileAvatar(client, await getProfile(client, data.user.id));
  const guideProfile = (profile?.is_guide || ['guide', 'admin'].includes(profile?.role)) ? await getGuideProfile(client, data.user.id) : null;
  return { user: mapAuthUser(data.user, profile), guideProfile: mapGuideProfile(guideProfile) };
}

export async function fetchActiveGuideProfile(client, userId) {
  if (!userId) return null;
  return mapGuideProfile(await getGuideProfile(client, userId));
}

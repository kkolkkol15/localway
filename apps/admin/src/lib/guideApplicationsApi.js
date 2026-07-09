const supabaseEnvKeys = {
  url: ['VITE_SUPABASE_URL'],
  key: ['VITE_SUPABASE_PUBLISHABLE_KEY', 'VITE_SUPABASE_ANON_KEY'],
  accessToken: ['VITE_SUPABASE_ACCESS_TOKEN'],
  adminAlias: ['VITE_ADMIN_LOGIN_ALIAS'],
  adminEmail: ['VITE_ADMIN_LOGIN_EMAIL']
};

const defaultSupabaseConfig = {
  url: 'https://qrabzkcibqaslealvdar.supabase.co',
  publishableKey: 'sb_publishable_QYusbitKD__5tfmQSLzNbg_Tb3wrVMa'
};

function readEnv(env, keys) {
  return keys.map((key) => env?.[key]).find(Boolean) || '';
}

function getImportEnv() {
  try {
    return import.meta.env;
  } catch {
    return {};
  }
}

function encodeFilterList(values) {
  return values.map((value) => `"${String(value).replaceAll('"', '\\"')}"`).join(',');
}

function indexBy(items, key) {
  return Object.fromEntries(items.filter((item) => item?.[key]).map((item) => [item[key], item]));
}

function groupBy(items, key) {
  return items.reduce((groups, item) => {
    const groupKey = item?.[key];
    if (!groupKey) return groups;
    return { ...groups, [groupKey]: [...(groups[groupKey] ?? []), item] };
  }, {});
}

export function getSupabaseAdminConfig(env = getImportEnv()) {
  const url = readEnv(env, supabaseEnvKeys.url) || defaultSupabaseConfig.url;
  const publishableKey = readEnv(env, supabaseEnvKeys.key) || defaultSupabaseConfig.publishableKey;
  const accessToken = readEnv(env, supabaseEnvKeys.accessToken);
  const adminAlias = readEnv(env, supabaseEnvKeys.adminAlias) || 'admin';
  const adminEmail = readEnv(env, supabaseEnvKeys.adminEmail) || 'admin@local-way.local';
  return {
    url,
    publishableKey,
    accessToken,
    adminAlias,
    adminEmail,
    isConfigured: Boolean(url && publishableKey)
  };
}

export function resolveAdminLoginEmail(identifier, config = getSupabaseAdminConfig()) {
  const value = String(identifier || '').trim().toLowerCase();
  if (!value) return '';
  if (value.includes('@')) return value;
  return value === String(config.adminAlias || 'admin').toLowerCase() ? config.adminEmail : value;
}

export function getReadableSupabaseAuthError(message) {
  try {
    const parsed = JSON.parse(message);
    if (parsed?.error_code === 'invalid_credentials') {
      return '관리자 계정 이메일 또는 비밀번호가 올바르지 않습니다. Supabase Auth에 존재하고 profiles.role이 admin인 계정으로 로그인하세요.';
    }
    return parsed?.msg || parsed?.message || message;
  } catch {
    if (/invalid login credentials/i.test(message)) {
      return '관리자 계정 이메일 또는 비밀번호가 올바르지 않습니다. Supabase Auth에 존재하고 profiles.role이 admin인 계정으로 로그인하세요.';
    }
    return message;
  }
}

export function createSupabaseRestClient(config = getSupabaseAdminConfig(), fetcher = fetch) {
  return {
    config,
    isConfigured: config.isConfigured,
    async request(table, { method = 'GET', query = '', body, prefer = 'return=representation' } = {}) {
      if (!config.isConfigured) return [];

      const response = await fetcher(`${config.url}/rest/v1/${table}${query}`, {
        method,
        headers: {
          apikey: config.publishableKey,
          Authorization: `Bearer ${config.accessToken || config.publishableKey}`,
          'Content-Type': 'application/json',
          Prefer: prefer
        },
        body: body ? JSON.stringify(body) : undefined
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `Supabase request failed with ${response.status}`);
      }

      if (response.status === 204) return [];
      return response.json();
    }
  };
}

export async function createGuideVerificationSignedUrl(client, path, expiresIn = 300) {
  if (!path) return '';
  if (!client?.isConfigured) return '';

  const response = await fetch(`${client.config.url}/storage/v1/object/sign/guide-verification/${encodeURI(path)}`, {
    method: 'POST',
    headers: {
      apikey: client.config.publishableKey,
      Authorization: `Bearer ${client.config.accessToken || client.config.publishableKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ expiresIn })
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Could not load guide verification image.');
  }

  const data = await response.json();
  if (!data?.signedURL) return '';
  return data.signedURL.startsWith('http')
    ? data.signedURL
    : `${client.config.url}/storage/v1${data.signedURL}`;
}

export async function signInAdminWithPassword({ email, password }, config = getSupabaseAdminConfig(), fetcher = fetch) {
  if (!config.isConfigured) {
    throw new Error('Supabase environment values are missing.');
  }

  const response = await fetcher(`${config.url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: config.publishableKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email: resolveAdminLoginEmail(email, config), password })
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(getReadableSupabaseAuthError(message || 'Admin login failed.'));
  }

  const session = await response.json();
  const client = createSupabaseRestClient({ ...config, accessToken: session.access_token }, fetcher);
  const profiles = await client.request('profiles', {
    query: `?select=id,email,display_name,role,status&id=eq.${session.user.id}`
  });
  const profile = profiles[0];

  if (profile?.status !== 'active') {
    throw new Error('This account is not active.');
  }

  if (profile?.role !== 'admin') {
    throw new Error('이 계정은 현재 admin 권한이 없습니다. profiles.role을 admin으로 복구한 뒤 로그인하세요.');
  }

  return {
    accessToken: session.access_token,
    user: {
      id: session.user.id,
      email: session.user.email,
      name: profile.display_name || session.user.email
    }
  };
}

export function normalizePendingGuideData({ applications = [], guideProfiles = [], tourDrafts = [] }) {
  const guideProfilesByUserId = indexBy(guideProfiles, 'user_id');
  const guideProfilesById = indexBy(guideProfiles, 'id');

  return {
    applications: applications.filter((application) => application.status === 'pending'),
    guideProfilesByUserId,
    guideProfilesById,
    tourDraftsByGuideId: groupBy(tourDrafts, 'guide_id')
  };
}

export async function fetchPendingGuideApplications(client = createSupabaseRestClient()) {
  if (!client.isConfigured) {
    return normalizePendingGuideData({});
  }

  const applications = await client.request('guide_applications', {
    query: '?select=*&status=eq.pending&order=submitted_at.desc'
  });
  const userIds = [...new Set(applications.map((application) => application.user_id).filter(Boolean))];
  if (!userIds.length) return normalizePendingGuideData({ applications });

  const guideProfiles = await client.request('guide_profiles', {
    query: `?select=*&user_id=in.(${encodeFilterList(userIds)})`
  });
  const guideIds = guideProfiles.map((profile) => profile.id).filter(Boolean);
  const tourDrafts = guideIds.length
    ? await client.request('guide_tour_drafts', { query: `?select=*&guide_id=in.(${encodeFilterList(guideIds)})&order=updated_at.desc` })
    : [];

  return normalizePendingGuideData({ applications, guideProfiles, tourDrafts });
}

export async function approveGuideApplication(client, application, reviewerId) {
  const reviewedAt = new Date().toISOString();
  await client.request('guide_profiles', {
    method: 'POST',
    query: '?on_conflict=user_id',
    prefer: 'resolution=merge-duplicates,return=representation',
    body: {
      user_id: application.user_id,
      display_name: application.real_name,
      city: application.city,
      languages: [application.native_language, ...(application.additional_languages ?? [])].filter(Boolean),
      intro: application.intro,
      profile_image_path: application.profile_image_path,
      status: 'active'
    }
  });

  const applicationUpdate = await client.request('guide_applications', {
    method: 'PATCH',
    query: `?id=eq.${application.id}`,
    body: { status: 'approved', reviewed_at: reviewedAt, reviewed_by: reviewerId || null, rejection_reason: null }
  });

  if (application.user_id !== reviewerId) {
    await client.request('profiles', {
      method: 'PATCH',
      query: `?id=eq.${application.user_id}`,
      body: { role: 'guide' }
    });
  }

  return applicationUpdate[0] ?? { ...application, status: 'approved', reviewed_at: reviewedAt };
}

export async function rejectGuideApplication(client, application, reason, reviewerId) {
  const reviewedAt = new Date().toISOString();
  const updated = await client.request('guide_applications', {
    method: 'PATCH',
    query: `?id=eq.${application.id}`,
    body: { status: 'rejected', rejection_reason: reason, reviewed_at: reviewedAt, reviewed_by: reviewerId || null }
  });

  return updated[0] ?? { ...application, status: 'rejected', rejection_reason: reason, reviewed_at: reviewedAt };
}

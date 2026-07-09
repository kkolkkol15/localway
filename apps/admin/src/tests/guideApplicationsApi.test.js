import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSupabaseRestClient,
  getReadableSupabaseAuthError,
  getSupabaseAdminConfig,
  normalizePendingGuideData,
  approveGuideApplication,
  createGuideVerificationSignedUrl,
  resolveAdminLoginEmail,
  signInAdminWithPassword
} from '../lib/guideApplicationsApi.js';

test('reads Supabase admin config from existing environment keys', () => {
  const config = getSupabaseAdminConfig({
    VITE_SUPABASE_URL: 'https://example.supabase.co',
    VITE_SUPABASE_PUBLISHABLE_KEY: 'publishable'
  });

  assert.equal(config.isConfigured, true);
  assert.equal(config.publishableKey, 'publishable');
  assert.equal(config.adminAlias, 'admin');
  assert.equal(config.adminEmail, 'admin@local-way.local');
});

test('falls back to public Supabase config for deployed builds without Vite env', () => {
  const config = getSupabaseAdminConfig({});

  assert.equal(config.isConfigured, true);
  assert.equal(config.url, 'https://qrabzkcibqaslealvdar.supabase.co');
  assert.equal(config.publishableKey, 'sb_publishable_QYusbitKD__5tfmQSLzNbg_Tb3wrVMa');
});

test('resolves admin login alias without storing a password in the app', () => {
  assert.equal(
    resolveAdminLoginEmail('admin', { adminAlias: 'admin', adminEmail: 'admin@local-way.local' }),
    'admin@local-way.local'
  );
  assert.equal(
    resolveAdminLoginEmail('operator@example.com', { adminAlias: 'admin', adminEmail: 'admin@local-way.local' }),
    'operator@example.com'
  );
});

test('maps Supabase invalid credentials to a readable admin login message', () => {
  const message = getReadableSupabaseAuthError('{"code":400,"error_code":"invalid_credentials","msg":"Invalid login credentials"}');

  assert.match(message, /관리자 계정 이메일 또는 비밀번호/);
  assert.match(message, /profiles.role/);
});

test('normalizes guide application related records across statuses', () => {
  const normalized = normalizePendingGuideData({
    applications: [
      { id: '00000000-0000-4000-8000-000000000001', user_id: '10000000-0000-4000-8000-000000000001', status: 'pending' },
      { id: '00000000-0000-4000-8000-000000000002', user_id: '10000000-0000-4000-8000-000000000002', status: 'approved' }
    ],
    guideProfiles: [{ id: '20000000-0000-4000-8000-000000000001', user_id: '10000000-0000-4000-8000-000000000001' }],
    tourDrafts: [{ id: '40000000-0000-4000-8000-000000000001', guide_id: '20000000-0000-4000-8000-000000000001', title: 'Draft' }]
  });

  assert.deepEqual(normalized.applications.map((item) => item.id), [
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002'
  ]);
  assert.equal(normalized.guideProfilesByUserId['10000000-0000-4000-8000-000000000001'].id, '20000000-0000-4000-8000-000000000001');
  assert.equal(normalized.tourDraftsByGuideId['20000000-0000-4000-8000-000000000001'][0].title, 'Draft');
});

test('Supabase REST client does not call fetch when backend is not configured', async () => {
  const client = createSupabaseRestClient({ isConfigured: false }, () => {
    throw new Error('fetch should not be called');
  });

  assert.deepEqual(await client.request('guide_applications'), []);
});

test('createGuideVerificationSignedUrl signs private guide verification paths', async () => {
  const calls = [];
  const client = createSupabaseRestClient({
    url: 'https://example.supabase.co',
    publishableKey: 'publishable',
    accessToken: 'admin-token',
    isConfigured: true
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    calls.push([url, options]);
    return {
      ok: true,
      json: async () => ({ signedURL: '/object/sign/guide-verification/user/profile.png?token=abc' })
    };
  };

  try {
    const url = await createGuideVerificationSignedUrl(client, 'user/profile.png');
    assert.equal(url, 'https://example.supabase.co/storage/v1/object/sign/guide-verification/user/profile.png?token=abc');
    assert.equal(calls[0][1].headers.Authorization, 'Bearer admin-token');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('approveGuideApplication creates the guide profile before changing the user role', async () => {
  const calls = [];
  const client = {
    request: async (table, options) => {
      calls.push([table, options.method, options.body]);
      return [{ id: '00000000-0000-4000-8000-000000000001', status: options.body?.status || 'active' }];
    }
  };

  await approveGuideApplication(client, {
    id: '00000000-0000-4000-8000-000000000001',
    user_id: '10000000-0000-4000-8000-000000000001',
    real_name: 'Applicant',
    city: 'Seoul',
    native_language: 'Korean',
    additional_languages: [],
    intro: 'Intro',
    profile_image_path: 'profile.jpg'
  }, '90000000-0000-4000-8000-000000000001');

  assert.deepEqual(calls.map(([table]) => table), ['guide_profiles', 'guide_applications', 'profiles']);
  assert.equal(calls[2][2].role, 'guide');
});

test('approveGuideApplication keeps admin role when an admin approves own guide application', async () => {
  const calls = [];
  const client = {
    request: async (table, options) => {
      calls.push([table, options.method, options.body]);
      return [{ id: '00000000-0000-4000-8000-000000000001', status: options.body?.status || 'active' }];
    }
  };

  await approveGuideApplication(client, {
    id: '00000000-0000-4000-8000-000000000001',
    user_id: '10000000-0000-4000-8000-000000000001',
    real_name: 'Applicant',
    city: 'Seoul',
    native_language: 'Korean',
    additional_languages: [],
    intro: 'Intro',
    profile_image_path: 'profile.jpg'
  }, '10000000-0000-4000-8000-000000000001');

  assert.deepEqual(calls.map(([table]) => table), ['guide_profiles', 'guide_applications']);
});

test('signInAdminWithPassword explains when the account lost admin permission', async () => {
  const fetcher = async (url) => {
    if (url.includes('/auth/v1/token')) {
      return {
        ok: true,
        json: async () => ({
          access_token: 'access-token',
          user: { id: '10000000-0000-4000-8000-000000000001', email: 'guide@example.com' }
        })
      };
    }
    return {
      ok: true,
      json: async () => [{ id: '10000000-0000-4000-8000-000000000001', email: 'guide@example.com', display_name: 'Guide', role: 'guide', status: 'active' }]
    };
  };

  await assert.rejects(
    () => signInAdminWithPassword(
      { email: 'guide@example.com', password: '1234' },
      { url: 'https://example.supabase.co', publishableKey: 'publishable', isConfigured: true },
      fetcher
    ),
    /admin 권한이 없습니다/
  );
});

test('signs in with Supabase and accepts only active admin profiles', async () => {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push([url, options]);
    if (url.includes('/auth/v1/token')) {
      return {
        ok: true,
        json: async () => ({
          access_token: 'admin-access-token',
          user: { id: '10000000-0000-4000-8000-000000000001', email: 'admin@example.com' }
        })
      };
    }
    return {
      ok: true,
      json: async () => [{ id: '10000000-0000-4000-8000-000000000001', email: 'admin@example.com', display_name: 'Admin', role: 'admin', status: 'active' }]
    };
  };

  const session = await signInAdminWithPassword(
    { email: 'admin', password: '1234' },
    { url: 'https://example.supabase.co', publishableKey: 'publishable', adminAlias: 'admin', adminEmail: 'admin@example.com', isConfigured: true },
    fetcher
  );

  assert.equal(session.accessToken, 'admin-access-token');
  assert.equal(session.user.name, 'Admin');
  assert.equal(JSON.parse(calls[0][1].body).email, 'admin@example.com');
  assert.equal(JSON.parse(calls[0][1].body).password, '1234');
  assert.equal(calls[1][1].headers.Authorization, 'Bearer admin-access-token');
});

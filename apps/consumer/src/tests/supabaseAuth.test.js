import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSignupDisplayName,
  buildSupabaseAuthOptions,
  fetchActiveGuideProfile,
  getAuthErrorMessage,
  getSupabaseConfig,
  mapAuthUser,
  mapGuideProfile,
  signInWithEmail,
  signUpWithEmail
} from '../lib/supabaseAuth.js';

test('getSupabaseConfig reports missing browser environment values', () => {
  assert.deepEqual(getSupabaseConfig({}), {
    url: '',
    publishableKey: '',
    isConfigured: false
  });
});

test('buildSupabaseAuthOptions keeps browser auth in session storage only', () => {
  const sessionStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  const options = buildSupabaseAuthOptions({ sessionStorage });

  assert.equal(options.auth.persistSession, true);
  assert.equal(options.auth.autoRefreshToken, true);
  assert.equal(options.auth.detectSessionInUrl, true);
  assert.equal(options.auth.storage, sessionStorage);
});

test('mapAuthUser prefers profile display name and role', () => {
  const user = mapAuthUser(
    { id: 'user-1', email: 'mina@example.com', user_metadata: { display_name: 'Metadata Name' } },
    { display_name: 'Mina Kim', avatar_path: 'avatars/user-1.jpg', role: 'guide' }
  );

  assert.deepEqual(user, {
    id: 'user-1',
    email: 'mina@example.com',
    name: 'Mina Kim',
    avatar: 'avatars/user-1.jpg',
    role: 'guide'
  });
});

test('mapGuideProfile keeps the approved guide profile id for tour publishing', () => {
  assert.deepEqual(mapGuideProfile({
    id: 'guide-profile-1',
    user_id: 'user-1',
    city: 'Seoul',
    languages: ['Korean', 'English'],
    intro: 'Intro',
    profile_image_path: 'profile.jpg',
    status: 'active'
  }), {
    id: 'guide-profile-1',
    userId: 'user-1',
    city: 'Seoul',
    nativeLanguage: 'Korean',
    additionalLanguages: ['English'],
    intro: 'Intro',
    profilePhotoUrl: 'profile.jpg',
    status: 'active'
  });
});

test('signInWithEmail returns active guide profile for approved guides', async () => {
  const calls = [];
  const makeQuery = (table) => {
    const builder = {
      eq: (...args) => {
        calls.push([table, ...args]);
        return builder;
      },
      maybeSingle: async () => ({
        data: table === 'profiles'
          ? { display_name: 'Mina', avatar_path: '', role: 'guide' }
          : { id: 'guide-profile-1', user_id: 'user-1', city: 'Seoul', languages: ['Korean'], intro: 'Intro', profile_image_path: '', status: 'active' },
        error: null
      })
    };
    return { select: () => builder };
  };
  const fakeClient = {
    auth: {
      signInWithPassword: async (payload) => ({
        data: { user: { id: 'user-1', email: payload.email, user_metadata: {} } },
        error: null
      })
    },
    from: (table) => makeQuery(table)
  };

  const result = await signInWithEmail(fakeClient, {
    email: 'mina@example.com',
    password: 'secret123'
  });

  assert.equal(result.user.role, 'guide');
  assert.equal(result.guideProfile.id, 'guide-profile-1');
  assert.deepEqual(calls.filter(([table]) => table === 'guide_profiles').map(([, column]) => column), ['user_id', 'status']);
});

test('signInWithEmail also returns guide profile for admin guide accounts', async () => {
  const makeQuery = (table) => {
    const builder = {
      eq: () => builder,
      maybeSingle: async () => ({
        data: table === 'profiles'
          ? { display_name: 'Admin Guide', avatar_path: '', role: 'admin' }
          : { id: 'guide-profile-1', user_id: 'user-1', city: 'Seoul', languages: ['Korean'], intro: 'Intro', profile_image_path: '', status: 'active' },
        error: null
      })
    };
    return { select: () => builder };
  };
  const fakeClient = {
    auth: {
      signInWithPassword: async (payload) => ({
        data: { user: { id: 'user-1', email: payload.email, user_metadata: {} } },
        error: null
      })
    },
    from: (table) => makeQuery(table)
  };

  const result = await signInWithEmail(fakeClient, {
    email: 'admin@example.com',
    password: 'secret123'
  });

  assert.equal(result.user.role, 'admin');
  assert.equal(result.guideProfile.id, 'guide-profile-1');
});

test('fetchActiveGuideProfile maps an active guide profile by user id', async () => {
  const calls = [];
  const builder = {
    eq: (...args) => {
      calls.push(args);
      return builder;
    },
    maybeSingle: async () => ({
      data: { id: 'guide-profile-1', user_id: 'user-1', city: 'Seoul', languages: ['Korean'], intro: 'Intro', profile_image_path: '', status: 'active' },
      error: null
    })
  };
  const fakeClient = {
    from: (table) => {
      assert.equal(table, 'guide_profiles');
      return { select: () => builder };
    }
  };

  const guideProfile = await fetchActiveGuideProfile(fakeClient, 'user-1');

  assert.equal(guideProfile.id, 'guide-profile-1');
  assert.deepEqual(calls, [['user_id', 'user-1'], ['status', 'active']]);
});


test('buildSignupDisplayName combines first and last name', () => {
  assert.equal(buildSignupDisplayName(' Mina ', ' Kim '), 'Mina Kim');
});

test('buildSignupDisplayName requires both first and last name', () => {
  assert.throws(
    () => buildSignupDisplayName('Mina', ''),
    /First name and last name are required/
  );
});

test('getAuthErrorMessage explains unconfirmed email login failures', () => {
  assert.equal(
    getAuthErrorMessage(new Error('Email not confirmed')),
    'Please confirm your email before logging in.'
  );
});

test('signUpWithEmail creates auth user and traveler profile', async () => {
  const calls = [];
  const fakeClient = {
    auth: {
      signUp: async (payload) => {
        calls.push(['signUp', payload]);
        return { data: { session: { access_token: 'token' }, user: { id: 'user-1', email: payload.email, user_metadata: payload.options.data } }, error: null };
      }
    },
    from: (table) => ({
      insert: async (payload) => {
        calls.push(['insert', table, payload]);
        return { error: null };
      },
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null })
        })
      })
    })
  };

  const result = await signUpWithEmail(fakeClient, {
    email: 'mina@example.com',
    password: 'secret123',
    displayName: 'Mina'
  });

  assert.equal(result.user.id, 'user-1');
  assert.deepEqual(calls[0], ['signUp', {
    email: 'mina@example.com',
    password: 'secret123',
    options: { data: { display_name: 'Mina' } }
  }]);
  assert.deepEqual(calls[1], ['insert', 'profiles', {
    id: 'user-1',
    email: 'mina@example.com',
    display_name: 'Mina',
    role: 'traveler'
  }]);
});

test('signUpWithEmail reports email confirmation when signup returns no session', async () => {
  const calls = [];
  const fakeClient = {
    auth: {
      signUp: async (payload) => {
        calls.push(['signUp', payload]);
        return { data: { session: null, user: { id: 'user-1', email: payload.email, user_metadata: payload.options.data } }, error: null };
      }
    },
    from: (table) => ({
      insert: async (payload) => {
        calls.push(['insert', table, payload]);
        return { error: null };
      }
    })
  };

  const result = await signUpWithEmail(fakeClient, {
    email: 'mina@example.com',
    password: 'secret123',
    displayName: 'Mina'
  });

  assert.equal(result.requiresEmailConfirmation, true);
  assert.equal(result.user.email, 'mina@example.com');
  assert.equal(calls.length, 1);
});

test('signInWithEmail returns mapped profile after password login', async () => {
  const fakeClient = {
    auth: {
      signInWithPassword: async (payload) => ({
        data: { user: { id: 'user-1', email: payload.email, user_metadata: {} } },
        error: null
      })
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { display_name: 'Mina', avatar_path: '', role: 'traveler' },
            error: null
          })
        })
      })
    })
  };

  const result = await signInWithEmail(fakeClient, {
    email: 'mina@example.com',
    password: 'secret123'
  });

  assert.deepEqual(result.user, {
    id: 'user-1',
    email: 'mina@example.com',
    name: 'Mina',
    avatar: '',
    role: 'traveler'
  });
});

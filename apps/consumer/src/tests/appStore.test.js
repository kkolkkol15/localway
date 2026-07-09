import test from 'node:test';
import assert from 'node:assert/strict';
import { getGuideModeOverview, getGuideModeSections } from '../lib/guideMode.js';
import { appReducer, createInitialState, formatRoleLabel, isRegisteredGuideRole, restorePersistentState, selectors, serializePersistentState, serializeSessionState } from '../state/appStore.js';

const signedInAction = {
  type: 'EMAIL_AUTH_SUCCESS',
  payload: {
    user: {
      id: 'user-1',
      email: 'mina@example.com',
      name: 'Mina',
      avatar: '',
      role: 'traveler'
    }
  }
};

test('email login creates a traveler and logout clears auth', () => {
  const state = createInitialState();
  const loggedIn = appReducer(state, signedInAction);
  assert.equal(loggedIn.auth.isAuthenticated, true);
  assert.equal(loggedIn.auth.user.role, 'traveler');
  assert.equal(loggedIn.auth.user.name.length > 0, true);

  const loggedOut = appReducer(loggedIn, { type: 'LOGOUT' });
  assert.equal(loggedOut.auth.isAuthenticated, false);
  assert.equal(loggedOut.auth.user, null);
});

test('email auth success stores the signed-in profile', () => {
  const state = createInitialState();
  const authed = appReducer(state, {
    type: 'EMAIL_AUTH_SUCCESS',
    payload: {
      user: {
        id: 'user-1',
        email: 'mina@example.com',
        displayName: 'Mina',
        avatar: '',
        role: 'traveler'
      }
    }
  });

  assert.equal(authed.auth.isAuthenticated, true);
  assert.equal(authed.auth.user.id, 'user-1');
  assert.equal(authed.auth.user.email, 'mina@example.com');
  assert.equal(authed.auth.user.name, 'Mina');
  assert.equal(authed.auth.user.role, 'traveler');
});

test('email auth success stores an approved guide profile when returned', () => {
  const authed = appReducer(createInitialState(), {
    type: 'EMAIL_AUTH_SUCCESS',
    payload: {
      user: { id: 'user-1', email: 'guide@example.com', name: 'Guide', avatar: '', role: 'guide' },
      guideProfile: { id: 'guide-profile-1', city: 'Seoul', status: 'active' }
    }
  });

  assert.equal(authed.auth.user.role, 'guide');
  assert.equal(authed.guideProfile.id, 'guide-profile-1');
});

test('set guide profile stores profile refreshed from database', () => {
  const next = appReducer(createInitialState(), {
    type: 'SET_GUIDE_PROFILE',
    payload: {
      guideProfile: { id: 'guide-profile-2', city: 'Busan', status: 'active' }
    }
  });

  assert.equal(next.guideProfile.id, 'guide-profile-2');
  assert.equal(next.guideProfile.status, 'active');
});

test('persistent state does not restore an authenticated browser session', () => {
  const state = appReducer(createInitialState(), signedInAction);
  const saved = serializePersistentState(state);
  const restored = restorePersistentState(saved);

  assert.equal(restored.auth.isAuthenticated, false);
  assert.equal(restored.auth.user, null);
  assert.equal(restored.auth.error, '');
});

test('session state restores auth for browser refresh only', () => {
  const state = appReducer(createInitialState(), signedInAction);
  const saved = serializePersistentState(state);
  const session = serializeSessionState(state);
  const restored = restorePersistentState(saved, createInitialState(), session);

  assert.equal(restored.auth.isAuthenticated, true);
  assert.equal(restored.auth.user.email, 'mina@example.com');
});

test('auth error keeps the visitor signed out and stores the message', () => {
  const state = createInitialState();
  const failed = appReducer(state, {
    type: 'AUTH_ERROR',
    payload: { message: 'Invalid login credentials' }
  });

  assert.equal(failed.auth.isAuthenticated, false);
  assert.equal(failed.auth.user, null);
  assert.equal(failed.auth.error, 'Invalid login credentials');
});

test('member profile update stores editable user fields', () => {
  let state = createInitialState();
  state = appReducer(state, signedInAction);
  state = appReducer(state, {
    type: 'UPDATE_USER_PROFILE',
    payload: { name: 'Mina Park', email: 'mina.park@example.com', phone: '+82 10', country: 'Korea', bio: 'Food traveler', avatar: 'data:image/png;base64,user' }
  });

  assert.equal(state.auth.user.name, 'Mina Park');
  assert.equal(state.auth.user.email, 'mina.park@example.com');
  assert.equal(state.auth.user.phone, '+82 10');
  assert.equal(state.auth.user.country, 'Korea');
  assert.equal(state.auth.user.bio, 'Food traveler');
  assert.equal(state.auth.user.avatar, 'data:image/png;base64,user');
});

test('account settings update stores preferences, notifications, and privacy choices', () => {
  let state = createInitialState();
  state = appReducer(state, {
    type: 'UPDATE_ACCOUNT_SETTINGS',
    payload: {
      preferences: { language: 'ko', currency: 'KRW', timezone: 'Asia/Seoul', distanceUnit: 'km' },
      notifications: { bookingEmail: false, messagePush: true, marketingEmail: false },
      privacy: { profileVisibility: 'verified', showReviews: false },
      security: { twoFactorEnabled: true }
    }
  });

  assert.equal(state.accountSettings.preferences.language, 'ko');
  assert.equal(state.accountSettings.preferences.currency, 'KRW');
  assert.equal(state.accountSettings.notifications.bookingEmail, false);
  assert.equal(state.accountSettings.notifications.messagePush, true);
  assert.equal(state.accountSettings.privacy.profileVisibility, 'verified');
  assert.equal(state.accountSettings.privacy.showReviews, false);
  assert.equal(state.accountSettings.security.twoFactorEnabled, true);
  assert.equal(state.currency, 'KRW');
});

test('bookmark toggle adds and removes a tour id', () => {
  let state = createInitialState();
  state = appReducer(state, signedInAction);
  state = appReducer(state, { type: 'TOGGLE_BOOKMARK', payload: { tourId: 'tour-tokyo-1' } });
  assert.deepEqual(state.bookmarks, ['tour-tokyo-1']);
  state = appReducer(state, { type: 'TOGGLE_BOOKMARK', payload: { tourId: 'tour-tokyo-1' } });
  assert.deepEqual(state.bookmarks, []);
});

test('mock payment creates booking and opens guide conversation', () => {
  let state = createInitialState();
  state = appReducer(state, signedInAction);
  state = appReducer(state, {
    type: 'PAY_NOW',
    payload: { tourId: 'tour-seoul-1', date: '2026-07-12', time: '10:00', guests: 2 }
  });

  assert.equal(state.bookings.length, 1);
  assert.equal(state.bookings[0].tourId, 'tour-seoul-1');
  assert.equal(state.conversations.length, 1);
  assert.match(state.conversations[0].messages[0].text, /chat with your guide/i);
});

test('guide registration submit makes user pending guide and stores profile', () => {
  let state = createInitialState();
  state = appReducer(state, signedInAction);
  state = appReducer(state, {
    type: 'SUBMIT_GUIDE_APPLICATION',
    payload: { city: 'Seoul', nationality: 'Korea', intro: 'I love hidden alleys.', profilePhotoUrl: 'data:image/png;base64,abc' }
  });

  assert.equal(state.auth.user.role, 'pending-guide');
  assert.equal(state.auth.user.avatar, 'data:image/png;base64,abc');
  assert.equal(selectors.guideProfile(state).city, 'Seoul');
  assert.equal(selectors.guideProfile(state).profilePhotoUrl, 'data:image/png;base64,abc');
});

test('guide registration draft stores the latest saved form values', () => {
  let state = createInitialState();
  state = appReducer(state, {
    type: 'SAVE_GUIDE_DRAFT',
    payload: { type: 'guide-registration', city: 'Seoul', profilePhotoName: 'old.jpg' }
  });
  state = appReducer(state, {
    type: 'SAVE_GUIDE_DRAFT',
    payload: { type: 'guide-registration', city: 'Busan', profilePhotoName: 'new.jpg' }
  });

  assert.equal(state.drafts.length, 1);
  assert.equal(selectors.guideRegistrationDraft(state).city, 'Busan');
  assert.equal(selectors.guideRegistrationDraft(state).profilePhotoName, 'new.jpg');
});

test('tour draft stores the latest saved tour form and can be selected again', () => {
  let state = createInitialState();
  state = appReducer(state, {
    type: 'SAVE_GUIDE_DRAFT',
    payload: { id: 'tour-draft-1', type: 'tour-draft', title: 'Night market walk', currency: 'USD' }
  });
  state = appReducer(state, {
    type: 'SAVE_GUIDE_DRAFT',
    payload: { id: 'tour-draft-1', type: 'tour-draft', title: 'Updated night market walk', currency: 'KRW' }
  });

  assert.equal(state.drafts.filter((draft) => draft.type === 'tour-draft').length, 1);
  assert.equal(selectors.guideTourDrafts(state)[0].title, 'Updated night market walk');
  assert.equal(selectors.guideTourDraft(state, 'tour-draft-1').currency, 'KRW');
});

test('guide profile update stores guide fields and syncs avatar', () => {
  let state = createInitialState();
  state = appReducer(state, signedInAction);
  state = appReducer(state, {
    type: 'SUBMIT_GUIDE_APPLICATION',
    payload: { city: 'Seoul', profilePhotoUrl: 'data:image/png;base64,old' }
  });
  state = appReducer(state, {
    type: 'UPDATE_GUIDE_PROFILE',
    payload: {
      city: 'Busan',
      years: '4',
      nativeLanguage: '한국어',
      additionalLanguages: ['한국어', '영어'],
      profilePhotoUrl: 'data:image/png;base64,new'
    }
  });

  assert.equal(selectors.guideProfile(state).city, 'Busan');
  assert.equal(selectors.guideProfile(state).years, '4');
  assert.deepEqual(selectors.guideProfile(state).additionalLanguages, ['한국어', '영어']);
  assert.equal(state.auth.user.avatar, 'data:image/png;base64,new');
});

test('registered guide roles hide the guide application shortcut', () => {
  assert.equal(isRegisteredGuideRole('guide'), true);
  assert.equal(isRegisteredGuideRole('pending-guide'), true);
  assert.equal(isRegisteredGuideRole('traveler'), false);
});

test('formatRoleLabel makes pending guide status readable', () => {
  assert.equal(formatRoleLabel('pending-guide'), 'Pending guide');
  assert.equal(formatRoleLabel('guide'), 'Guide');
  assert.equal(formatRoleLabel('traveler'), 'Traveler');
});

test('guide unavailable dates are merged and kept sorted without duplicates', () => {
  let state = createInitialState();
  state = appReducer(state, {
    type: 'ADD_GUIDE_UNAVAILABLE_DATES',
    payload: { dates: ['2026-07-12', '2026-07-10', '2026-07-12'] }
  });
  state = appReducer(state, {
    type: 'ADD_GUIDE_UNAVAILABLE_DATES',
    payload: { dates: ['2026-07-11'] }
  });

  assert.deepEqual(state.guideUnavailableDates, ['2026-07-10', '2026-07-11', '2026-07-12']);
});

test('guide mode sections include the core guide operations', () => {
  const labels = getGuideModeSections().map((section) => section.label);

  assert.deepEqual(labels.slice(0, 6), ['My Tours', 'Create New Tour', 'Saved Drafts', 'Calendar & Availability', 'Booking Requests', 'Messages']);
  assert.equal(labels.includes('Earnings'), true);
  assert.equal(labels.includes('Payments & Payouts'), true);
  assert.equal(labels.includes('Policy Center'), true);
  assert.equal(labels.includes('Donation'), true);
});

test('guide mode overview summarizes active guide work', () => {
  const overview = getGuideModeOverview({
    bookings: [
      { status: 'reserved', amount: 50 },
      { status: 'completed', amount: 80 }
    ],
    drafts: [{ id: 'draft-1' }],
    unavailableDates: ['2026-07-10', '2026-07-11'],
    reviewsWritten: [{ id: 'review-1' }]
  });

  assert.equal(overview.upcomingTrips, 1);
  assert.equal(overview.savedDrafts, 1);
  assert.equal(overview.unavailableDates, 2);
  assert.equal(overview.reviews, 1);
  assert.equal(overview.estimatedEarnings, 80);
});

test('currency selection updates the active currency', () => {
  const state = createInitialState();
  const updated = appReducer(state, {
    type: 'SET_CURRENCY',
    payload: { currency: 'KRW' }
  });

  assert.equal(updated.currency, 'KRW');
});

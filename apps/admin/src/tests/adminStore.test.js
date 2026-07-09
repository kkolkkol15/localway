import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, adminReducer, selectors } from '../state/adminStore.js';

test('starts with empty admin data', () => {
  const state = createInitialState();
  assert.deepEqual(state.guideApplications, []);
  assert.deepEqual(state.travelers, []);
  assert.deepEqual(state.guides, []);
  assert.deepEqual(state.tours, []);
  assert.deepEqual(state.reservations, []);
});

test('stores a real admin auth session after Supabase login succeeds', () => {
  const state = createInitialState();
  const loggedIn = adminReducer(state, {
    type: 'LOGIN_SUCCESS',
    payload: {
      accessToken: 'token',
      user: { id: '10000000-0000-4000-8000-000000000001', name: 'Admin' }
    }
  });
  assert.equal(loggedIn.auth.isAuthenticated, true);
  assert.equal(loggedIn.auth.accessToken, 'token');
  assert.equal(loggedIn.auth.admin.name, 'Admin');

  const failed = adminReducer(loggedIn, {
    type: 'LOGIN_ERROR',
    payload: { message: 'No admin permission.' }
  });
  assert.equal(failed.auth.isAuthenticated, false);
  assert.equal(failed.auth.error, 'No admin permission.');
});

test('loads pending guide applications and updates approval decisions', () => {
  let state = createInitialState();
  state = adminReducer(state, {
    type: 'LOAD_GUIDE_APPLICATIONS_SUCCESS',
    payload: {
      applications: [
        { id: 'application-1', status: 'pending' },
        { id: 'application-2', status: 'pending' }
      ],
      guideProfilesByUserId: {},
      guideProfilesById: {},
      tourDraftsByGuideId: {}
    }
  });

  const approved = adminReducer(state, {
    type: 'APPROVE_GUIDE',
    payload: { id: 'application-1' }
  });
  assert.equal(selectors.guideApplication(approved, 'application-1').status, 'approved');

  const rejected = adminReducer(approved, {
    type: 'REJECT_GUIDE',
    payload: { id: 'application-2', reason: '서류가 흐릿합니다.' }
  });
  const request = selectors.guideApplication(rejected, 'application-2');
  assert.equal(request.status, 'rejected');
  assert.equal(request.rejection_reason, '서류가 흐릿합니다.');
});

test('creates admin-authored notices and messages without initial data', () => {
  let state = createInitialState();
  state = adminReducer(state, {
    type: 'CREATE_NOTICE',
    payload: { title: '가이드 정책 업데이트', content: '새 정책 안내', isPublic: true }
  });
  assert.equal(state.notices[0].title, '가이드 정책 업데이트');

  state = adminReducer(state, {
    type: 'SEND_MESSAGE',
    payload: { target: '전체 가이드', title: '성수기 안내', body: '예약 가능 시간을 확인해주세요.' }
  });
  assert.equal(state.messageLogs[0].target, '전체 가이드');
});

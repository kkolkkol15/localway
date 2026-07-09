import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildNoticeRow,
  buildPlatformSettingRow,
  buildSupportReplyPatch,
  fetchAdminMembers,
  updateTourStatus
} from '../lib/adminDataApi.js';

test('buildNoticeRow validates and maps notice form input', () => {
  assert.deepEqual(buildNoticeRow({
    adminId: 'admin-1',
    payload: { title: 'Hello', content: 'Body', isPublic: true }
  }), {
    title: 'Hello',
    content: 'Body',
    is_public: true,
    created_by: 'admin-1'
  });

  assert.throws(() => buildNoticeRow({ adminId: 'admin-1', payload: { title: '', content: '' } }), /title and content/i);
});

test('buildSupportReplyPatch stores admin reply and closes the ticket', () => {
  assert.deepEqual(buildSupportReplyPatch('Done'), {
    admin_reply: 'Done',
    status: 'closed'
  });
});

test('buildPlatformSettingRow maps admin settings groups', () => {
  assert.deepEqual(buildPlatformSettingRow({ group: 'languages', name: 'Korean' }), {
    group_key: 'languages',
    name: 'Korean',
    active: true,
    sort_order: 0
  });
});

test('fetchAdminMembers loads profiles and guide profiles together', async () => {
  const calls = [];
  const client = {
    request: async (table, options) => {
      calls.push([table, options.query]);
      if (table === 'profiles') return [{ id: 'user-1', display_name: 'Mina', email: 'm@example.com', role: 'traveler', status: 'active' }];
      if (table === 'guide_profiles') return [{ id: 'guide-1', user_id: 'user-2', display_name: 'Guide', city: 'Seoul', status: 'active' }];
      return [];
    }
  };

  const result = await fetchAdminMembers(client);

  assert.equal(result.travelers[0].name, 'Mina');
  assert.equal(result.guides[0].city, 'Seoul');
  assert.deepEqual(calls.map(([table]) => table), ['profiles', 'guide_profiles']);
});

test('updateTourStatus patches an existing tour status', async () => {
  const calls = [];
  const client = {
    request: async (table, options) => {
      calls.push([table, options]);
      return [{ id: 'tour-1', status: 'paused' }];
    }
  };

  const result = await updateTourStatus(client, { tourId: 'tour-1', status: 'paused' });

  assert.equal(result.status, 'paused');
  assert.equal(calls[0][0], 'tours');
  assert.equal(calls[0][1].method, 'PATCH');
  assert.deepEqual(calls[0][1].body, { status: 'paused' });
});

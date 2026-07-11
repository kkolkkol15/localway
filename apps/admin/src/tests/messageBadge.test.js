import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatUnreadBadge,
  getUnreadInsertEffect,
  normalizeUnreadCount
} from '../lib/messageBadge.js';

test('formatUnreadBadge hides zero and caps large unread counts', () => {
  assert.equal(formatUnreadBadge(0), '');
  assert.equal(formatUnreadBadge(1), '1');
  assert.equal(formatUnreadBadge(99), '99');
  assert.equal(formatUnreadBadge(100), '99+');
});

test('getUnreadInsertEffect increments only unread messages outside the open conversation', () => {
  assert.deepEqual(getUnreadInsertEffect({
    currentCount: 2,
    message: { conversation_id: 'conversation-1', sender_id: 'admin-1' },
    currentUserId: 'admin-1',
    activeConversationId: ''
  }), { nextCount: 2, shouldMarkRead: false });

  assert.deepEqual(getUnreadInsertEffect({
    currentCount: 2,
    message: { conversation_id: 'conversation-1', sender_id: 'member-1' },
    currentUserId: 'admin-1',
    activeConversationId: 'conversation-1'
  }), { nextCount: 2, shouldMarkRead: true });

  assert.deepEqual(getUnreadInsertEffect({
    currentCount: 2,
    message: { conversation_id: 'conversation-2', sender_id: 'member-1' },
    currentUserId: 'admin-1',
    activeConversationId: 'conversation-1'
  }), { nextCount: 3, shouldMarkRead: false });
});

test('normalizeUnreadCount keeps unread totals non-negative integers', () => {
  assert.equal(normalizeUnreadCount('7'), 7);
  assert.equal(normalizeUnreadCount(-1), 0);
  assert.equal(normalizeUnreadCount(undefined), 0);
});

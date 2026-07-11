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

test('getUnreadInsertEffect ignores own messages and marks open conversations read', () => {
  assert.deepEqual(getUnreadInsertEffect({
    currentCount: 4,
    message: { conversation_id: 'conversation-1', sender_id: 'user-1' },
    currentUserId: 'user-1',
    activeConversationId: ''
  }), { nextCount: 4, shouldMarkRead: false });

  assert.deepEqual(getUnreadInsertEffect({
    currentCount: 4,
    message: { conversation_id: 'conversation-1', sender_id: 'admin-1' },
    currentUserId: 'user-1',
    activeConversationId: 'conversation-1'
  }), { nextCount: 4, shouldMarkRead: true });

  assert.deepEqual(getUnreadInsertEffect({
    currentCount: 4,
    message: { conversation_id: 'conversation-2', sender_id: 'admin-1' },
    currentUserId: 'user-1',
    activeConversationId: 'conversation-1'
  }), { nextCount: 5, shouldMarkRead: false });
});

test('normalizeUnreadCount keeps unread totals non-negative integers', () => {
  assert.equal(normalizeUnreadCount('8'), 8);
  assert.equal(normalizeUnreadCount(-3), 0);
  assert.equal(normalizeUnreadCount(Number.NaN), 0);
});

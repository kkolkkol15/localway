export function normalizeUnreadCount(value) {
  const count = Number(value);
  if (!Number.isFinite(count)) return 0;
  return Math.max(0, Math.trunc(count));
}

export function formatUnreadBadge(count) {
  const normalized = normalizeUnreadCount(count);
  if (normalized <= 0) return '';
  return normalized > 99 ? '99+' : String(normalized);
}

export function getUnreadInsertEffect({
  currentCount,
  message = {},
  currentUserId = '',
  activeConversationId = ''
} = {}) {
  const count = normalizeUnreadCount(currentCount);
  if (!message.conversation_id || !message.sender_id || message.sender_id === currentUserId) {
    return { nextCount: count, shouldMarkRead: false };
  }
  if (activeConversationId && message.conversation_id === activeConversationId) {
    return { nextCount: count, shouldMarkRead: true };
  }
  return { nextCount: count + 1, shouldMarkRead: false };
}

export function subtractUnreadCount(currentCount, readCount) {
  return normalizeUnreadCount(currentCount) - Math.min(normalizeUnreadCount(currentCount), normalizeUnreadCount(readCount));
}

export async function fetchUnreadMessageCount(client) {
  const { data, error } = await client.rpc('get_unread_message_count');
  if (error) throw error;
  return normalizeUnreadCount(data);
}

export async function markConversationRead(client, conversationId) {
  if (!conversationId) return 0;
  const { data, error } = await client.rpc('mark_conversation_read', { p_conversation_id: conversationId });
  if (error) throw error;
  return normalizeUnreadCount(data);
}

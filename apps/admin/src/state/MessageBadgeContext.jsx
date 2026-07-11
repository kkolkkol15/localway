import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getSupabaseAdminConfig } from '../lib/guideApplicationsApi.js';
import { createAdminSupabaseClient } from '../lib/adminSupabase.js';
import {
  fetchUnreadMessageCount,
  getUnreadInsertEffect,
  markConversationRead as markConversationReadRpc,
  subtractUnreadCount
} from '../lib/messageBadge.js';
import { useAdmin } from './AdminContext.jsx';

const MessageBadgeContext = createContext(null);

export function MessageBadgeProvider({ children }) {
  const { state } = useAdmin();
  const userId = state.auth.admin?.id || '';
  const [unreadCount, setUnreadCount] = useState(0);
  const activeConversationIdRef = useRef('');
  const clientRef = useRef(null);

  const refreshUnreadCount = useCallback(async (client = clientRef.current) => {
    if (!client || !userId) {
      setUnreadCount(0);
      return 0;
    }
    const count = await fetchUnreadMessageCount(client);
    setUnreadCount(count);
    return count;
  }, [userId]);

  const markConversationRead = useCallback(async (conversationId) => {
    if (!conversationId || !clientRef.current || !userId) return 0;
    const readCount = await markConversationReadRpc(clientRef.current, conversationId);
    setUnreadCount((count) => subtractUnreadCount(count, readCount));
    return readCount;
  }, [userId]);

  const setActiveConversationId = useCallback((conversationId = '') => {
    activeConversationIdRef.current = conversationId;
  }, []);

  useEffect(() => {
    let disposed = false;
    let channel = null;

    async function connect() {
      const config = { ...getSupabaseAdminConfig(), accessToken: state.auth.accessToken };
      if (!userId || !state.auth.isAuthenticated || !config.isConfigured || !config.accessToken) {
        clientRef.current = null;
        setUnreadCount(0);
        return;
      }

      const client = createAdminSupabaseClient(config);
      if (disposed) return;
      clientRef.current = client;
      await refreshUnreadCount(client);

      channel = client
        .channel(`admin-message-badge-${userId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversation_messages' }, async (payload) => {
          const effect = getUnreadInsertEffect({
            currentCount: 0,
            message: payload.new,
            currentUserId: userId,
            activeConversationId: activeConversationIdRef.current
          });
          if (effect.shouldMarkRead) {
            await markConversationRead(payload.new.conversation_id);
            return;
          }
          setUnreadCount((count) => getUnreadInsertEffect({
            currentCount: count,
            message: payload.new,
            currentUserId: userId,
            activeConversationId: activeConversationIdRef.current
          }).nextCount);
        })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversation_participants',
          filter: `user_id=eq.${userId}`
        }, () => {
          refreshUnreadCount(client).catch(() => {});
        })
        .subscribe();
    }

    connect().catch(() => {
      if (!disposed) setUnreadCount(0);
    });

    return () => {
      disposed = true;
      activeConversationIdRef.current = '';
      if (clientRef.current && channel) clientRef.current.removeChannel(channel);
      clientRef.current = null;
    };
  }, [markConversationRead, refreshUnreadCount, state.auth.accessToken, state.auth.isAuthenticated, userId]);

  const value = useMemo(() => ({
    unreadCount,
    refreshUnreadCount,
    markConversationRead,
    setActiveConversationId
  }), [markConversationRead, refreshUnreadCount, setActiveConversationId, unreadCount]);

  return <MessageBadgeContext.Provider value={value}>{children}</MessageBadgeContext.Provider>;
}

export function useMessageBadge() {
  const context = useContext(MessageBadgeContext);
  if (!context) throw new Error('useMessageBadge must be used inside MessageBadgeProvider');
  return context;
}

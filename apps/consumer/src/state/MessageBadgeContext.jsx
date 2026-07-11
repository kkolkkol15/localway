import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getSupabaseConfig, createBrowserSupabaseClient } from '../lib/supabaseAuth.js';
import {
  fetchUnreadMessageCount,
  getUnreadInsertEffect,
  markConversationRead as markConversationReadRpc,
  subtractUnreadCount
} from '../lib/messageBadge.js';
import { useAppState } from './AppContext.jsx';

const MessageBadgeContext = createContext(null);

export function MessageBadgeProvider({ children }) {
  const { state } = useAppState();
  const userId = state.auth.user?.id || '';
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
    if (!conversationId || conversationId.startsWith('mock-') || !clientRef.current || !userId) return 0;
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
      if (!userId || !state.auth.isAuthenticated || !getSupabaseConfig().isConfigured) {
        clientRef.current = null;
        setUnreadCount(0);
        return;
      }

      const client = await createBrowserSupabaseClient();
      if (disposed) return;
      clientRef.current = client;
      await refreshUnreadCount(client);

      channel = client
        .channel(`message-badge-${userId}`)
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
  }, [markConversationRead, refreshUnreadCount, state.auth.isAuthenticated, userId]);

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

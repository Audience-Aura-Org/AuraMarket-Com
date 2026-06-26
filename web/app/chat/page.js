"use client";

import { useEffect, Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/hooks/useAuth';
import { toId, useChat } from '@/context/ChatContext';
import { peekPendingPushIntentForVendor } from '@/lib/native-push';
import api from '@/services/api';
import MessagingHub from '@/components/hub/MessagingHub';

function chatExitHref(role) {
  if (role === 'vendor') return '/vendor/dashboard';
  if (role === 'admin') return '/admin/dashboard';
  if (role === 'logistics') return '/logistics/dashboard';
  return '/shop';
}

const derivePartnerFromMessages = (messages, partnerId, currentUserId) => {
  const targetId = partnerId?.toString?.();
  const selfId = currentUserId?.toString?.();
  if (!targetId) return null;

  for (const message of messages || []) {
    for (const participant of [message?.sender_id, message?.receiver_id]) {
      if (!participant || typeof participant !== 'object') continue;
      const participantId = toId(participant);
      if (participantId === targetId && participantId !== selfId) {
        if (participant.name || participant.username || participant.avatar || participant.store_name || participant.branding?.store_name) {
          return participant;
        }
      }
    }
  }
  return null;
};

function ChatContent() {
  const { user, loading: authLoading } = useAuthStore();
  const {
    initialPartnerData,
    notificationTitle: contextNotificationTitle,
    conversations,
    setActiveConversation,
  } = useChat();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [prefetchedPartner, setPrefetchedPartner] = useState(null);

  const vendorId = searchParams.get('vendorId');
  const urlNotificationTitle = searchParams.get('notificationTitle');
  const pendingNotificationTitle = useMemo(
    () => peekPendingPushIntentForVendor(vendorId),
    [vendorId]
  );

  const cachedPartner = useMemo(() => {
    if (!vendorId) return null;
    const match = conversations.find((conversation) => toId(conversation?.partner) === vendorId);
    return match?.partner || null;
  }, [conversations, vendorId]);

  const contextInitialData = useMemo(() => {
    if (!vendorId || !initialPartnerData) return null;
    const partnerId = initialPartnerData._id?.toString?.() || initialPartnerData._id;
    return partnerId?.toString?.() === vendorId.toString() ? initialPartnerData : null;
  }, [vendorId, initialPartnerData]);

  const initialData = prefetchedPartner || cachedPartner || contextInitialData;

  const notificationTitle =
    contextNotificationTitle ||
    urlNotificationTitle ||
    pendingNotificationTitle ||
    null;

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?from=chat');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!vendorId) return;
    setActiveConversation(vendorId, initialData || null, notificationTitle || undefined);
  }, [vendorId, initialData, notificationTitle, setActiveConversation]);

  const hasSeedPartner = Boolean(
    initialData?.name ||
    initialData?.store_name ||
    initialData?.branding?.store_name ||
    notificationTitle
  );

  useEffect(() => {
    if (!vendorId || !user?._id) {
      setPrefetchedPartner(null);
      return;
    }

    if (hasSeedPartner) return;

    let cancelled = false;
    const currentUserId = user._id.toString();

    const prefetchPartnerProfile = async () => {
      const [profileRes, chatRes] = await Promise.all([
        api.get(`/auth/users/${vendorId}`).catch(() => null),
        api.get(`/chat/${vendorId}?page=1&limit=30`).catch(() => null),
      ]);

      if (cancelled) return;

      if (profileRes?.data?.success) {
        const profile = profileRes.data.data?.user || profileRes.data.user;
        if (profile) {
          setPrefetchedPartner(profile);
          setActiveConversation(vendorId, profile);
          return;
        }
      }

      const derived = derivePartnerFromMessages(
        chatRes?.data?.data?.messages,
        vendorId,
        currentUserId
      );
      if (derived) {
        setPrefetchedPartner(derived);
        setActiveConversation(vendorId, derived);
      }
    };

    prefetchPartnerProfile();
    return () => {
      cancelled = true;
    };
  }, [vendorId, user?._id, setActiveConversation, hasSeedPartner]);

  if (!vendorId && authLoading) return null;
  if (!authLoading && !user) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden' }}>
      <MessagingHub
        vendorId={vendorId}
        initialData={initialData}
        notificationTitle={notificationTitle}
        fullPage={true}
        onClose={() => router.push(chatExitHref(user?.role))}
      />
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      <ChatContent />
    </Suspense>
  );
}

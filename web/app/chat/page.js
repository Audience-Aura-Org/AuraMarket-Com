"use client";

import { useEffect, Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/hooks/useAuth';
import { useChat } from '@/context/ChatContext';
import { peekPendingPushIntentForVendor } from '@/lib/native-push';
import MessagingHub from '@/components/hub/MessagingHub';

function chatExitHref(role) {
  if (role === 'vendor') return '/vendor/dashboard';
  if (role === 'admin') return '/admin/dashboard';
  if (role === 'logistics') return '/logistics/dashboard';
  return '/shop';
}

function ChatContent() {
  const { user, loading: authLoading } = useAuthStore();
  const { initialPartnerData, notificationTitle: contextNotificationTitle } = useChat();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const vendorId = searchParams.get('vendorId');
  const urlNotificationTitle = searchParams.get('notificationTitle');
  const pendingNotificationTitle = useMemo(
    () => peekPendingPushIntentForVendor(vendorId),
    [vendorId]
  );
  const initialData = useMemo(() => {
    if (!vendorId || !initialPartnerData) return null;
    const partnerId = initialPartnerData._id?.toString?.() || initialPartnerData._id;
    return partnerId?.toString?.() === vendorId.toString() ? initialPartnerData : null;
  }, [vendorId, initialPartnerData]);
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

  if (authLoading) return null;
  if (!user) return null;

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

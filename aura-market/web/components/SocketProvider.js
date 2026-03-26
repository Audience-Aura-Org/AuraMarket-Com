"use client";

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import socketService from '@/services/socket';
import { useAuthStore } from '@/hooks/useAuth';
import { MessageCircle, Bell, X } from 'lucide-react';

export default function SocketProvider({ children }) {
  const { user } = useAuthStore();
  const router = useRouter();
  const [toast, setToast] = useState(null);           // chat message toast
  const [notifToast, setNotifToast] = useState(null); // notification toast
  const toastTimerRef = useRef(null);
  const notifTimerRef = useRef(null);
  const connectedUserId = useRef(null);

  useEffect(() => {
    if (!user?._id) return;

    // Connect once per user session — never disconnect while browsing
    if (connectedUserId.current !== user._id) {
      socketService.connect(user._id);
      connectedUserId.current = user._id;
    }

    const handleNewMessage = (msg) => {
      console.log('[SocketProvider] receive_message fired:', msg);
      if (window.location.pathname.startsWith('/chat')) return;
      const senderName = msg.sender_id?.name || 'Aura User';
      const text = msg.text || (msg.product_reference ? '📦 Shared a product' : 'Sent you a message');
      setToast({ id: msg._id || Date.now(), sender: senderName, text });
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setToast(null), 6000);
    };

    const handleNotification = (notif) => {
      console.log('[SocketProvider] notification fired:', notif);
      setNotifToast({
        id: notif._id || Date.now(),
        title: notif.title || 'Notification',
        message: notif.message || '',
        link: notif.metadata?.link || '/notifications',
      });
      if (notifTimerRef.current) clearTimeout(notifTimerRef.current);
      notifTimerRef.current = setTimeout(() => setNotifToast(null), 7000);
    };

    socketService.on('receive_message', handleNewMessage);
    socketService.on('notification', handleNotification);
    console.log('[SocketProvider] Listening for receive_message & notification');

    return () => {
      socketService.off('receive_message', handleNewMessage);
      socketService.off('notification', handleNotification);
      // Do NOT disconnect here — socket must stay alive while user navigates
    };
  }, [user?._id]);

  // Disconnect only on logout
  useEffect(() => {
    if (!user) {
      socketService.disconnect();
      connectedUserId.current = null;
    }
  }, [user]);

  return (
    <>
      {children}

      {/* Global Chat Message Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-[9999] max-w-[320px] w-full"
          style={{ animation: 'slideInFromTop 0.3s ease-out' }}>
          <style>{`
            @keyframes slideInFromTop {
              from { opacity: 0; transform: translateY(-12px); }
              to   { opacity: 1; transform: translateY(0); }
            }
          `}</style>
          <div
            onClick={() => { router.push('/chat'); setToast(null); }}
            className="bg-[var(--bg-primary)] backdrop-blur-2xl border border-[var(--glass-border)] rounded-2xl p-4 shadow-2xl flex items-start gap-3 cursor-pointer hover:border-[var(--accent)]/50 transition-all group"
            style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.05)' }}
          >
            <div className="size-10 rounded-full bg-[var(--accent)]/15 flex items-center justify-center shrink-0 border border-[var(--accent)]/25 group-hover:scale-110 transition-transform">
              <MessageCircle className="size-5 text-[var(--accent)]" />
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <p className="text-[9px] font-black uppercase tracking-widest text-[var(--accent)] mb-1 leading-none">New Message</p>
              <p className="text-sm font-bold text-[var(--text-primary)] truncate leading-tight">{toast.sender}</p>
              <p className="text-xs text-[var(--text-secondary)] truncate mt-0.5 leading-snug">{toast.text}</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setToast(null); }}
              className="p-1 rounded-full hover:bg-[var(--glass-border)] text-[var(--text-secondary)] transition-colors opacity-60 hover:opacity-100 shrink-0"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Global Notification Toast — stacks below message toast if both visible */}
      {notifToast && (
        <div className={`fixed z-[9998] max-w-[320px] w-full right-6 ${toast ? 'top-24' : 'top-6'}`}
          style={{ animation: 'slideInFromTop 0.3s ease-out' }}>
          <div
            onClick={() => { router.push(notifToast.link); setNotifToast(null); }}
            className="bg-[var(--bg-primary)] backdrop-blur-2xl border border-[var(--glass-border)] rounded-2xl p-4 shadow-2xl flex items-start gap-3 cursor-pointer hover:border-amber-500/50 transition-all group"
            style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.05)' }}
          >
            <div className="size-10 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0 border border-amber-500/25 group-hover:scale-110 transition-transform">
              <Bell className="size-5 text-amber-500" />
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <p className="text-[9px] font-black uppercase tracking-widest text-amber-500 mb-1 leading-none">Notification</p>
              <p className="text-sm font-bold text-[var(--text-primary)] truncate leading-tight">{notifToast.title}</p>
              <p className="text-xs text-[var(--text-secondary)] truncate mt-0.5 leading-snug">{notifToast.message}</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setNotifToast(null); }}
              className="p-1 rounded-full hover:bg-[var(--glass-border)] text-[var(--text-secondary)] transition-colors opacity-60 hover:opacity-100 shrink-0"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

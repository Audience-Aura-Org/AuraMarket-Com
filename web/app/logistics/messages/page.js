"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  MessageCircle, RefreshCw, Inbox, LayoutDashboard, List, MapPin,
  Send, ChevronDown, Package, Clock, Truck, ArrowLeft, Loader2, User,
} from "lucide-react";
import api from "@/services/api";
import { useAuthStore } from "@/hooks/useAuth";
import { useChat } from "@/context/ChatContext";
import { useNotifications } from "@/hooks/useNotifications";
import StatCard from "@/components/layout/StatCard";
import {
  LogisticsSubpageHeader,
  LogisticsShortcutsRow,
} from "@/components/logistics/LogisticsSubpageShell";

const STATUS_COLORS = {
  pending: 'bg-amber-500/10 text-amber-600', assigned: 'bg-blue-500/10 text-blue-600',
  picked_up: 'bg-indigo-500/10 text-indigo-600', in_transit: 'bg-blue-500/10 text-blue-600',
  out_for_delivery: 'bg-violet-500/10 text-violet-600', delivered: 'bg-emerald-500/10 text-emerald-600',
  failed: 'bg-rose-500/10 text-rose-600', cancelled: 'bg-gray-500/10 text-gray-600',
};

export default function LogisticsMessagesHubPage() {
  const user = useAuthStore((s) => s.user);
  const { openChat } = useChat();
  const { unreadMessages, unreadCount, refresh: refreshNotifications } = useNotifications();
  const [loading, setLoading] = useState(true);
  const [inboxCount, setInboxCount] = useState(0);
  const [balance, setBalance] = useState(0);
  const [threads, setThreads] = useState([]);
  const [activeThread, setActiveThread] = useState(null);
  const [messageInput, setMessageInput] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [tab, setTab] = useState('shipment'); // 'shipment' | 'chat'
  const messagesEndRef = useRef(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [chatRes, walletRes, msgRes] = await Promise.allSettled([
        api.get("/chat"),
        api.get("/wallet"),
        api.get("/messages/logistics/all"),
      ]);
      if (chatRes.status === 'fulfilled' && chatRes.value.data.success) {
        const chats = chatRes.value.data.data?.activeChats || [];
        setInboxCount(chats.length);
      }
      if (walletRes.status === 'fulfilled' && walletRes.value.data.success) {
        setBalance(walletRes.value.data.data?.balance ?? 0);
      }
      if (msgRes.status === 'fulfilled' && msgRes.value.data.success) {
        setThreads(msgRes.value.data.data?.threads || []);
      }
      refreshNotifications?.();
    } catch { /* non-fatal */ }
    finally { setLoading(false); }
  }, [refreshNotifications]);

  useEffect(() => {
    if (!user || user.role !== "logistics") return;
    load();
  }, [user, load]);

  // Refresh active thread messages
  const refreshThread = useCallback(async (shipmentId) => {
    try {
      const res = await api.get(`/messages/shipment/${shipmentId}`);
      if (res.data?.success) {
        setActiveThread(prev => prev ? { ...prev, messages: res.data.data?.messages || [] } : null);
        // Also update in threads list
        setThreads(prev => prev.map(t =>
          t.shipment._id === shipmentId
            ? { ...t, messages: res.data.data?.messages || [] }
            : t
        ));
      }
    } catch {}
  }, []);

  const sendMessage = async () => {
    if (!messageInput.trim() || !activeThread) return;
    setSendingMsg(true);
    try {
      const res = await api.post(`/messages/shipment/${activeThread.shipment._id}`, { text: messageInput.trim() });
      if (res.data?.success) {
        setMessageInput('');
        const newMsg = res.data.data.message;
        setActiveThread(prev => ({ ...prev, messages: [...(prev.messages || []), newMsg] }));
        setThreads(prev => prev.map(t =>
          t.shipment._id === activeThread.shipment._id
            ? { ...t, messages: [...(t.messages || []), newMsg], lastMessage: newMsg }
            : t
        ));
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      }
    } catch {}
    finally { setSendingMsg(false); }
  };

  // Auto-refresh active thread
  useEffect(() => {
    if (!activeThread) return;
    const iv = setInterval(() => refreshThread(activeThread.shipment._id), 15000);
    return () => clearInterval(iv);
  }, [activeThread, refreshThread]);

  if (user?.role !== "logistics") return null;

  const addr = (a) => [a?.street, a?.quartier, a?.city].filter(Boolean).join(', ');

  return (
    <div className="flex w-full min-w-0 flex-col bg-[var(--bg-primary)] pb-[max(6rem,env(safe-area-inset-bottom,1.25rem))] text-[var(--text-primary)] lg:pb-12">
      <LogisticsSubpageHeader
        Icon={MessageCircle}
        title="Message"
        accentTitle="hub"
        tag="Relay comms"
        hint="Shipment messages and chat inbox. Tap a thread to view and reply."
        actions={
          <button type="button" onClick={() => load()}
            className="flex size-11 min-h-[2.75rem] min-w-[2.75rem] touch-manipulation items-center justify-center rounded-xl border border-[var(--glass-border)] text-[var(--text-secondary)] transition hover:bg-white/5">
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        }
      />

      <div className="w-full min-w-0 space-y-6 px-3 py-5 sm:space-y-8 sm:px-5 sm:py-6 md:px-8 md:py-8">
        {(() => {
          const totalInbox = inboxCount || 1;
          const unreadPct = Math.min(Math.round((unreadMessages / totalInbox) * 100), 100);
          const signalPct = Math.min(unreadCount * 10, 100);
          return (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
              <StatCard label="Shipment threads" value={String(threads.length)} sub="Active conversations" icon="forum" color="indigo" progress={100} footer={`${threads.length} threads`} />
              <StatCard label="Unread chats" value={String(unreadMessages)} sub="Needs attention" icon="mark_chat_unread" color="primary" progress={unreadPct} footer={unreadMessages > 0 ? `${unreadMessages} unread` : 'All caught up'} />
              <StatCard label="Signals" value={String(unreadCount)} sub="In-app alerts" icon="notifications" color="amber" progress={signalPct} footer={unreadCount > 0 ? `${unreadCount} pending` : 'No new alerts'} />
              <StatCard label="Wallet" value={`${balance.toLocaleString()} XAF`} sub="Balance" icon="account_balance_wallet" color="purple" href="/logistics/wallet" footer="Tap to manage funds" />
            </div>
          );
        })()}

        <LogisticsShortcutsRow
          links={[
            { label: "Dashboard", sub: "Ops overview", href: "/logistics/dashboard", icon: LayoutDashboard },
            { label: "Manifests", sub: "Shipment ledger", href: "/logistics/manifests", icon: List },
            { label: "Live tracking", sub: "Status stream", href: "/logistics/tracking", icon: MapPin },
          ]}
        />

        {/* Tabs */}
        <div className="flex items-center gap-1 rounded-xl bg-[var(--bg-secondary)]/50 p-1 border border-[var(--glass-border)]/30">
          <button
            onClick={() => { setTab('shipment'); setActiveThread(null); }}
            className={`flex-1 rounded-lg py-2.5 text-[11px] font-bold tracking-tight transition-all ${
              tab === 'shipment' ? 'bg-[var(--accent)] text-white shadow-sm' : 'text-[var(--text-secondary)]'
            }`}
          >
            <div className="flex items-center justify-center gap-1.5">
              <Package className="size-3.5" />
              Shipment Messages
              {threads.length > 0 && tab !== 'shipment' && <span className="size-4 rounded-full bg-[var(--accent)]/20 text-[var(--accent)] text-[9px] font-bold flex items-center justify-center">{threads.length}</span>}
            </div>
          </button>
          <button
            onClick={() => { setTab('chat'); setActiveThread(null); }}
            className={`flex-1 rounded-lg py-2.5 text-[11px] font-bold tracking-tight transition-all ${
              tab === 'chat' ? 'bg-[var(--accent)] text-white shadow-sm' : 'text-[var(--text-secondary)]'
            }`}
          >
            <div className="flex items-center justify-center gap-1.5">
              <Inbox className="size-3.5" />
              Chat Inbox
              {unreadMessages > 0 && tab !== 'chat' && <span className="size-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">{unreadMessages}</span>}
            </div>
          </button>
        </div>

        {/* Shipment Messages Tab */}
        {tab === 'shipment' && (
          <section className="rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/10 overflow-hidden">
            {activeThread ? (
              /* ── Active Thread View ── */
              <div className="flex flex-col" style={{ minHeight: '400px' }}>
                {/* Thread header */}
                <div className="flex items-center gap-3 p-4 border-b border-[var(--glass-border)]/30">
                  <button onClick={() => setActiveThread(null)} className="size-9 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)]/50 flex items-center justify-center text-[var(--text-secondary)] active:scale-95 shrink-0">
                    <ArrowLeft className="size-4" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-xs font-bold text-[var(--accent)]">{activeThread.shipment.tracking_code}</p>
                    <p className="text-[10px] text-[var(--text-secondary)]/50 truncate">
                      {addr(activeThread.shipment.pickup_address)} → {addr(activeThread.shipment.delivery_address)}
                    </p>
                  </div>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md capitalize ${STATUS_COLORS[activeThread.shipment.status] || ''}`}>
                    {activeThread.shipment.status?.replace(/_/g, ' ')}
                  </span>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2.5 max-h-[400px]">
                  {activeThread.messages?.length === 0 ? (
                    <p className="text-[11px] text-[var(--text-secondary)]/40 text-center py-10">No messages yet</p>
                  ) : activeThread.messages?.map((msg, i) => {
                    const isMe = msg.sender_role === 'logistics';
                    return (
                      <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-2xl p-3 ${
                          isMe
                            ? 'bg-[var(--accent)]/10 border border-[var(--accent)]/20 rounded-br-md'
                            : 'bg-[var(--bg-primary)] border border-[var(--glass-border)]/30 rounded-bl-md'
                        }`}>
                          <div className="flex items-center gap-2 mb-1">
                            <p className={`text-[10px] font-bold ${isMe ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}>
                              {msg.sender_name || 'Unknown'}
                            </p>
                            <span className="text-[8px] text-[var(--text-secondary)]/30 capitalize">{msg.sender_role}</span>
                          </div>
                          <p className="text-[11px] text-[var(--text-primary)] leading-relaxed break-words">{msg.text}</p>
                          <p className="text-[8px] text-[var(--text-secondary)]/30 mt-1 text-right">{new Date(msg.timestamp).toLocaleString()}</p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-4 border-t border-[var(--glass-border)]/30 flex gap-2">
                  <input
                    value={messageInput}
                    onChange={e => setMessageInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
                    placeholder="Type a message..."
                    className="flex-1 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] px-3 py-2.5 text-xs outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 placeholder:text-[var(--text-secondary)]/30"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!messageInput.trim() || sendingMsg}
                    className="size-10 shrink-0 rounded-xl bg-[var(--accent)] text-white disabled:opacity-30 flex items-center justify-center active:scale-95 transition-all"
                  >
                    {sendingMsg ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                  </button>
                </div>
              </div>
            ) : (
              /* ── Thread List ── */
              <div>
                <div className="border-b border-[var(--glass-border)] px-4 py-4 md:px-6">
                  <p className="text-xs font-bold text-[var(--text-primary)]">Shipment Conversations</p>
                  <p className="text-[10px] text-[var(--text-secondary)]/50 mt-0.5">{threads.length} active thread{threads.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="p-3 md:p-4">
                  {loading ? (
                    <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-[var(--accent)] opacity-50" /></div>
                  ) : threads.length === 0 ? (
                    <div className="py-16 text-center">
                      <MessageCircle className="size-8 mx-auto mb-3 text-[var(--text-secondary)]/20" />
                      <p className="text-xs text-[var(--text-secondary)]/50">No shipment messages yet</p>
                      <p className="text-[10px] text-[var(--text-secondary)]/30 mt-1">Messages will appear here when customers or recipients send messages on their shipments</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {threads.map((thread) => {
                        const s = thread.shipment;
                        const lastMsg = thread.lastMessage;
                        return (
                          <button
                            key={s._id}
                            onClick={() => { setActiveThread(thread); refreshThread(s._id); }}
                            className="w-full text-left rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/50 p-4 transition hover:border-[var(--accent)]/30 active:scale-[0.99]"
                          >
                            <div className="flex items-start gap-3">
                              <div className="size-10 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] shrink-0">
                                <Package className="size-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="font-mono text-[11px] font-bold text-[var(--accent)]">{s.tracking_code}</p>
                                  <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-md capitalize shrink-0 ${STATUS_COLORS[s.status] || ''}`}>
                                    {s.status?.replace(/_/g, ' ')}
                                  </span>
                                </div>
                                <p className="text-[10px] text-[var(--text-secondary)]/50 mt-0.5 truncate">
                                  {addr(s.pickup_address)} → {addr(s.delivery_address)}
                                </p>
                                {lastMsg && (
                                  <div className="mt-1.5 flex items-center gap-1.5">
                                    <User className="size-2.5 text-[var(--text-secondary)]/30 shrink-0" />
                                    <p className="text-[10px] text-[var(--text-secondary)] truncate">
                                      <span className="font-semibold">{lastMsg.sender_name}:</span> {lastMsg.text}
                                    </p>
                                  </div>
                                )}
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[9px] text-[var(--text-secondary)]/30">{thread.messages?.length || 0} messages</span>
                                  {lastMsg && <span className="text-[9px] text-[var(--text-secondary)]/30">{new Date(lastMsg.timestamp).toLocaleDateString()}</span>}
                                </div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Chat Tab */}
        {tab === 'chat' && (
          <section className="rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/10 p-4 sm:p-6 md:p-10">
            <h2 className="text-sm font-bold tracking-tight md:text-base">Open messaging</h2>
            <p className="mt-2 max-w-xl text-[11px] leading-relaxed text-[var(--text-secondary)] opacity-85 md:text-[12px]">
              Use the same chat overlay as the rest of Auradime. Your session stays inside the logistics workspace so you can jump back to manifests or tracking anytime.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={() => openChat(null, null, null, false)}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] px-8 py-3 text-[11px] font-semibold uppercase tracking-wide text-white shadow-lg shadow-[var(--accent)]/25 transition hover:opacity-95 active:scale-[0.99]"
              >
                <Inbox className="size-4" />
                Open message overlay
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

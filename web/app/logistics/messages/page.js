"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import {
  MessageCircle,
  RefreshCw,
  Inbox,
  LayoutDashboard,
  List,
  MapPin,
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

export default function LogisticsMessagesHubPage() {
  const user = useAuthStore((s) => s.user);
  const { openChat } = useChat();
  const { unreadMessages, unreadCount, refresh: refreshNotifications } =
    useNotifications();
  const [loading, setLoading] = useState(true);
  const [inboxCount, setInboxCount] = useState(0);
  const [balance, setBalance] = useState(0);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [chatRes, walletRes] = await Promise.all([
        api.get("/chat"),
        api.get("/wallet"),
      ]);
      if (chatRes.data.success) {
        const chats = chatRes.data.data?.activeChats || [];
        setInboxCount(chats.length);
      }
      if (walletRes.data.success) {
        setBalance(walletRes.data.data?.balance ?? 0);
      }
      refreshNotifications?.();
    } catch {
      /* non-fatal */
    } finally {
      setLoading(false);
    }
  }, [refreshNotifications]);

  useEffect(() => {
    if (!user || user.role !== "logistics") return;
    load();
  }, [user, load]);

  if (user?.role !== "logistics") return null;

  return (
    <div className="flex w-full min-w-0 flex-col bg-[var(--bg-primary)] pb-[max(6rem,env(safe-area-inset-bottom,1.25rem))] text-[var(--text-primary)] lg:pb-12">
      <LogisticsSubpageHeader
        Icon={MessageCircle}
        title="Message"
        accentTitle="hub"
        tag="Relay comms"
        hint="Open the inbox overlay to reply to vendors and customers. Wallet payouts for completed deliveries stay unchanged."
        actions={
          <button
            type="button"
            onClick={() => load()}
            className="flex size-11 min-h-[2.75rem] min-w-[2.75rem] touch-manipulation items-center justify-center rounded-xl border border-[var(--glass-border)] text-[var(--text-secondary)] transition hover:bg-white/5"
            aria-label="Refresh"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        }
      />

      <div className="mx-auto w-full min-w-0 max-w-[1600px] space-y-6 px-3 py-5 sm:space-y-8 sm:px-5 sm:py-6 md:px-8 md:py-8">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          <StatCard
            label="Unread chats"
            value={String(unreadMessages)}
            sub="Needs attention"
            icon="mark_chat_unread"
            color="indigo"
          />
          <StatCard
            label="Inbox threads"
            value={String(inboxCount)}
            sub="Active partners"
            icon="forum"
            color="primary"
          />
          <StatCard
            label="Signals"
            value={String(unreadCount)}
            sub="In-app alerts"
            icon="notifications"
            color="amber"
          />
          <StatCard
            label="Wallet"
            value={`${balance.toLocaleString()} XAF`}
            sub="Balance"
            icon="account_balance_wallet"
            color="purple"
            href="/wallet"
          />
        </div>

        <LogisticsShortcutsRow
          links={[
            {
              label: "Dashboard",
              sub: "Ops overview",
              href: "/logistics/dashboard",
              icon: LayoutDashboard,
            },
            {
              label: "Manifests",
              sub: "Shipment ledger",
              href: "/logistics/manifests",
              icon: List,
            },
            {
              label: "Live tracking",
              sub: "Status stream",
              href: "/logistics/tracking",
              icon: MapPin,
            },
          ]}
        />

        <section className="rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/10 p-4 sm:p-6 md:p-10">
          <h2 className="text-lg font-bold tracking-tight md:text-xl">
            Open messaging
          </h2>
          <p className="mt-2 max-w-xl text-[11px] leading-relaxed text-[var(--text-secondary)] opacity-85 md:text-[12px]">
            Use the same chat overlay as the rest of Auradime. Your session
            stays inside the logistics workspace so you can jump back to
            manifests or tracking anytime.
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
      </div>
    </div>
  );
}

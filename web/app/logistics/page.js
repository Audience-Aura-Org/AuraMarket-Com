"use client";

import { useEffect, useState } from "react";
import {
  Truck,
  LayoutDashboard,
  MapPin,
  MessageCircle,
  Network,
  LineChart,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/hooks/useAuth";
import {
  LogisticsSubpageHeader,
  LogisticsShortcutsRow,
} from "@/components/logistics/LogisticsSubpageShell";

export default function GlobalLogisticsPage() {
  const [mounted, setMounted] = useState(false);
  const user = useAuthStore((s) => s.user);
  const router = useRouter();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted || !user) return;
    if (user.role === "logistics") {
      router.replace("/logistics/dashboard");
    }
  }, [mounted, user, router]);

  if (!mounted) return null;

  if (user?.role === "logistics") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-[var(--bg-secondary)]">
        <p className="text-[12px] font-medium text-[var(--text-secondary)]">
          Opening logistics dashboard…
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)] px-[max(1rem,env(safe-area-inset-left))] py-8 pb-[max(2.5rem,env(safe-area-inset-bottom))] pr-[max(1rem,env(safe-area-inset-right))] text-[var(--text-primary)] transition-all md:px-12 pt-14 md:pt-8">
      <div className="mx-auto max-w-[960px] space-y-10">
        <LogisticsSubpageHeader
          Icon={Truck}
          title="Aura"
          accentTitle="logistics"
          tag="Fulfillment network"
          hint="Partners manage manifests, tracking, and route pricing from the dashboard. Sign in with a logistics account to continue."
        />

        <LogisticsShortcutsRow
          links={[
            {
              label: "Partner dashboard",
              sub: "Sign in required",
              href: "/logistics/dashboard",
              icon: LayoutDashboard,
            },
            {
              label: "Live tracking",
              sub: "Public info",
              href: "/logistics/tracking",
              icon: MapPin,
            },
            {
              label: "Route pricing",
              sub: "Partner tools",
              href: "/logistics/pricing",
              icon: LineChart,
            },
          ]}
        />

        <div className="rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/60 p-6 md:p-8">
          <h2 className="text-lg font-bold tracking-tight">Get started</h2>
          <p className="mt-2 max-w-lg text-[12px] leading-relaxed text-[var(--text-secondary)] opacity-85">
            Vendors choose logistics at checkout; your firm receives shipment
            tickets, updates statuses, and gets paid the shipping fee when
            delivery completes on partner-managed orders.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              href="/login?from=logistics"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] px-6 py-2.5 text-[11px] font-semibold text-white shadow-lg shadow-[var(--accent)]/20 transition hover:opacity-95"
            >
              Partner sign in <ChevronRight className="size-4" />
            </Link>
            <Link
              href="/shop"
              className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-6 py-2.5 text-[11px] font-semibold transition hover:border-[var(--accent)]/30"
            >
              Browse marketplace
            </Link>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/logistics/messages"
            className="flex items-center gap-3 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 p-4 transition hover:border-[var(--accent)]/30"
          >
            <MessageCircle className="size-5 text-[var(--accent)]" />
            <div>
              <p className="text-[12px] font-bold">Message hub</p>
              <p className="text-[10px] font-medium text-[var(--text-secondary)] opacity-60">
                After sign-in — relay comms
              </p>
            </div>
          </Link>
          <Link
            href="/logistics/nodes"
            className="flex items-center gap-3 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 p-4 transition hover:border-[var(--accent)]/30"
          >
            <Network className="size-5 text-[var(--accent)]" />
            <div>
              <p className="text-[12px] font-bold">Relay nodes</p>
              <p className="text-[10px] font-medium text-[var(--text-secondary)] opacity-60">
                Zone registry
              </p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}

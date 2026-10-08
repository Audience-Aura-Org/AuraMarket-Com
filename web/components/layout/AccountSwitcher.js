"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useManagerMode } from "@/hooks/useManagerMode";
import { useAuthStore } from "@/hooks/useAuth";

/**
 * AccountSwitcher — dropdown in the manager sidebar showing assigned
 * accounts. Uses the new useManagerMode store.
 */
export default function AccountSwitcher({ accent = "#3b82f6" }) {
  const { user } = useAuthStore();
  const { accounts, loading, loaded, error, loadAccounts } = useManagerMode();

  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (user?.role === "manager" && !loaded) {
      loadAccounts();
    }
  }, [user?.role, loaded, loadAccounts]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (user?.role !== "manager") return null;

  const count = accounts.length;

  return (
    <div ref={ref} className="relative px-4 py-3 border-b border-[var(--glass-border)]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[var(--accent)]/5 transition-all text-left"
      >
        <span
          className="material-symbols-outlined text-lg"
          style={{ color: accent }}
        >
          switch_account
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold tracking-tight text-[var(--text-secondary)] uppercase">
            Accounts
          </p>
          <p className="text-[12px] font-semibold text-[var(--text-primary)] truncate">
            {loading && !count ? "Loading..." : `${count} assigned`}
          </p>
        </div>
        <span className="material-symbols-outlined text-base text-[var(--text-secondary)]">
          {open ? "expand_less" : "expand_more"}
        </span>
      </button>

      {open && (
        <div className="absolute left-3 right-3 top-full mt-1 bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-xl shadow-xl z-[300] max-h-[280px] overflow-y-auto no-scrollbar">
          {accounts.map((account) => (
            <Link
              key={account.id}
              href={`/manager/as/${account.id}/dashboard`}
              onClick={() => setOpen(false)}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-left transition-all hover:bg-[var(--accent)]/5"
            >
              <span
                className="material-symbols-outlined text-base text-[var(--text-secondary)]"
              >
                {account.role === "vendor"
                  ? "store"
                  : account.role === "logistics"
                  ? "local_shipping"
                  : "person"}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold tracking-tight text-[var(--text-secondary)] truncate">
                  {account.name}
                </p>
                {account.email && (
                  <p className="text-[10px] text-[var(--text-secondary)] opacity-60 truncate">
                    {account.email}
                  </p>
                )}
              </div>
              <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-[var(--glass-border)]/30 text-[var(--text-secondary)] uppercase">
                {account.role}
              </span>
            </Link>
          ))}

          {!loading && count === 0 && (
            <div className="px-3 py-4 text-center">
              <p className="text-[11px] text-[var(--text-secondary)] opacity-60">
                {error || "No accounts assigned yet"}
              </p>
              {error && (
                <button
                  onClick={() => loadAccounts({ force: true })}
                  className="mt-2 text-[10px] font-semibold text-blue-400 hover:text-blue-300"
                >
                  Retry
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, useRef } from "react";
import { useManagerScope } from "@/hooks/useManagerScope";
import { useAuthStore } from "@/hooks/useAuth";

/**
 * AccountSwitcher — dropdown for managers to pick which
 * assigned account to focus on (or view all).
 *
 * Renders inside the RoleSidebar for the manager role.
 */
export default function AccountSwitcher({ accent = "#3b82f6" }) {
  const { user } = useAuthStore();
  const {
    assignments,
    activeAccountId,
    setActiveAccount,
    fetchPortfolio,
    loading,
  } = useManagerScope();

  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Fetch portfolio on mount (only for managers)
  useEffect(() => {
    if (user?.role === "manager") {
      fetchPortfolio();
    }
  }, [user?.role, fetchPortfolio]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (user?.role !== "manager") return null;

  // Build display list from assignments
  const accounts = assignments
    .filter((a) => a.status === "active")
    .map((a) => {
      const u = a.user_id;
      const id = u?._id || u;
      const name = u?.name || u?.email || String(id).slice(-6);
      const email = u?.email || "";
      const role = u?.role || "";
      return { id, name, email, role, level: a.access_level };
    });

  const active = accounts.find((a) => a.id === activeAccountId);
  const label = active ? active.name : "All Accounts";

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
            Scope
          </p>
          <p className="text-[12px] font-semibold text-[var(--text-primary)] truncate">
            {loading && !accounts.length ? "Loading..." : label}
          </p>
        </div>
        <span className="material-symbols-outlined text-base text-[var(--text-secondary)]">
          {open ? "expand_less" : "expand_more"}
        </span>
      </button>

      {open && (
        <div className="absolute left-3 right-3 top-full mt-1 bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-xl shadow-xl z-[300] max-h-[280px] overflow-y-auto no-scrollbar">
          {/* All Accounts option */}
          <button
            onClick={() => {
              setActiveAccount(null);
              setOpen(false);
            }}
            className={`w-full flex items-center gap-2 px-3 py-2.5 text-left transition-all ${
              !activeAccountId
                ? "bg-[var(--accent)]/10"
                : "hover:bg-[var(--accent)]/5"
            }`}
          >
            <span
              className="material-symbols-outlined text-base"
              style={{ color: !activeAccountId ? accent : "var(--text-secondary)" }}
            >
              groups
            </span>
            <span
              className={`text-[12px] font-semibold tracking-tight flex-1 ${
                !activeAccountId
                  ? "text-[var(--text-primary)]"
                  : "text-[var(--text-secondary)]"
              }`}
            >
              All Accounts
            </span>
            {!activeAccountId && (
              <span
                className="material-symbols-outlined text-sm"
                style={{ color: accent }}
              >
                check
              </span>
            )}
          </button>

          {accounts.length > 0 && (
            <div className="border-t border-[var(--glass-border)]" />
          )}

          {accounts.map((account) => {
            const isActive = activeAccountId === account.id;
            return (
              <button
                key={account.id}
                onClick={() => {
                  setActiveAccount(account.id);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2.5 text-left transition-all ${
                  isActive
                    ? "bg-[var(--accent)]/10"
                    : "hover:bg-[var(--accent)]/5"
                }`}
              >
                <span
                  className="material-symbols-outlined text-base"
                  style={{ color: isActive ? accent : "var(--text-secondary)" }}
                >
                  {account.role === "vendor"
                    ? "store"
                    : account.role === "logistics"
                    ? "local_shipping"
                    : "person"}
                </span>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-[12px] font-semibold tracking-tight truncate ${
                      isActive
                        ? "text-[var(--text-primary)]"
                        : "text-[var(--text-secondary)]"
                    }`}
                  >
                    {account.name}
                  </p>
                  {account.email && (
                    <p className="text-[10px] text-[var(--text-secondary)] opacity-60 truncate">
                      {account.email}
                    </p>
                  )}
                </div>
                <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-[var(--glass-border)]/30 text-[var(--text-secondary)] uppercase">
                  {account.level === "full"
                    ? "Full"
                    : account.level === "read_only"
                    ? "View"
                    : "Std"}
                </span>
                {isActive && (
                  <span
                    className="material-symbols-outlined text-sm"
                    style={{ color: accent }}
                  >
                    check
                  </span>
                )}
              </button>
            );
          })}

          {!loading && accounts.length === 0 && (
            <div className="px-3 py-4 text-center">
              <p className="text-[11px] text-[var(--text-secondary)] opacity-60">
                No accounts assigned yet
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

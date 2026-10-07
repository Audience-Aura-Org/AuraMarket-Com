"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  Store,
  ShoppingCart,
  ShieldCheck,
  AlertTriangle,
  Wallet,
  RefreshCw,
  ChevronRight,
  Briefcase,
} from "lucide-react";
import Link from "next/link";
import { useAuthStore } from "@/hooks/useAuth";
import { useManagerScope } from "@/hooks/useManagerScope";
import StatCard from "@/components/layout/StatCard";

function fmt(n) {
  return Number(n || 0).toLocaleString("fr-CM");
}

const LEVEL_LABELS = {
  read_only: { text: "View Only", color: "text-slate-500 bg-slate-500/10" },
  standard: { text: "Standard", color: "text-blue-500 bg-blue-500/10" },
  full: { text: "Full Access", color: "text-emerald-500 bg-emerald-500/10" },
};

export default function ManagerPortfolioPage() {
  const { user, hasHydrated } = useAuthStore();
  const {
    assignments,
    stats,
    fetchPortfolio,
    loading,
    activeAccountId,
    setActiveAccount,
  } = useManagerScope();

  const refresh = useCallback(() => {
    fetchPortfolio({ force: true });
  }, [fetchPortfolio]);

  useEffect(() => {
    if (!hasHydrated || user?.role !== "manager") return;
    fetchPortfolio();
  }, [hasHydrated, user, fetchPortfolio]);

  if (!hasHydrated) return null;
  if (user?.role !== "manager") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-sm text-[var(--text-secondary)]">
          This page is only available for managers.
        </p>
      </div>
    );
  }

  const activeAssignments = assignments.filter((a) => a.status === "active");
  const s = stats || {};

  return (
    <div className="w-full min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] font-display">
      {/* Header */}
      <div className="relative border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/10 backdrop-blur-2xl sticky top-0 z-50">
        <div className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-transparent via-blue-500/40 to-transparent" />
        <div className="px-4 md:px-6 py-3 md:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-10 md:size-11 rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-600/10 flex items-center justify-center text-blue-500 border border-blue-500/20 shrink-0 shadow-lg shadow-blue-500/5">
                <Briefcase className="size-5" />
              </div>
              <div>
                <h1 className="text-base md:text-lg font-bold tracking-tight font-[Poppins]">
                  My Portfolio
                </h1>
                <p className="text-[10px] font-semibold text-[var(--text-secondary)] opacity-40 tracking-tight font-[Poppins]">
                  Assigned Accounts Overview
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/5 border border-blue-500/10">
                <span className="text-[10px] font-semibold text-blue-500 font-[Poppins]">
                  {activeAssignments.length} account{activeAssignments.length !== 1 ? "s" : ""}
                </span>
              </div>
              <button
                onClick={refresh}
                className="size-10 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/50 text-[var(--text-secondary)] flex items-center justify-center hover:text-blue-500 hover:border-blue-500/30 transition-all active:scale-95"
              >
                <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-8 space-y-8 font-sans">
        {/* KPI Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Managed Users"
            value={fmt(s.users)}
            sub="Active accounts"
            icon={Users}
            color="blue"
            href="/admin/users"
            loading={loading}
          />
          <StatCard
            label="Vendors"
            value={fmt(s.vendors)}
            sub="Stores in scope"
            icon={Store}
            color="amber"
            href="/admin/vendors"
            loading={loading}
          />
          <StatCard
            label="Orders"
            value={fmt(s.orders)}
            sub="Active orders"
            icon={ShoppingCart}
            color="emerald"
            href="/admin/orders"
            loading={loading}
          />
          <StatCard
            label="KYC Pending"
            value={fmt(s.pendingKyc)}
            sub="Awaiting review"
            icon={ShieldCheck}
            color="primary"
            href="/admin/approvals"
            loading={loading}
          />
        </div>

        {/* Secondary Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard
            label="Open Disputes"
            value={fmt(s.disputes)}
            sub="Need resolution"
            icon={AlertTriangle}
            color="rose"
            href="/admin/disputes"
            loading={loading}
          />
          <StatCard
            label="Escrow Holds"
            value={fmt(s.escrowHolds)}
            sub="Active custody"
            icon={ShieldCheck}
            color="indigo"
            href="/admin/escrow"
            loading={loading}
          />
          <StatCard
            label="Pending Withdrawals"
            value={fmt(s.pendingWithdrawals)}
            sub="Awaiting approval"
            icon={Wallet}
            color="fuchsia"
            href="/admin/withdrawals"
            loading={loading}
          />
        </div>

        {/* Assigned Accounts Table */}
        <section className="bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-3xl p-5 md:p-8 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-sm font-bold tracking-tight">
                Assigned Accounts
              </h2>
              <p className="text-[10px] font-semibold text-[var(--text-secondary)] opacity-60">
                Users and vendors under your management
              </p>
            </div>
            <span className="text-[11px] font-bold text-blue-500 bg-blue-500/10 px-3 py-1 rounded-full">
              {activeAssignments.length} total
            </span>
          </div>

          {loading && activeAssignments.length === 0 ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="h-16 rounded-2xl bg-[var(--bg-secondary)] animate-pulse"
                />
              ))}
            </div>
          ) : activeAssignments.length === 0 ? (
            <div className="text-center py-12">
              <Users className="size-8 mx-auto text-[var(--text-secondary)] opacity-30 mb-3" />
              <p className="text-sm font-semibold text-[var(--text-secondary)] opacity-60">
                No accounts assigned yet
              </p>
              <p className="text-[11px] text-[var(--text-secondary)] opacity-40 mt-1">
                An admin will assign user accounts to your portfolio
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {activeAssignments.map((assignment) => {
                const u = assignment.user_id || {};
                const userId = u._id || u;
                const name = u.name || u.email || String(userId).slice(-8);
                const email = u.email || "";
                const role = u.role || "customer";
                const level = LEVEL_LABELS[assignment.access_level] || LEVEL_LABELS.standard;
                const isActive = activeAccountId === userId;

                return (
                  <button
                    key={assignment._id || userId}
                    onClick={() => setActiveAccount(isActive ? null : userId)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all text-left group ${
                      isActive
                        ? "border-blue-500/30 bg-blue-500/5"
                        : "border-[var(--glass-border)] hover:border-blue-500/20 hover:bg-[var(--bg-secondary)]/30"
                    }`}
                  >
                    <div
                      className={`size-9 rounded-xl flex items-center justify-center shrink-0 ${
                        role === "vendor"
                          ? "bg-amber-500/10 text-amber-500"
                          : role === "logistics"
                          ? "bg-purple-500/10 text-purple-500"
                          : "bg-blue-500/10 text-blue-500"
                      }`}
                    >
                      {role === "vendor" ? (
                        <Store className="size-4" />
                      ) : role === "logistics" ? (
                        <ShoppingCart className="size-4" />
                      ) : (
                        <Users className="size-4" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold tracking-tight text-[var(--text-primary)] truncate">
                        {name}
                      </p>
                      <p className="text-[10px] text-[var(--text-secondary)] opacity-60 truncate">
                        {email}
                      </p>
                    </div>

                    <span className="text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full capitalize">
                      <span className={`px-2 py-0.5 rounded-full ${level.color}`}>
                        {level.text}
                      </span>
                    </span>

                    <span
                      className={`text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                        role === "vendor"
                          ? "text-amber-500 bg-amber-500/10"
                          : role === "logistics"
                          ? "text-purple-500 bg-purple-500/10"
                          : "text-blue-500 bg-blue-500/10"
                      }`}
                    >
                      {role}
                    </span>

                    <ChevronRight
                      className={`size-4 text-[var(--text-secondary)] opacity-40 group-hover:opacity-70 transition-opacity ${
                        isActive ? "rotate-90" : ""
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

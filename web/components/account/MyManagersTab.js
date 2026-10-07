"use client";

import { useState, useEffect } from "react";
import { UserCog, Shield, X, Loader2, CheckCircle, XCircle, Clock } from "lucide-react";
import api from "@/services/api";
import { toast } from "react-hot-toast";

const LEVEL_LABELS = {
  read_only: "View Only",
  standard: "Standard",
  full: "Full Access",
};

const STATUS_STYLES = {
  active: { icon: CheckCircle, color: "text-emerald-500 bg-emerald-500/10", label: "Active" },
  pending: { icon: Clock, color: "text-amber-500 bg-amber-500/10", label: "Pending Invite" },
  revoked: { icon: XCircle, color: "text-red-500 bg-red-500/10", label: "Revoked" },
  declined: { icon: XCircle, color: "text-slate-500 bg-slate-500/10", label: "Declined" },
};

export default function MyManagersTab() {
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    fetchManagers();
  }, []);

  const fetchManagers = async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/my-managers");
      if (res.data?.success) {
        setManagers(res.data.data?.managers || []);
      }
    } catch (err) {
      if (err.response?.status !== 404) {
        toast.error("Failed to load managers");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (assignmentId, name) => {
    if (!window.confirm(`Remove ${name} as your manager? They will no longer be able to manage your account.`)) return;
    setActionLoading(assignmentId);
    try {
      const res = await api.post(`/admin/my-managers/${assignmentId}/revoke`);
      if (res.data.success) {
        toast.success(`${name} removed`);
        setManagers((prev) =>
          prev.map((m) =>
            m._id === assignmentId ? { ...m, status: "revoked" } : m
          )
        );
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to revoke");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRespond = async (assignmentId, accept) => {
    setActionLoading(assignmentId);
    try {
      const res = await api.post(`/admin/invites/${assignmentId}/respond`, {
        accept,
      });
      if (res.data.success) {
        toast.success(accept ? "Invite accepted" : "Invite declined");
        setManagers((prev) =>
          prev.map((m) =>
            m._id === assignmentId
              ? { ...m, status: accept ? "active" : "declined" }
              : m
          )
        );
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Response failed");
    } finally {
      setActionLoading(null);
    }
  };

  const activeManagers = managers.filter((m) => m.status === "active");
  const pendingInvites = managers.filter((m) => m.status === "pending");
  const pastManagers = managers.filter((m) => m.status === "revoked" || m.status === "declined");

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-[2rem] border border-[var(--glass-border)] bg-[var(--bg-secondary)] md:rounded-[3rem]">
        <div className="px-4 md:px-8 lg:px-12 py-6 space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 border border-blue-500/20">
              <UserCog className="size-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight">My Managers</h2>
              <p className="text-[10px] font-semibold text-[var(--text-secondary)] opacity-50">
                People who help manage your account
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-blue-500" />
            </div>
          ) : managers.length === 0 ? (
            <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 p-12 text-center shadow-inner">
              <Shield className="mx-auto mb-4 size-10 text-[var(--text-secondary)] opacity-20" />
              <p className="text-[12px] font-semibold text-[var(--text-secondary)] opacity-60">
                No managers assigned to your account
              </p>
              <p className="text-[10px] text-[var(--text-secondary)] opacity-40 mt-1">
                An admin can assign a manager to help with your account
              </p>
            </div>
          ) : (
            <>
              {/* Pending Invites */}
              {pendingInvites.length > 0 && (
                <div className="space-y-3">
                  <p className="text-[10px] font-bold tracking-widest uppercase text-amber-500 opacity-70">
                    Pending Invites
                  </p>
                  {pendingInvites.map((assignment) => {
                    const manager = assignment.manager_id || {};
                    const name = manager.name || manager.email || "Manager";
                    const isLoading = actionLoading === assignment._id;

                    return (
                      <div
                        key={assignment._id}
                        className="flex items-center gap-3 p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5"
                      >
                        <div className="size-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                          <Clock className="size-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-semibold truncate">{name}</p>
                          <p className="text-[10px] text-[var(--text-secondary)] opacity-50 truncate">
                            {manager.email} — {LEVEL_LABELS[assignment.access_level] || "Standard"} access
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleRespond(assignment._id, true)}
                            disabled={isLoading}
                            className="h-8 px-3 rounded-lg bg-emerald-500 text-white text-[10px] font-bold tracking-tight hover:bg-emerald-600 transition-all disabled:opacity-50 flex items-center gap-1"
                          >
                            {isLoading ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle className="size-3" />}
                            Accept
                          </button>
                          <button
                            onClick={() => handleRespond(assignment._id, false)}
                            disabled={isLoading}
                            className="h-8 px-3 rounded-lg bg-red-500/10 text-red-500 text-[10px] font-bold tracking-tight hover:bg-red-500 hover:text-white transition-all disabled:opacity-50 flex items-center gap-1"
                          >
                            <XCircle className="size-3" />
                            Decline
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Active Managers */}
              {activeManagers.length > 0 && (
                <div className="space-y-3">
                  {pendingInvites.length > 0 && (
                    <p className="text-[10px] font-bold tracking-widest uppercase text-emerald-500 opacity-70">
                      Active Managers
                    </p>
                  )}
                  {activeManagers.map((assignment) => {
                    const manager = assignment.manager_id || {};
                    const name = manager.name || manager.email || "Manager";
                    const isLoading = actionLoading === assignment._id;

                    return (
                      <div
                        key={assignment._id}
                        className="flex items-center gap-3 p-4 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/40"
                      >
                        <div className="size-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                          <UserCog className="size-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-semibold truncate">{name}</p>
                          <p className="text-[10px] text-[var(--text-secondary)] opacity-50 truncate">
                            {manager.email}
                          </p>
                        </div>
                        <span className="text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full text-blue-500 bg-blue-500/10">
                          {LEVEL_LABELS[assignment.access_level] || "Standard"}
                        </span>
                        <button
                          onClick={() => handleRevoke(assignment._id, name)}
                          disabled={isLoading}
                          className="size-8 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all disabled:opacity-50"
                          title="Remove manager"
                        >
                          {isLoading ? <Loader2 className="size-3 animate-spin" /> : <X className="size-3.5" />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Past Managers */}
              {pastManagers.length > 0 && (
                <div className="space-y-3">
                  <p className="text-[10px] font-bold tracking-widest uppercase text-[var(--text-secondary)] opacity-30">
                    Past
                  </p>
                  {pastManagers.map((assignment) => {
                    const manager = assignment.manager_id || {};
                    const name = manager.name || manager.email || "Manager";
                    const status = STATUS_STYLES[assignment.status] || STATUS_STYLES.revoked;
                    const StatusIcon = status.icon;

                    return (
                      <div
                        key={assignment._id}
                        className="flex items-center gap-3 p-3 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/20 opacity-50"
                      >
                        <StatusIcon className="size-4 text-[var(--text-secondary)]" />
                        <p className="text-[11px] font-semibold truncate flex-1">{name}</p>
                        <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${status.color}`}>
                          {status.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

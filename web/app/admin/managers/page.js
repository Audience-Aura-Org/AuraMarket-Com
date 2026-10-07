"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  Shield,
  ShieldAlert,
  Search,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  User,
  Loader2,
  X,
  Trash2,
  UserPlus,
  ArrowRightLeft,
} from "lucide-react";
import api from "@/services/api";
import { useAuthStore } from "@/hooks/useAuth";
import { toast } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";

function fmt(n) {
  return Number(n || 0).toLocaleString("fr-CM");
}

const LEVEL_LABELS = {
  read_only: { text: "View", color: "text-slate-500 bg-slate-500/10 border-slate-500/20" },
  standard: { text: "Std", color: "text-blue-500 bg-blue-500/10 border-blue-500/20" },
  full: { text: "Full", color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" },
};

export default function AdminManagersPage() {
  const { user } = useAuthStore();
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Expanded manager — shows their assignments
  const [expanded, setExpanded] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [assignLoading, setAssignLoading] = useState(false);

  // Transfer modal
  const [transferModal, setTransferModal] = useState(false);
  const [transferFrom, setTransferFrom] = useState(null);
  const [transferTo, setTransferTo] = useState("");
  const [transferLoading, setTransferLoading] = useState(false);

  const fetchManagers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/users?role=manager");
      if (res.data?.success) setManagers(res.data.data.users || []);
    } catch {
      toast.error("Failed to load managers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role !== "admin") return;
    fetchManagers();
  }, [user?.role, fetchManagers]);

  const toggleExpand = async (managerId) => {
    if (expanded === managerId) {
      setExpanded(null);
      setAssignments([]);
      return;
    }
    setExpanded(managerId);
    setAssignLoading(true);
    try {
      const res = await api.get(`/admin/managers/${managerId}/assignments`);
      if (res.data?.success) setAssignments(res.data.data.assignments || []);
    } catch {
      toast.error("Failed to load assignments");
      setAssignments([]);
    } finally {
      setAssignLoading(false);
    }
  };

  const handleDemote = async (managerId, name) => {
    if (!window.confirm(`Remove manager access for ${name}?`)) return;
    try {
      const res = await api.post(`/admin/managers/${managerId}/demote`);
      if (res.data.success) {
        toast.success(`${name} demoted`);
        setManagers((prev) => prev.filter((m) => m._id !== managerId));
        if (expanded === managerId) {
          setExpanded(null);
          setAssignments([]);
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Demotion failed");
    }
  };

  const handleUnassign = async (managerId, userId, userName) => {
    if (!window.confirm(`Remove ${userName} from this manager?`)) return;
    try {
      const res = await api.post(`/admin/managers/${managerId}/unassign`, {
        user_ids: [userId],
      });
      if (res.data.success) {
        toast.success(`${userName} unassigned`);
        setAssignments((prev) =>
          prev.filter((a) => (a.user_id?._id || a.user_id) !== userId)
        );
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Unassign failed");
    }
  };

  const handleUpdateLevel = async (assignmentId, newLevel) => {
    try {
      const res = await api.patch(`/admin/assignments/${assignmentId}/level`, {
        access_level: newLevel,
      });
      if (res.data.success) {
        toast.success("Access level updated");
        setAssignments((prev) =>
          prev.map((a) =>
            a._id === assignmentId ? { ...a, access_level: newLevel } : a
          )
        );
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Update failed");
    }
  };

  const openTransfer = (manager) => {
    setTransferFrom(manager);
    setTransferTo("");
    setTransferModal(true);
  };

  const handleTransfer = async () => {
    if (!transferTo || !transferFrom) return;
    setTransferLoading(true);
    try {
      const res = await api.post("/admin/assignments/transfer", {
        from_manager_id: transferFrom._id,
        to_manager_id: transferTo,
      });
      if (res.data.success) {
        toast.success(`${res.data.data?.transferred || 0} assignments transferred`);
        setTransferModal(false);
        if (expanded === transferFrom._id) {
          setExpanded(null);
          setAssignments([]);
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Transfer failed");
    } finally {
      setTransferLoading(false);
    }
  };

  const filtered = managers.filter(
    (m) =>
      m.name?.toLowerCase().includes(search.toLowerCase()) ||
      m.email?.toLowerCase().includes(search.toLowerCase())
  );

  if (user?.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-sm text-[var(--text-secondary)]">Admin only.</p>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] font-display">
      {/* Header */}
      <header className="min-h-20 py-4 flex flex-col md:flex-row md:h-24 items-center justify-between px-4 md:px-10 border-b border-[var(--glass-border)] bg-[var(--bg-primary)]/80 backdrop-blur-xl sticky top-0 md:top-16 lg:top-0 z-40 gap-4 md:gap-0">
        <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-4">
            <div className="size-10 md:size-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-500 flex items-center justify-center shadow-inner shrink-0">
              <Shield className="size-5 md:size-6" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-bold tracking-tight">
                Manager <span className="text-sky-500">Registry</span>
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="size-1.5 rounded-full bg-sky-500 animate-pulse" />
                <p className="text-[10px] font-semibold text-[var(--text-secondary)] tracking-tight opacity-50 uppercase">
                  {filtered.length} manager{filtered.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={fetchManagers}
            className="size-10 rounded-xl border border-[var(--glass-border)] text-[var(--text-secondary)] flex items-center justify-center active:scale-95 hover:text-sky-500 transition-all"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      <div className="p-4 md:p-8 space-y-4 pb-32">
        {/* Search */}
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-[var(--text-secondary)] opacity-30 group-focus-within:text-sky-500 transition-all" />
          <input
            type="text"
            placeholder="Search managers..."
            className="w-full h-12 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl pl-11 pr-4 text-[13px] font-semibold tracking-tight text-[var(--text-primary)] outline-none focus:border-sky-500/50 transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-6 animate-spin text-sky-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center border border-dashed border-[var(--glass-border)] rounded-[3rem] opacity-30 flex flex-col items-center gap-4">
            <Shield className="size-12 opacity-20" />
            <p className="text-[10px] font-bold tracking-widest uppercase">
              No managers found
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((m) => {
              const isExpanded = expanded === m._id;
              return (
                <div
                  key={m._id}
                  className="rounded-[2rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/60 shadow-sm overflow-hidden"
                >
                  {/* Manager Row */}
                  <div className="flex items-center gap-4 p-4 md:p-6">
                    <div className="size-12 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                      {m.avatar ? (
                        <img
                          src={m.avatar}
                          className="size-full object-cover"
                          alt=""
                        />
                      ) : (
                        <User className="size-6 opacity-20" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold tracking-tight truncate">
                        {m.name || "Unnamed"}
                      </p>
                      <p className="text-[11px] font-semibold text-[var(--text-secondary)] opacity-40 truncate">
                        {m.email}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleExpand(m._id)}
                        className={`h-9 px-3 rounded-xl border text-[10px] font-bold tracking-tight transition-all flex items-center gap-1.5 ${
                          isExpanded
                            ? "border-sky-500/30 bg-sky-500/10 text-sky-500"
                            : "border-[var(--glass-border)] text-[var(--text-secondary)] hover:border-sky-500/20"
                        }`}
                      >
                        <Users className="size-3.5" />
                        Accounts
                        {isExpanded ? (
                          <ChevronDown className="size-3" />
                        ) : (
                          <ChevronRight className="size-3" />
                        )}
                      </button>
                      <button
                        onClick={() => openTransfer(m)}
                        className="size-9 rounded-xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 flex items-center justify-center hover:bg-indigo-500 hover:text-white transition-all"
                        title="Transfer all assignments"
                      >
                        <ArrowRightLeft className="size-4" />
                      </button>
                      <button
                        onClick={() => handleDemote(m._id, m.name)}
                        className="size-9 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center hover:bg-amber-500 hover:text-white transition-all"
                        title="Demote"
                      >
                        <ShieldAlert className="size-4" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Assignments */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden border-t border-[var(--glass-border)]"
                      >
                        <div className="p-4 md:px-6 bg-[var(--bg-secondary)]/20">
                          {assignLoading ? (
                            <div className="flex items-center justify-center py-6">
                              <Loader2 className="size-5 animate-spin text-sky-500" />
                            </div>
                          ) : assignments.length === 0 ? (
                            <p className="text-center text-[11px] text-[var(--text-secondary)] opacity-50 py-6">
                              No accounts assigned to this manager
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {assignments.map((a) => {
                                const u = a.user_id || {};
                                const userId = u._id || a.user_id;
                                const name = u.name || u.email || String(userId).slice(-8);
                                const email = u.email || "";
                                const role = u.role || "customer";
                                const level = LEVEL_LABELS[a.access_level] || LEVEL_LABELS.standard;

                                return (
                                  <div
                                    key={a._id}
                                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/50"
                                  >
                                    <div
                                      className={`size-8 rounded-lg flex items-center justify-center shrink-0 ${
                                        role === "vendor"
                                          ? "bg-amber-500/10 text-amber-500"
                                          : "bg-blue-500/10 text-blue-500"
                                      }`}
                                    >
                                      <User className="size-3.5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-[11px] font-semibold truncate">
                                        {name}
                                      </p>
                                      <p className="text-[9px] text-[var(--text-secondary)] opacity-50 truncate">
                                        {email}
                                      </p>
                                    </div>

                                    <span
                                      className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${
                                        role === "vendor"
                                          ? "text-amber-500 bg-amber-500/10"
                                          : "text-blue-500 bg-blue-500/10"
                                      }`}
                                    >
                                      {role}
                                    </span>

                                    <select
                                      value={a.access_level}
                                      onChange={(e) =>
                                        handleUpdateLevel(a._id, e.target.value)
                                      }
                                      className={`h-7 px-2 rounded-lg border text-[9px] font-bold uppercase tracking-wide outline-none cursor-pointer appearance-none bg-transparent ${level.color}`}
                                    >
                                      <option value="read_only">View</option>
                                      <option value="standard">Std</option>
                                      <option value="full">Full</option>
                                    </select>

                                    <button
                                      onClick={() =>
                                        handleUnassign(m._id, userId, name)
                                      }
                                      className="size-7 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"
                                      title="Unassign"
                                    >
                                      <X className="size-3" />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Transfer Modal */}
      <AnimatePresence>
        {transferModal && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
              onClick={() => setTransferModal(false)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-[2.5rem] p-6 md:p-8 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="size-11 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 border border-indigo-500/20 shadow-inner">
                    <ArrowRightLeft className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold tracking-tight">
                      Transfer Assignments
                    </h3>
                    <p className="text-[10px] font-bold text-[var(--text-secondary)] opacity-40 uppercase tracking-widest mt-0.5">
                      From {transferFrom?.name || transferFrom?.email}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setTransferModal(false)}
                  className="p-2 rounded-xl hover:bg-[var(--bg-secondary)] transition-all text-[var(--text-secondary)]"
                >
                  <X className="size-5" />
                </button>
              </div>

              <div className="space-y-5">
                <div className="space-y-2">
                  <p className="text-[10px] font-bold tracking-widest opacity-40 uppercase ml-1">
                    Transfer To
                  </p>
                  <select
                    value={transferTo}
                    onChange={(e) => setTransferTo(e.target.value)}
                    className="w-full h-12 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl px-4 text-[11px] font-bold tracking-tight outline-none appearance-none cursor-pointer focus:border-indigo-500 shadow-inner"
                  >
                    <option value="">Select target manager...</option>
                    {managers
                      .filter((m) => m._id !== transferFrom?._id)
                      .map((m) => (
                        <option key={m._id} value={m._id}>
                          {m.name || m.email} ({m.email})
                        </option>
                      ))}
                  </select>
                </div>

                <button
                  onClick={handleTransfer}
                  disabled={transferLoading || !transferTo}
                  className="w-full h-14 bg-indigo-500 text-white rounded-2xl font-bold text-xs uppercase tracking-[0.2em] shadow-lg shadow-indigo-500/20 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {transferLoading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Transferring...
                    </>
                  ) : (
                    "Transfer All Assignments"
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

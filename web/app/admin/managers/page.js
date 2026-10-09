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
  UserPlus,
  ArrowRightLeft,
} from "lucide-react";
import api from "@/services/api";
import { useAuthStore } from "@/hooks/useAuth";
import { toast } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";

/** Permission categories from the ManagerAssignment model. */
const PERM_KEYS = ["products", "orders", "messages", "money", "profile"];

/** Derive a human-readable access label from a permissions object. */
function accessLabel(perms) {
  if (!perms) return { text: "Standard", color: "text-blue-500 bg-blue-500/10 border-blue-500/20" };
  const on = PERM_KEYS.filter((k) => perms[k]);
  if (on.length === 0) return { text: "View Only", color: "text-slate-500 bg-slate-500/10 border-slate-500/20" };
  if (on.length === PERM_KEYS.length) return { text: "Full", color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" };
  return { text: "Standard", color: "text-blue-500 bg-blue-500/10 border-blue-500/20" };
}

/** Convert a preset level to a permissions object. */
function levelToPerms(level) {
  switch (level) {
    case "read_only": return { products: false, orders: false, messages: false, money: false, profile: false };
    case "full":      return { products: true,  orders: true,  messages: true,  money: true,  profile: true };
    default:          return { products: true,  orders: true,  messages: true,  money: false, profile: true };
  }
}

/** Derive preset level from a permissions object. */
function permsToLevel(perms) {
  if (!perms) return "standard";
  const on = PERM_KEYS.filter((k) => perms[k]);
  if (on.length === 0) return "read_only";
  if (on.length === PERM_KEYS.length) return "full";
  return "standard";
}

const ROLE_CHIP = {
  vendor:    "text-pink-500 bg-pink-500/10",
  logistics: "text-purple-500 bg-purple-500/10",
  customer:  "text-blue-500 bg-blue-500/10",
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

  // Assign modal
  const [assignModal, setAssignModal] = useState(false);
  const [assignManagerId, setAssignManagerId] = useState(null);
  const [assignUserSearch, setAssignUserSearch] = useState("");
  const [assignUserResults, setAssignUserResults] = useState([]);
  const [assignUserLoading, setAssignUserLoading] = useState(false);
  const [assignSelectedUsers, setAssignSelectedUsers] = useState([]);
  const [assignLevel, setAssignLevel] = useState("standard");
  const [assignSubmitting, setAssignSubmitting] = useState(false);

  const fetchManagers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/managers");
      if (res.data?.success) setManagers(res.data.data || []);
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
      if (res.data?.success) setAssignments(res.data.data?.assignments || []);
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
        setManagers((prev) => prev.filter((m) => String(m._id) !== String(managerId)));
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
        userIds: [userId],
      });
      if (res.data.success) {
        toast.success(`${userName} unassigned`);
        setAssignments((prev) =>
          prev.filter((a) => String(a.user_id?._id || a.user_id) !== String(userId))
        );
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Unassign failed");
    }
  };

  const handleUpdatePermissions = async (assignmentId, newLevel) => {
    try {
      const permissions = levelToPerms(newLevel);
      // Use the manager assign endpoint to update — re-assigning with new perms
      // Actually, there's no direct update route for admin on assignment permissions.
      // The user-side route is PATCH /my-managers/:id/permissions.
      // For admin, we update the assignment directly.
      const res = await api.patch(`/admin/assignments/${assignmentId}/permissions`, {
        permissions,
      });
      if (res.data.success) {
        toast.success("Permissions updated");
        setAssignments((prev) =>
          prev.map((a) =>
            a._id === assignmentId ? { ...a, permissions } : a
          )
        );
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Update failed");
    }
  };

  // Assign users modal
  const openAssignModal = (managerId) => {
    setAssignManagerId(managerId);
    setAssignUserSearch("");
    setAssignUserResults([]);
    setAssignSelectedUsers([]);
    setAssignLevel("standard");
    setAssignModal(true);
  };

  const searchUsers = async (q) => {
    setAssignUserSearch(q);
    if (q.length < 2) { setAssignUserResults([]); return; }
    setAssignUserLoading(true);
    try {
      const res = await api.get(`/admin/users?search=${encodeURIComponent(q)}&limit=20`);
      const users = (res.data?.data?.users || []).filter(
        (u) => !["admin", "manager"].includes(u.role)
      );
      setAssignUserResults(users);
    } catch {
      setAssignUserResults([]);
    } finally {
      setAssignUserLoading(false);
    }
  };

  const toggleUserSelect = (u) => {
    setAssignSelectedUsers((prev) => {
      const exists = prev.some((s) => s._id === u._id);
      return exists ? prev.filter((s) => s._id !== u._id) : [...prev, u];
    });
  };

  const handleAssignUsers = async () => {
    if (!assignSelectedUsers.length) return toast.error("Select at least one user");
    setAssignSubmitting(true);
    try {
      const res = await api.post(`/admin/managers/${assignManagerId}/assign`, {
        userIds: assignSelectedUsers.map((u) => u._id),
        permissions: levelToPerms(assignLevel),
      });
      if (res.data.success) {
        const d = res.data.data || {};
        const count = d.assigned?.length ?? 0;
        const skipped = d.skipped || [];
        const activeCount = skipped.filter(s => s.reason === "already_active").length;
        const otherSkipped = skipped.length - activeCount;
        if (count > 0) toast.success(`${count} account${count !== 1 ? "s" : ""} assigned`);
        if (activeCount > 0 && otherSkipped === 0) toast.success(`${activeCount} already active — permissions updated`);
        else if (otherSkipped > 0) toast(`${otherSkipped} already assigned`, { icon: "ℹ️" });
        setAssignModal(false);
        // Refresh the expanded panel if we're looking at this manager
        if (expanded === assignManagerId) toggleExpand(assignManagerId);
        fetchManagers(); // refresh counts
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Assignment failed");
    } finally {
      setAssignSubmitting(false);
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
        fromManagerId: transferFrom._id,
        toManagerId: transferTo,
      });
      if (res.data.success) {
        toast.success(`${res.data.data?.transferred || 0} assignments transferred`);
        setTransferModal(false);
        if (expanded === transferFrom._id) {
          setExpanded(null);
          setAssignments([]);
        }
        fetchManagers(); // refresh counts
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

                    {/* Account count badge */}
                    {typeof m.accounts === "number" && (
                      <span className="text-[10px] font-bold text-sky-500 bg-sky-500/10 px-2 py-0.5 rounded-full">
                        {m.accounts} acct{m.accounts !== 1 ? "s" : ""}
                      </span>
                    )}

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
                        onClick={() => openAssignModal(m._id)}
                        className="size-9 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center hover:bg-emerald-500 hover:text-white transition-all"
                        title="Assign accounts"
                      >
                        <UserPlus className="size-4" />
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
                            <div className="text-center py-6">
                              <p className="text-[11px] text-[var(--text-secondary)] opacity-50">
                                No accounts assigned to this manager
                              </p>
                              <button
                                onClick={() => openAssignModal(m._id)}
                                className="mt-2 text-[11px] font-semibold text-emerald-500 hover:underline"
                              >
                                Assign accounts
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {assignments.map((a) => {
                                const u = a.user_id || {};
                                const userId = u._id || a.user_id;
                                const name = u.name || u.email || String(userId).slice(-8);
                                const email = u.email || "";
                                const role = u.role || "customer";
                                const level = accessLabel(a.permissions);
                                const currentPreset = permsToLevel(a.permissions);
                                const chipColor = ROLE_CHIP[role] || ROLE_CHIP.customer;

                                return (
                                  <div
                                    key={a._id}
                                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/50"
                                  >
                                    <div className={`size-8 rounded-lg flex items-center justify-center shrink-0 ${chipColor}`}>
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

                                    <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${chipColor}`}>
                                      {role}
                                    </span>

                                    {a.status === "pending" && (
                                      <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full text-amber-500 bg-amber-500/10">
                                        Pending
                                      </span>
                                    )}

                                    <select
                                      value={currentPreset}
                                      onChange={(e) =>
                                        handleUpdatePermissions(a._id, e.target.value)
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

      {/* Assign Users Modal */}
      <AnimatePresence>
        {assignModal && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
              onClick={() => setAssignModal(false)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-[2.5rem] p-6 md:p-8 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="size-11 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20 shadow-inner">
                    <UserPlus className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold tracking-tight">Assign Accounts</h3>
                    <p className="text-[10px] font-bold text-[var(--text-secondary)] opacity-40 uppercase tracking-widest mt-0.5">
                      Search and select users
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setAssignModal(false)}
                  className="p-2 rounded-xl hover:bg-[var(--bg-secondary)] transition-all text-[var(--text-secondary)]"
                >
                  <X className="size-5" />
                </button>
              </div>

              <div className="space-y-4">
                {/* User search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--text-secondary)] opacity-30" />
                  <input
                    type="text"
                    placeholder="Search users by name or email..."
                    value={assignUserSearch}
                    onChange={(e) => searchUsers(e.target.value)}
                    className="w-full h-11 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl pl-10 pr-4 text-[12px] font-semibold tracking-tight outline-none focus:border-emerald-500/50 transition-all"
                    autoFocus
                  />
                </div>

                {/* Search results */}
                {assignUserSearch.length >= 2 && (
                  <div className="max-h-[200px] overflow-y-auto rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/50">
                    {assignUserLoading ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="size-4 animate-spin text-emerald-500" />
                      </div>
                    ) : assignUserResults.length === 0 ? (
                      <p className="text-center text-[11px] text-[var(--text-secondary)] opacity-50 py-4">
                        No users found
                      </p>
                    ) : (
                      assignUserResults.map((u) => {
                        const selected = assignSelectedUsers.some((s) => s._id === u._id);
                        return (
                          <button
                            key={u._id}
                            onClick={() => toggleUserSelect(u)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all ${
                              selected ? "bg-emerald-500/10" : "hover:bg-[var(--bg-secondary)]"
                            }`}
                          >
                            <div className={`size-7 rounded-lg flex items-center justify-center shrink-0 ${
                              ROLE_CHIP[u.role] || ROLE_CHIP.customer
                            }`}>
                              <User className="size-3" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-semibold truncate">{u.name || u.email}</p>
                              <p className="text-[9px] text-[var(--text-secondary)] opacity-50 truncate">{u.email}</p>
                            </div>
                            <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded ${ROLE_CHIP[u.role] || ROLE_CHIP.customer}`}>
                              {u.role}
                            </span>
                            {selected && (
                              <div className="size-5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                                <X className="size-3 text-white" />
                              </div>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}

                {/* Selected users */}
                {assignSelectedUsers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {assignSelectedUsers.map((u) => (
                      <span
                        key={u._id}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-500 text-[10px] font-semibold"
                      >
                        {u.name || u.email}
                        <button onClick={() => toggleUserSelect(u)} className="hover:text-red-400">
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Access level */}
                <div className="space-y-2">
                  <p className="text-[10px] font-bold tracking-widest opacity-40 uppercase ml-1">Access Level</p>
                  <div className="flex gap-2">
                    {[
                      { value: "read_only", label: "View Only", desc: "Read access only" },
                      { value: "standard", label: "Standard", desc: "Read + edit" },
                      { value: "full", label: "Full", desc: "All operations" },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setAssignLevel(opt.value)}
                        className={`flex-1 p-3 rounded-xl border text-center transition-all ${
                          assignLevel === opt.value
                            ? "border-emerald-500/40 bg-emerald-500/10"
                            : "border-[var(--glass-border)] hover:border-emerald-500/20"
                        }`}
                      >
                        <p className={`text-[11px] font-bold ${assignLevel === opt.value ? "text-emerald-500" : "text-[var(--text-primary)]"}`}>
                          {opt.label}
                        </p>
                        <p className="text-[9px] text-[var(--text-secondary)] opacity-50 mt-0.5">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleAssignUsers}
                  disabled={assignSubmitting || !assignSelectedUsers.length}
                  className="w-full h-14 bg-emerald-500 text-white rounded-2xl font-bold text-xs uppercase tracking-[0.2em] shadow-lg shadow-emerald-500/20 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {assignSubmitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Assigning...
                    </>
                  ) : (
                    `Assign ${assignSelectedUsers.length} Account${assignSelectedUsers.length !== 1 ? "s" : ""}`
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

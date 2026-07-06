"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { 
  User, Shield, ShieldAlert, Mail, Search, 
  Filter, Loader2, Ban, CheckCircle, MoreVertical, 
  X, Phone, Trash2, Users, ArrowUpRight, 
  ChevronRight, Activity, RefreshCw, LayoutGrid, List
} from 'lucide-react';
import api from '@/services/api';
import { useAuthStore } from '@/hooks/useAuth';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import Pagination from '@/components/common/Pagination';
import LoadingSpinner from '@/components/common/LoadingSpinner';

function fmt(n) { return Number(n || 0).toLocaleString('fr-CM'); }

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState('table');
  const itemsPerPage = 12;

  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', role: '', verification_status: '' });
  const [submitting, setSubmitting] = useState(false);

  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const { user } = useAuthStore();
  const [verificationFilter, setVerificationFilter] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setVerificationFilter(params.get('verification') || '');
    const querySearch = params.get('search') || '';
    if (querySearch) setSearch(querySearch);
  }, []);

  useEffect(() => {
    fetchUsers();
    setCurrentPage(1);
    setSelectedIds([]);
  }, [roleFilter, verificationFilter]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/users?role=${roleFilter === 'all' ? '' : roleFilter}`);
      if (res.data?.success) setUsers(res.data.data.users || []);
    } catch (err) {
      toast.error('Failed to fetch user directory');
    } finally { setLoading(false); }
  };

  const handleStatusUpdate = async (userId, status) => {
    try {
      const res = await api.patch(`/admin/users/${userId}/status`, { status });
      if (res.data.success) {
        toast.success(`Node status: ${status.toUpperCase()}`);
        setUsers(prev => prev.map(u => u._id === userId ? { ...u, verification_status: status } : u));
      }
    } catch (err) { toast.error('Status shift failed'); }
  };

  const handleDeleteUser = async (userId, userName) => {
    if (!window.confirm(`PURGE NODE: ${userName}? This is IRREVERSIBLE.`)) return;
    try {
      const res = await api.delete(`/admin/users/${userId}`);
      if (res.data.success) {
        toast.success(`${userName} purged.`);
        setUsers(prev => prev.filter(u => u._id !== userId));
      }
    } catch (err) { toast.error('Purge failed.'); }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (currentUsers.length === 0) return;
    const currentIds = currentUsers.map(u => u._id);
    const allSelected = currentIds.every(id => selectedIds.includes(id));
    setSelectedIds(prev => allSelected
      ? prev.filter(id => !currentIds.includes(id))
      : [...new Set([...prev, ...currentIds])]
    );
  };

  const handleBulkDelete = async () => {
    if (selectedIds.includes(user?._id)) {
      toast.error('You cannot purge your own active admin session.');
      return;
    }
    if (!window.confirm(`PURGE ${selectedIds.length} identity nodes? This is IRREVERSIBLE.`)) return;
    setBulkDeleting(true);
    try {
      const res = await api.post('/admin/users/bulk-delete', { ids: selectedIds });
      if (res.data.success) {
        toast.success(res.data.message || 'Identity nodes purged.');
        setUsers(prev => prev.filter(u => !selectedIds.includes(u._id)));
        setSelectedIds([]);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk purge failed.');
    } finally {
      setBulkDeleting(false);
    }
  };

  const filteredUsers = users.filter(u =>
    (
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase())
    ) &&
    (!verificationFilter || u.verification_status === verificationFilter)
  );

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const currentUsers = filteredUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleEditClick = (user) => {
    setEditingUser(user);
    setEditForm({
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      role: user.role || 'customer',
      verification_status: user.verification_status || 'unverified'
    });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await api.patch(`/admin/users/${editingUser._id}`, editForm);
      if (res.data.success) {
        toast.success('Identity Recalibrated');
        setUsers(users.map(u => u._id === editingUser._id ? { ...u, ...res.data.data.user } : u));
        setEditingUser(null);
      }
    } catch (err) { toast.error('Recalibration failed'); } finally { setSubmitting(false); }
  };

  const handleRequestVerification = async () => {
    if (!editingUser) return;
    setSubmitting(true);
    try {
      const payload = { ...editForm, verification_status: 'held' };
      const res = await api.patch(`/admin/users/${editingUser._id}`, payload);
      if (res.data.success) {
        toast.success('Verification requested. Account actions are paused.');
        setUsers(users.map(u => u._id === editingUser._id ? { ...u, ...res.data.data.user } : u));
        setEditForm(payload);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Verification request failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] font-display">
      
      {/* Surgical Header */}
      <header className="min-h-20 py-4 flex flex-col md:flex-row md:h-24 items-center justify-between px-4 md:px-10 border-b border-[var(--glass-border)] bg-[var(--bg-primary)]/80 backdrop-blur-xl sticky top-0 md:top-16 z-40 gap-4 md:gap-0">
        <div className="flex items-center gap-4 md:gap-6 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-4">
            <button
              onClick={toggleSelectAll}
              title="Select visible users"
              className={`size-10 md:size-12 rounded-2xl border flex items-center justify-center shadow-inner transition-all shrink-0 ${
                currentUsers.length > 0 && currentUsers.every(u => selectedIds.includes(u._id))
                  ? 'bg-[var(--accent)] border-[var(--accent)] text-white shadow-lg'
                  : 'bg-[var(--accent)]/10 border-[var(--accent)]/20 text-[var(--accent)]'
              }`}
            >
              {currentUsers.length > 0 && currentUsers.every(u => selectedIds.includes(u._id))
                ? <CheckCircle className="w-5 h-5 md:w-6 md:h-6" />
                : <Users className="w-5 h-5 md:w-6 md:h-6" />}
            </button>
            <div>
              <h2 className="text-lg md:text-xl font-bold text-[var(--text-primary)] tracking-tight">Identity <span className="text-[var(--accent)]">Matrix</span></h2>
              <div className="flex items-center gap-2 mt-0.5">
                 <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                 <p className="text-[10px] md:text-[11px] lg:text-[12px] font-semibold text-[var(--text-secondary)] tracking-tight opacity-50 uppercase">Global Directory</p>
              </div>
            </div>
          </div>
          <button onClick={fetchUsers} className="md:hidden size-10 rounded-xl border border-[var(--glass-border)] text-[var(--text-secondary)] flex items-center justify-center active:scale-95">
             <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
           <div className="flex bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl p-1 overflow-x-auto no-scrollbar flex-1 md:flex-none justify-between md:justify-start">
              {['all', 'customer', 'vendor', 'admin'].map(r => (
                <button
                  key={r} onClick={() => setRoleFilter(r)}
                  className={`px-3 md:px-4 py-1.5 rounded-xl text-[10px] lg:text-[12px] font-semibold tracking-tight transition-all uppercase whitespace-nowrap ${roleFilter === r ? 'bg-[var(--accent)] text-white shadow-lg' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] opacity-40'}`}
                >
                  {r}
                </button>
              ))}
           </div>
           <button onClick={fetchUsers} className="hidden md:flex size-11 md:size-12 rounded-2xl border border-[var(--glass-border)] hover:bg-[var(--accent)]/10 text-[var(--text-secondary)] items-center justify-center transition-all shadow-sm active:scale-95">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
           </button>
        </div>
      </header>

      <div className="p-4 md:p-8 space-y-4 max-w-[1600px] mx-auto pb-32">
        <div className="flex flex-col gap-3 rounded-[2rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/60 p-3 shadow-sm backdrop-blur-xl md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 items-center gap-2">
            <div className="relative group flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-[var(--text-secondary)] opacity-30 group-focus-within:opacity-100 group-focus-within:text-[var(--accent)] transition-all" />
              <input
                type="text"
                placeholder="Search identity..."
                className="w-full h-12 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl pl-11 pr-4 !text-base placeholder:text-[11px] placeholder:font-normal font-semibold tracking-tight text-[var(--text-primary)] outline-none focus:border-[var(--accent)]/50 transition-all"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') setCurrentPage(1); }}
              />
            </div>
            <button
              onClick={() => setCurrentPage(1)}
              className="h-12 rounded-2xl bg-[var(--accent)] px-4 text-[11px] font-bold tracking-tight text-white shadow-lg shadow-[var(--accent)]/20 active:scale-95 transition-all"
            >
              Search
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={toggleSelectAll}
              className="h-10 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-3 text-[10px] font-bold tracking-tight text-[var(--text-secondary)] transition-all hover:border-[var(--accent)]/40 hover:text-[var(--text-primary)]"
            >
              {currentUsers.length > 0 && currentUsers.every(u => selectedIds.includes(u._id)) ? 'Clear page' : 'Select page'}
            </button>
            <div className="flex rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] p-1">
              <button
                onClick={() => setViewMode('cards')}
                className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-[10px] font-bold tracking-tight transition-all ${viewMode === 'cards' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)]'}`}
              >
                <LayoutGrid className="size-3" />
                Cards
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-[10px] font-bold tracking-tight transition-all ${viewMode === 'table' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)]'}`}
              >
                <List className="size-3" />
                Table
              </button>
            </div>
          </div>
        </div>

        {loading ? (
           <LoadingSpinner />
        ) : (
           <div className="space-y-3 min-h-[600px]">
              {viewMode === 'cards' ? currentUsers.map(u => (
                <div key={u._id} className={`group relative rounded-[2rem] border shadow-sm hover:shadow-2xl transition-all duration-500 overflow-hidden hover:-translate-y-1 backdrop-blur-xl flex flex-col p-4 md:p-6 ${
                  selectedIds.includes(u._id)
                    ? 'bg-[var(--accent)]/5 border-[var(--accent)]/60'
                    : 'bg-[var(--bg-primary)]/40 border-[var(--glass-border)]'
                }`}>
                  <div className="flex items-center gap-4 md:gap-6 flex-1 min-w-0">
                    <button
                      onClick={() => toggleSelect(u._id)}
                      className={`size-8 rounded-xl border flex items-center justify-center transition-all shrink-0 ${
                        selectedIds.includes(u._id)
                          ? 'bg-[var(--accent)] border-[var(--accent)] text-white shadow-lg'
                          : 'bg-[var(--bg-secondary)] border-[var(--glass-border)] text-transparent hover:text-[var(--text-secondary)]'
                      }`}
                      aria-label={`Select ${u.name || u.email}`}
                    >
                      <CheckCircle className="size-4" />
                    </button>
                    <div className="size-12 md:size-14 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center overflow-hidden shrink-0 shadow-inner group-hover:scale-105 transition-transform duration-500">
                      {u.avatar ? <img src={u.avatar} className="size-full object-cover" /> : <User className="size-6 md:size-7 opacity-20" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <p className="text-[12px] md:text-sm font-bold tracking-tight truncate text-[var(--text-primary)]">{u.name}</p>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] md:text-[10px] font-bold tracking-widest border uppercase shrink-0 ${u.role === 'admin' ? 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20' : u.role === 'vendor' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-blue-500/10 text-blue-500 border-blue-500/20'}`}>
                          {u.role}
                        </span>
                      </div>
                      <p className="text-[10px] md:text-[11px] font-semibold text-[var(--text-secondary)] opacity-40 truncate mt-0.5 tracking-tight">{u.email}</p>
                    </div>
                    
                    <div className="hidden md:flex flex-col items-end">
                       <div className="flex items-center gap-2">
                          <div className={`size-1.5 rounded-full ${u.verification_status === 'verified' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-amber-500 shadow-[0_0_8px_#f59e0b]'}`} />
                          <span className="text-[10px] font-bold tracking-widest opacity-60 uppercase">{u.verification_status || 'Pending'}</span>
                       </div>
                       <p className="text-[9px] font-bold text-[var(--text-secondary)] opacity-20 mt-0.5 tracking-widest uppercase">Node Status</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-[var(--glass-border)]/50 md:mt-6 md:pt-6">
                     <div className="md:hidden flex flex-col">
                        <div className="flex items-center gap-2">
                           <div className={`size-1.5 rounded-full ${u.verification_status === 'verified' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-amber-500 shadow-[0_0_8px_#f59e0b]'}`} />
                           <span className="text-[10px] font-bold tracking-widest opacity-60 uppercase">{u.verification_status || 'Pending'}</span>
                        </div>
                        <p className="text-[9px] font-bold text-[var(--text-secondary)] opacity-20 mt-0.5 tracking-widest uppercase">Node Status</p>
                     </div>
                     <div className="flex items-center gap-2 ml-auto">
                        <button onClick={() => handleEditClick(u)} className="size-10 md:size-11 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)]/40 transition-all active:scale-90 shadow-sm">
                           <Activity className="size-4 md:size-5" />
                        </button>
                        <button onClick={() => handleDeleteUser(u._id, u.name)} className="size-10 md:size-11 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all active:scale-90 shadow-sm">
                           <Trash2 className="size-4 md:size-5" />
                        </button>
                     </div>
                  </div>
                </div>
              )) : (
                <div className="overflow-hidden rounded-[2rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/60 shadow-sm backdrop-blur-xl">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[860px] text-left">
                      <thead className="border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/50">
                        <tr>
                          <th className="w-14 px-5 py-4">
                            <button
                              onClick={toggleSelectAll}
                              className={`size-6 rounded-lg border flex items-center justify-center transition-all ${
                                currentUsers.length > 0 && currentUsers.every(u => selectedIds.includes(u._id))
                                  ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
                                  : 'border-[var(--glass-border)] bg-[var(--bg-primary)] text-transparent'
                              }`}
                            >
                              <CheckCircle className="size-3.5" />
                            </button>
                          </th>
                          <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] opacity-50">User</th>
                          <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] opacity-50">Email</th>
                          <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] opacity-50">Role</th>
                          <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] opacity-50">Status</th>
                          <th className="px-4 py-4 text-right text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] opacity-50">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--glass-border)]/60">
                        {currentUsers.map(u => (
                          <tr key={u._id} className={`${selectedIds.includes(u._id) ? 'bg-[var(--accent)]/5' : 'hover:bg-[var(--bg-secondary)]/30'} transition-colors`}>
                            <td className="px-5 py-4">
                              <button
                                onClick={() => toggleSelect(u._id)}
                                className={`size-6 rounded-lg border flex items-center justify-center transition-all ${
                                  selectedIds.includes(u._id)
                                    ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
                                    : 'border-[var(--glass-border)] bg-[var(--bg-secondary)] text-transparent hover:text-[var(--text-secondary)]'
                                }`}
                              >
                                <CheckCircle className="size-3.5" />
                              </button>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-3">
                                <div className="size-10 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center overflow-hidden shrink-0">
                                  {u.avatar ? <img src={u.avatar} className="size-full object-cover" /> : <User className="size-5 opacity-20" />}
                                </div>
                                <span className="max-w-[220px] truncate text-sm font-bold tracking-tight">{u.name || 'Unnamed user'}</span>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-[11px] font-semibold text-[var(--text-secondary)]">{u.email}</td>
                            <td className="px-4 py-4">
                              <span className={`px-2 py-1 rounded-full text-[9px] font-bold tracking-widest border uppercase ${u.role === 'admin' ? 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20' : u.role === 'vendor' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-blue-500/10 text-blue-500 border-blue-500/20'}`}>
                                {u.role}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                                <span className={`size-1.5 rounded-full ${u.verification_status === 'verified' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                {u.verification_status || 'Pending'}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex justify-end gap-2">
                                <button onClick={() => handleEditClick(u)} className="size-9 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)]/40 transition-all">
                                  <Activity className="size-4" />
                                </button>
                                <button onClick={() => handleDeleteUser(u._id, u.name)} className="size-9 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all">
                                  <Trash2 className="size-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="pt-12 flex justify-center">
                <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
              </div>

              {filteredUsers.length === 0 && (
                 <div className="py-20 text-center border border-dashed border-[var(--glass-border)] rounded-[3rem] opacity-20 flex flex-col items-center justify-center gap-4">
                    <Users className="size-12 opacity-10" />
                    <p className="text-[10px] font-bold tracking-[0.2em] uppercase">No identity nodes synchronized</p>
                 </div>
              )}
           </div>
        )}
      </div>

      {/* Edit Modal - Surgical Alignment */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-36 md:bottom-28 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 items-center justify-between gap-4 rounded-full border border-[var(--accent)]/30 bg-[var(--bg-primary)]/85 px-5 py-4 shadow-[0_25px_60px_rgba(0,0,0,0.4)] backdrop-blur-2xl md:px-8"
          >
            <div className="flex flex-col">
              <span className="text-[11px] font-semibold tracking-tight text-[var(--accent)]">Batch Selection</span>
              <span className="text-sm font-bold">{selectedIds.length} Identity Nodes</span>
            </div>

            <div className="flex items-center gap-2 md:gap-4">
              <button
                onClick={() => setSelectedIds([])}
                className="px-4 py-2 rounded-xl text-[11px] font-semibold tracking-tight hover:bg-[var(--bg-secondary)] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="px-5 md:px-7 py-3 rounded-full bg-rose-500 text-white text-[11px] font-semibold tracking-tight hover:bg-rose-600 transition-all flex items-center gap-2 shadow-lg shadow-rose-500/30 disabled:opacity-50"
              >
                {bulkDeleting ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
                Purge
              </button>
            </div>
          </motion.div>
        )}

        {editingUser && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setEditingUser(null)} />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="relative w-full max-w-md bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-[2.5rem] p-6 md:p-8 shadow-2xl">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="size-11 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] border border-[var(--accent)]/20 shadow-inner">
                    <Activity className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-sm md:text-base font-bold tracking-tight">Node Calibrator</h3>
                    <p className="text-[10px] md:text-[11px] font-bold text-[var(--text-secondary)] opacity-40 uppercase tracking-widest mt-0.5">Surgical Identity Override</p>
                  </div>
                </div>
                <button onClick={() => setEditingUser(null)} className="p-2 rounded-xl hover:bg-[var(--bg-secondary)] transition-all text-[var(--text-secondary)]"><X className="size-5" /></button>
              </div>

              <form onSubmit={handleEditSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold tracking-widest opacity-40 uppercase ml-1">Alias</p>
                    <input type="text" value={editForm.name} onChange={e=>setEditForm(f=>({...f,name:e.target.value}))} className="w-full h-12 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl px-4 text-xs font-bold outline-none focus:border-[var(--accent)] transition-all shadow-inner" placeholder="Name" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold tracking-widest opacity-40 uppercase ml-1">Matrix Role</p>
                    <select value={editForm.role} onChange={e=>setEditForm(f=>({...f,role:e.target.value}))} className="w-full h-12 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl px-4 text-[11px] font-bold tracking-tight outline-none appearance-none cursor-pointer focus:border-[var(--accent)] shadow-inner">
                      <option value="customer">Customer</option>
                      <option value="vendor">Vendor</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] font-bold tracking-widest opacity-40 uppercase ml-1">Identity Email</p>
                  <input type="email" value={editForm.email} onChange={e=>setEditForm(f=>({...f,email:e.target.value}))} className="w-full h-12 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl px-4 text-xs font-bold outline-none focus:border-[var(--accent)] transition-all shadow-inner" placeholder="email@example.com" />
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] font-bold tracking-widest opacity-40 uppercase ml-1">Signal Phone</p>
                  <input type="tel" value={editForm.phone} onChange={e=>setEditForm(f=>({...f,phone:e.target.value}))} className="w-full h-12 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl px-4 text-xs font-bold outline-none focus:border-[var(--accent)] transition-all shadow-inner" placeholder="+237..." />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold tracking-widest opacity-40 uppercase ml-1">Node Status</p>
                    <select value={editForm.verification_status} onChange={e=>setEditForm(f=>({...f,verification_status:e.target.value}))} className="w-full h-12 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl px-4 text-[11px] font-bold tracking-tight outline-none appearance-none cursor-pointer focus:border-[var(--accent)] shadow-inner">
                      <option value="unverified">Unverified</option>
                      <option value="held">Verification Required</option>
                      <option value="pending">Pending Review</option>
                      <option value="verified">Verified</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                  {false && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold tracking-widest opacity-40 uppercase ml-1">Cipher Override</p>
                    <PasswordInput
                      value={editForm.password}
                      onChange={e => setEditForm(f => ({ ...f, password: e.target.value }))}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      className="w-full h-12 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl px-4 pr-12 text-xs font-bold outline-none focus:border-[var(--accent)] transition-all shadow-inner"
                    />
                  </div>
                  )}
                </div>

                <div className="pt-4">
                  {editForm.role !== 'admin' && (
                    <button
                      type="button"
                      onClick={handleRequestVerification}
                      disabled={submitting || editForm.verification_status === 'held'}
                      className="mb-3 w-full h-12 rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-500 font-bold text-[11px] uppercase tracking-[0.16em] transition-all hover:bg-amber-500 hover:text-white disabled:opacity-50"
                    >
                      Request User Verification
                    </button>
                  )}
                  <button type="submit" disabled={submitting} className="w-full h-14 bg-[var(--accent)] text-white rounded-2xl font-bold text-xs uppercase tracking-[0.2em] shadow-lg shadow-[var(--accent)]/20 active:scale-95 transition-all">
                    {submitting ? (
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="size-4 animate-spin" />
                        <span>Recalibrating...</span>
                      </div>
                    ) : (
                      'Update Identity Node'
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

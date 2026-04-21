"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { User, Shield, ShieldAlert, Mail, Search, Filter, Loader2, Ban, CheckCircle, MoreVertical, X, Phone, Trash2 } from 'lucide-react';
import api from '@/services/api';
import { useAuthStore } from '@/hooks/useAuth';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

import Pagination from '@/components/common/Pagination';

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', role: '', verification_status: '', password: '' });
  const [submitting, setSubmitting] = useState(false);

  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const { user } = useAuthStore();

  useEffect(() => {
    fetchUsers();
    setCurrentPage(1);
    setSelectedIds([]); // Reset selection on filter change
  }, [roleFilter]);

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === currentUsers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(currentUsers.map(u => u._id));
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Are you sure you want to PURGE ${selectedIds.length} selected users? This is IRREVERSIBLE.`)) return;
    setBulkDeleting(true);
    try {
      const res = await api.post('/admin/users/bulk-delete', { ids: selectedIds });
      if (res.data.success) {
        toast.success(res.data.message);
        setUsers(prev => prev.filter(u => !selectedIds.includes(u._id)));
        setSelectedIds([]);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk purge failed');
    } finally {
      setBulkDeleting(false);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/users?role=${roleFilter === 'all' ? '' : roleFilter}`);
      if (res.data?.success) setUsers(res.data.data.users || []);
    } catch (err) {
      toast.error('Failed to fetch user directory');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (userId, status) => {
    try {
      const res = await api.patch(`/admin/users/${userId}/status`, { status });
      if (res.data.success) {
        toast.success(`User status updated to ${status}`);
        setUsers(prev => prev.map(u => u._id === userId ? { ...u, verification_status: status } : u));
      }
    } catch (err) {
      toast.error('Status shift failed');
    }
  };

  const filteredUsers = users.filter(u => 
    u.name?.toLowerCase().includes(search.toLowerCase()) || 
    u.email?.toLowerCase().includes(search.toLowerCase())
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
      verification_status: user.verification_status || 'unverified',
      password: ''
    });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = { ...editForm };
      if (!payload.password) delete payload.password;
      
      const res = await api.patch(`/admin/users/${editingUser._id}`, payload);
      if (res.data.success) {
        toast.success('User updated successfully');
        setUsers(users.map(u => u._id === editingUser._id ? { ...u, ...res.data.data.user } : u));
        setEditingUser(null);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    if (!window.confirm(`Are you absolutely sure you want to PURGE ${userName}? This action is irreversible and will delete associated business data.`)) return;
    
    try {
      const res = await api.delete(`/admin/users/${userId}`);
      if (res.data.success) {
        toast.success(`${userName} has been removed from the platform.`);
        setUsers(prev => prev.filter(u => u._id !== userId));
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Purge failed. Node remains active.');
    }
  };

  return (
    <>
      <header className="h-20 flex items-center justify-between px-6 lg:px-10 border-b border-[var(--glass-border)] bg-[var(--bg-primary)] backdrop-blur-xl shrink-0 z-10 text-[var(--text-primary)]">
        <div className="flex items-center gap-4 lg:gap-6">
          <div className="flex items-center gap-3">
             <button 
               onClick={toggleSelectAll}
               className={`size-5 rounded-lg border flex items-center justify-center transition-all ${selectedIds.length === currentUsers.length && currentUsers.length > 0 ? 'bg-[var(--accent)] border-[var(--accent)] text-white shadow-lg' : 'border-[var(--glass-border)] bg-[var(--bg-secondary)]'}`}
             >
                {selectedIds.length === currentUsers.length && currentUsers.length > 0 && <CheckCircle className="size-3" />}
             </button>
             <h2 className="text-lg lg:text-xl font-black text-[var(--text-primary)] tracking-tight uppercase">User <span className="text-[var(--accent)]">Directory</span></h2>
          </div>
          <div className="hidden sm:block h-4 w-px bg-[var(--glass-border)] opacity-30" />
          <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-[var(--bg-secondary)] rounded-xl border border-[var(--glass-border)]">
            <Search className="size-3.5 text-[var(--text-secondary)] opacity-40" />
            <input
              type="text"
              placeholder="Find node..."
              className="bg-transparent border-none outline-none text-[9px] font-black uppercase tracking-widest w-48 text-[var(--text-primary)]"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            />
          </div>
        </div>

        <div className="flex items-center gap-3 lg:gap-4">
           <div className="flex bg-[var(--bg-secondary)] p-1 rounded-xl border border-[var(--glass-border)]">
              {['all', 'customer', 'vendor', 'admin'].map((r) => (
                <button
                  key={r}
                  onClick={() => setRoleFilter(r)}
                  className={`px-3 lg:px-4 py-1.5 rounded-lg text-[8px] lg:text-[9px] font-black uppercase tracking-widest transition-all ${roleFilter === r ? 'bg-[var(--accent)] text-white shadow-lg' : 'text-[var(--text-secondary)] hover:bg-[var(--accent)]/5'}`}
                >
                  {r}
                </button>
              ))}
           </div>
        </div>
      </header>

      <div className="p-4 lg:p-10 space-y-8 lg:space-y-12 pb-32">
        {/* Mobile Search */}
        <div className="md:hidden flex items-center gap-2 px-4 py-3 bg-[var(--bg-secondary)] rounded-xl border border-[var(--glass-border)]">
          <Search className="size-3.5 text-[var(--text-secondary)] opacity-40" />
          <input
            type="text"
            placeholder="Search stores..."
            className="bg-transparent border-none outline-none text-[9px] font-black uppercase tracking-widest w-full text-[var(--text-primary)]"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
          />
        </div>

        {loading ? (
           <div className="py-20 flex flex-col items-center justify-center opacity-40">
              <Loader2 className="size-10 animate-spin text-[var(--accent)] mb-4" />
              <p className="text-[9px] font-black uppercase tracking-[0.4em]">Accessing Identity Vault...</p>
           </div>
        ) : (
           <div className="grid grid-cols-1 gap-4 min-h-[600px]">
              {currentUsers.map(u => (
                <div key={u._id} className={`group p-4 lg:p-6 glass-panel border rounded-[24px] lg:rounded-[32px] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 lg:gap-8 hover:shadow-xl ${selectedIds.includes(u._id) ? 'bg-[var(--accent)]/5 border-[var(--accent)]' : 'border-[var(--glass-border)] bg-[var(--bg-primary)]/50 hover:border-[var(--accent)]/30'}`}>
                  <div className="flex items-center gap-4 lg:gap-6">
                    <button 
                      onClick={() => toggleSelect(u._id)}
                      className={`size-6 lg:size-8 rounded-xl border flex items-center justify-center transition-all ${selectedIds.includes(u._id) ? 'bg-[var(--accent)] border-[var(--accent)] text-white' : 'border-[var(--glass-border)] bg-[var(--bg-secondary)] opacity-20 group-hover:opacity-100'}`}
                    >
                       {selectedIds.includes(u._id) && <CheckCircle className="size-4" />}
                    </button>
                    <div className="size-12 lg:size-16 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                      {u.avatar ? <img src={u.avatar} className="size-full object-cover" alt="" /> : <User className="size-6 opacity-20" />}
                    </div>
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 lg:gap-3 flex-wrap">
                        <h4 className="text-base lg:text-lg font-black tracking-tight truncate">{u.name}</h4>
                        <span className={`px-2 lg:px-3 py-0.5 lg:py-1 rounded-full text-[7px] lg:text-[8px] font-black uppercase tracking-widest border ${u.role === 'admin' ? 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20 shadow-[0_0_10px_#6366f111]' : u.role === 'vendor' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20 shadow-[0_0_10px_#f59e0b11]' : 'bg-blue-500/10 text-blue-500 border-blue-500/20 shadow-[0_0_10px_#3b82f611]'}`}>
                          {u.role}
                        </span>
                      </div>
                      <p className="text-[10px] font-bold text-[var(--text-secondary)] opacity-60 flex items-center gap-2 truncate">
                        <Mail className="size-3 shrink-0" /> {u.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 lg:gap-10 border-t sm:border-t-0 pt-4 sm:pt-0 mt-4 sm:mt-0 border-[var(--glass-border)]/20">
                     <div className="text-left sm:text-right">
                        <p className="text-[8px] lg:text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-40 mb-1">Status</p>
                        <div className="flex items-center gap-2">
                           <div className={`size-1.5 lg:size-2 rounded-full ${u.verification_status === 'verified' ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : u.verification_status === 'rejected' ? 'bg-rose-500 shadow-[0_0_10px_#f43f5e]' : u.verification_status === 'held' ? 'bg-amber-600 shadow-[0_0_10px_#d97706]' : 'bg-amber-400 shadow-[0_0_10px_#fbbf24]'}`} />
                           <span className="text-[9px] lg:text-[10px] font-black uppercase tracking-widest">{u.verification_status?.replace('_', ' ') || 'Pending'}</span>
                        </div>
                     </div>

                     <div className="flex items-center gap-2 lg:gap-3">
                        {u.verification_status === 'verified' ? (
                          <button 
                            onClick={() => handleStatusUpdate(u._id, 'held')}
                            className="size-10 lg:size-12 rounded-xl bg-amber-600/10 text-amber-600 flex items-center justify-center hover:bg-amber-600 hover:text-white transition-all shadow-sm border border-amber-600/20"
                            title="Hold Node"
                          >
                            <ShieldAlert className="size-4 lg:size-5" />
                          </button>
                        ) : (
                          <button 
                            onClick={() => handleStatusUpdate(u._id, 'verified')}
                            className="size-10 lg:size-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center hover:bg-emerald-500 hover:text-white transition-all shadow-sm border border-emerald-500/20"
                            title="Verify Node"
                          >
                            <CheckCircle className="size-4 lg:size-5" />
                          </button>
                        )}
                        <button 
                         onClick={() => handleEditClick(u)}
                         className="size-10 lg:size-12 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent)] transition-all hover:shadow-md"
                         title="Advanced Config"
                        >
                           <MoreVertical className="size-4 lg:size-5" />
                        </button>
                        <button 
                          onClick={() => handleDeleteUser(u._id, u.name)}
                          className="size-10 lg:size-12 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all hover:shadow-md"
                          title="Purge Node"
                         >
                            <Trash2 className="size-4 lg:size-5" />
                         </button>
                     </div>
                  </div>
                </div>
              ))}

              <Pagination 
                currentPage={currentPage} 
                totalPages={totalPages} 
                onPageChange={setCurrentPage} 
              />


              {filteredUsers.length === 0 && (
                 <div className="py-20 text-center opacity-30">
                    <ShieldAlert className="size-16 mx-auto mb-4" />
                    <p className="text-xs font-black uppercase tracking-widest">No matching identity nodes found</p>
                 </div>
              )}
           </div>
        )}
      </div>
      {/* BULK ACTION BAR */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-6 px-8 py-4 bg-[var(--bg-primary)]/80 backdrop-blur-2xl border border-[var(--accent)]/30 rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.3)] min-w-[320px] justify-between"
          >
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--accent)]">Selection Active</span>
              <span className="text-sm font-black">{selectedIds.length} Identity Nodes</span>
            </div>

            <div className="flex items-center gap-3">
              <button 
                onClick={() => setSelectedIds([])}
                className="px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-[var(--bg-secondary)] transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="px-6 py-3 rounded-full bg-rose-500 text-white text-[9px] font-black uppercase tracking-widest hover:bg-rose-600 transition-all flex items-center gap-2 shadow-lg shadow-rose-500/20 disabled:opacity-50"
              >
                {bulkDeleting ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
                Purge Selected
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between p-6 border-b border-[var(--glass-border)]">
              <h3 className="text-xl font-black uppercase tracking-tight">Edit <span className="text-[var(--accent)]">Node</span></h3>
              <button onClick={() => setEditingUser(null)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                <X className="size-5" />
              </button>
            </div>
            
            <form onSubmit={handleEditSubmit} className="p-6 space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">Name</label>
                <input 
                  type="text" 
                  value={editForm.name}
                  onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl px-4 py-3 text-sm focus:border-[var(--accent)] outline-none transition-colors"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">Phone Number</label>
                <input 
                  type="text" 
                  value={editForm.phone}
                  onChange={(e) => setEditForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="+2376..."
                  className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl px-4 py-3 text-sm focus:border-[var(--accent)] outline-none transition-colors"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">Email Address</label>
                <input 
                  type="email" 
                  value={editForm.email}
                  onChange={(e) => setEditForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl px-4 py-3 text-sm focus:border-[var(--accent)] outline-none transition-colors"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">Role Definition</label>
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm(f => ({ ...f, role: e.target.value }))}
                    className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl px-4 py-3 text-sm focus:border-[var(--accent)] outline-none transition-colors appearance-none"
                  >
                    <option value="customer">Customer</option>
                    <option value="vendor">Vendor</option>
                    <option value="logistics">Logistics</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">Verification State</label>
                  <select
                    value={editForm.verification_status}
                    onChange={(e) => setEditForm(f => ({ ...f, verification_status: e.target.value }))}
                    className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl px-4 py-3 text-sm focus:border-[var(--accent)] outline-none transition-colors appearance-none"
                  >
                    <option value="unverified">Unverified</option>
                    <option value="pending">Pending</option>
                    <option value="verified">Verified</option>
                    <option value="rejected">Rejected</option>
                    <option value="held">Held</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Override Password</label>
                <input 
                  type="password" 
                  placeholder="Leave blank to keep current password"
                  value={editForm.password}
                  onChange={(e) => setEditForm(f => ({ ...f, password: e.target.value }))}
                  className="w-full bg-emerald-500/5 border border-emerald-500/20 rounded-xl px-4 py-3 text-sm focus:border-emerald-500 outline-none transition-colors placeholder:text-emerald-500/30"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setEditingUser(null)}
                  className="px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="px-6 py-3 rounded-xl bg-[var(--accent)] text-white text-xs font-black uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {submitting && <Loader2 className="size-4 animate-spin" />}
                  Save Identity
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}


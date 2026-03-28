"use client";

import { useState, useEffect } from 'react';
import { User, Shield, ShieldAlert, Mail, Search, Filter, Loader2, Ban, CheckCircle, MoreVertical, X, Phone } from 'lucide-react';
import api from '@/services/api';
import { toast } from 'react-hot-toast';

export const dynamic = 'force-dynamic';

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', role: '', verification_status: '', password: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, [roleFilter]);

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

  return (
    <>
      <header className="h-20 flex items-center justify-between px-6 lg:px-10 border-b border-[var(--nav-border)] bg-[var(--nav-bg)] backdrop-blur-xl shrink-0 z-10 text-[var(--nav-text)]">
        <div className="flex items-center gap-4 lg:gap-6">
          <h2 className="text-lg lg:text-xl font-black text-[var(--text-primary)] tracking-tight uppercase">User <span className="text-[var(--accent)]">Directory</span></h2>
          <div className="hidden sm:block h-4 w-px bg-[var(--glass-border)] opacity-30" />
          <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-[var(--bg-secondary)] rounded-xl border border-[var(--glass-border)]">
            <Search className="size-3.5 text-[var(--text-secondary)] opacity-40" />
            <input
              type="text"
              placeholder="Find node..."
              className="bg-transparent border-none outline-none text-[9px] font-black uppercase tracking-widest w-48"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
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

      <div className="p-4 lg:p-6 space-y-6 pb-32">
        {/* Mobile Search */}
        <div className="md:hidden flex items-center gap-2 px-4 py-3 bg-[var(--bg-secondary)] rounded-xl border border-[var(--glass-border)]">
          <Search className="size-3.5 text-[var(--text-secondary)] opacity-40" />
          <input
            type="text"
            placeholder="Search stores..."
            className="bg-transparent border-none outline-none text-[9px] font-black uppercase tracking-widest w-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
           <div className="py-20 flex flex-col items-center justify-center opacity-40">
              <Loader2 className="size-10 animate-spin text-[var(--accent)] mb-4" />
              <p className="text-[9px] font-black uppercase tracking-[0.4em]">Accessing Identity Vault...</p>
           </div>
        ) : (
           <div className="grid grid-cols-1 gap-4">
              {filteredUsers.map(u => (
                <div key={u._id} className="group p-4 lg:p-6 glass-panel border border-[var(--glass-border)] hover:border-[var(--accent)]/30 rounded-[24px] lg:rounded-[32px] bg-[var(--bg-primary)]/50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 lg:gap-8 hover:shadow-xl">
                  <div className="flex items-center gap-4 lg:gap-6">
                    <div className="size-12 lg:size-16 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                      {u.avatar ? <img src={u.avatar} className="size-full object-cover" alt="" /> : <User className="size-6 opacity-20" />}
                    </div>
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 lg:gap-3 flex-wrap">
                        <h4 className="text-base lg:text-lg font-black tracking-tight truncate">{u.name}</h4>
                        <span className={`px-2 lg:px-3 py-0.5 lg:py-1 rounded-full text-[7px] lg:text-[8px] font-black uppercase tracking-widest border ${u.role === 'admin' ? 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20 shadow-[0_0_10px_#6366f111]' : u.role === 'vendor' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20 shadow-[0_0_10px_#f59e0b11]' : 'bg-blue-500/10 text-blue-500 border-blue-500/20 shadow-[0_0_10px_#3b82f611]'}`}>
                          {u.role}
                        </span>
                      </div>
                      <p className="text-[10px] font-bold text-[var(--text-secondary)] opacity-60 flex items-center gap-2 truncate">
                        <Mail className="size-3 shrink-0" /> {u.email}
                      </p>
                      <p className="text-[10px] font-bold text-[var(--accent)] flex items-center gap-2 truncate">
                        <Phone className="size-3 shrink-0" /> {u.phone || 'NO PHONE ATTACHED'}
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
                     </div>
                  </div>
                </div>
              ))}

              {filteredUsers.length === 0 && (
                 <div className="py-20 text-center opacity-30">
                    <ShieldAlert className="size-16 mx-auto mb-4" />
                    <p className="text-xs font-black uppercase tracking-widest">No matching identity nodes found</p>
                 </div>
              )}
           </div>
        )}
      </div>
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


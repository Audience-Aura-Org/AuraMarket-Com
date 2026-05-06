"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { 
  User, Shield, ShieldAlert, Mail, Search, 
  Filter, Loader2, Ban, CheckCircle, MoreVertical, 
  X, Phone, Trash2, Users, ArrowUpRight, 
  ChevronRight, Activity, RefreshCw 
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
  const itemsPerPage = 12;

  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', role: '', verification_status: '', password: '' });
  const [submitting, setSubmitting] = useState(false);

  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const { user } = useAuthStore();

  useEffect(() => {
    fetchUsers();
    setCurrentPage(1);
    setSelectedIds([]);
  }, [roleFilter]);

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
        toast.success('Identity Recalibrated');
        setUsers(users.map(u => u._id === editingUser._id ? { ...u, ...res.data.data.user } : u));
        setEditingUser(null);
      }
    } catch (err) { toast.error('Recalibration failed'); } finally { setSubmitting(false); }
  };

  return (
    <div className="w-full min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] font-display">
      
      {/* Surgical Header */}
      <header className="min-h-20 py-4 flex flex-col md:flex-row md:h-24 items-center justify-between px-4 md:px-10 border-b border-[var(--glass-border)] bg-[var(--bg-primary)]/80 backdrop-blur-xl sticky top-0 md:top-16 z-40 gap-4 md:gap-0">
        <div className="flex items-center gap-4 md:gap-6 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-4">
            <div className="size-10 md:size-12 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] shadow-inner border border-[var(--accent)]/20 shrink-0">
               <Users className="w-5 h-5 md:w-6 md:h-6" />
            </div>
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
        {/* Search Bar Mobile */}
        <div className="md:hidden relative group">
           <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-[var(--text-secondary)] opacity-30 group-focus-within:opacity-100 group-focus-within:text-[var(--accent)] transition-all" />
           <input 
             type="text"
             placeholder="Search Identity..."
             className="w-full h-12 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl pl-11 pr-4 text-[11px] lg:text-[12px] font-semibold tracking-tight text-[var(--text-primary)] outline-none focus:border-[var(--accent)]/50 transition-all"
             value={search}
             onChange={e => setSearch(e.target.value)}
           />
        </div>

        {loading ? (
           <LoadingSpinner />
        ) : (
           <div className="space-y-3 min-h-[600px]">
              {currentUsers.map(u => (
                <div key={u._id} className="group relative rounded-[2rem] bg-[var(--bg-primary)]/40 border border-[var(--glass-border)] shadow-sm hover:shadow-2xl transition-all duration-500 overflow-hidden hover:-translate-y-1 backdrop-blur-xl flex flex-col p-4 md:p-6">
                  <div className="flex items-center gap-4 md:gap-6 flex-1 min-w-0">
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
              ))}

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
                      <option value="verified">Verified</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold tracking-widest opacity-40 uppercase ml-1">Cipher Override</p>
                    <input type="password" value={editForm.password} onChange={e=>setEditForm(f=>({...f,password:e.target.value}))} className="w-full h-12 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl px-4 text-xs font-bold outline-none focus:border-[var(--accent)] transition-all shadow-inner" placeholder="••••••••" />
                  </div>
                </div>

                <div className="pt-4">
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

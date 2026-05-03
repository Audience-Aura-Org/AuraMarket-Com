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
      <div className="px-6 py-6 border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/10 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 border border-blue-500/20">
              <Users className="size-5" />
            </div>
            <div>
              <h1 className="text-lg font-black uppercase tracking-tight">Identity Matrix</h1>
              <p className="text-[9px] font-bold text-[var(--text-secondary)] opacity-40 uppercase tracking-widest">Global Personnel Directory</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-[var(--bg-secondary)] rounded-xl border border-[var(--glass-border)]">
              <Search className="size-3.5 text-[var(--text-secondary)] opacity-40" />
              <input
                type="text"
                placeholder="FIND NODE..."
                className="bg-transparent border-none outline-none text-[9px] font-black uppercase tracking-widest w-48 text-[var(--text-primary)]"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              />
            </div>
            <div className="flex bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl p-0.5">
              {['all', 'customer', 'vendor', 'admin'].map(r => (
                <button
                  key={r} onClick={() => setRoleFilter(r)}
                  className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${roleFilter === r ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)] opacity-40'}`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 md:p-8 space-y-4 max-w-[1600px] mx-auto">
        
        {loading ? (
           <LoadingSpinner />
        ) : (
           <div className="space-y-2 min-h-[600px]">
              {currentUsers.map(u => (
                <div key={u._id} className="flex items-center gap-4 p-3 rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] hover:border-[var(--accent)]/30 transition-all group">
                  <div className="size-11 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                    {u.avatar ? <img src={u.avatar} className="size-full object-cover" /> : <User className="size-5 opacity-20" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <p className="text-[11px] font-black uppercase truncate">{u.name}</p>
                      <span className={`px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest border ${u.role === 'admin' ? 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20' : u.role === 'vendor' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-blue-500/10 text-blue-500 border-blue-500/20'}`}>
                        {u.role}
                      </span>
                    </div>
                    <p className="text-[9px] font-bold text-[var(--text-secondary)] opacity-40 truncate uppercase mt-0.5">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-8">
                     <div className="text-right">
                        <div className="flex items-center gap-2 justify-end">
                           <div className={`size-1.5 rounded-full ${u.verification_status === 'verified' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-amber-500 shadow-[0_0_8px_#f59e0b]'}`} />
                           <span className="text-[9px] font-black uppercase tracking-widest opacity-60">{u.verification_status || 'Pending'}</span>
                        </div>
                        <p className="text-[8px] font-black text-[var(--text-secondary)] opacity-20 uppercase mt-0.5 tracking-widest">Node Status</p>
                     </div>
                     <div className="flex items-center gap-2">
                        <button onClick={() => handleEditClick(u)} className="size-9 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent)] transition-all">
                           <MoreVertical className="size-4" />
                        </button>
                        <button onClick={() => handleDeleteUser(u._id, u.name)} className="size-9 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all">
                           <Trash2 className="size-4" />
                        </button>
                     </div>
                  </div>
                </div>
              ))}

              <div className="pt-8 flex justify-center">
                <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
              </div>

              {filteredUsers.length === 0 && (
                 <div className="py-20 text-center border border-dashed border-[var(--glass-border)] rounded-[2rem] opacity-20">
                    <p className="text-xs font-black uppercase tracking-widest">No identity nodes synchronized</p>
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
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-md bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-[2.5rem] p-8 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)]">
                    <Activity className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-tight">Node Calibrator</h3>
                    <p className="text-[8px] font-bold text-[var(--text-secondary)] opacity-40 uppercase tracking-widest">Surgical Identity Override</p>
                  </div>
                </div>
                <button onClick={() => setEditingUser(null)} className="p-2 rounded-full hover:bg-[var(--bg-secondary)] transition-all"><X className="size-4 opacity-40" /></button>
              </div>

              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-[9px] font-black uppercase tracking-widest opacity-40">Alias</p>
                    <input type="text" value={editForm.name} onChange={e=>setEditForm(f=>({...f,name:e.target.value}))} className="w-full h-11 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl px-4 text-xs font-bold outline-none focus:border-[var(--accent)] transition-all" placeholder="Name" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] font-black uppercase tracking-widest opacity-40">Matrix Role</p>
                    <select value={editForm.role} onChange={e=>setEditForm(f=>({...f,role:e.target.value}))} className="w-full h-11 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl px-4 text-[10px] font-black uppercase tracking-widest outline-none appearance-none cursor-pointer">
                      <option value="customer">Customer</option>
                      <option value="vendor">Vendor</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-[9px] font-black uppercase tracking-widest opacity-40">Identity Email</p>
                  <input type="email" value={editForm.email} onChange={e=>setEditForm(f=>({...f,email:e.target.value}))} className="w-full h-11 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl px-4 text-xs font-bold outline-none focus:border-[var(--accent)] transition-all" placeholder="email@example.com" />
                </div>

                <div className="space-y-1">
                  <p className="text-[9px] font-black uppercase tracking-widest opacity-40">Signal Phone</p>
                  <input type="tel" value={editForm.phone} onChange={e=>setEditForm(f=>({...f,phone:e.target.value}))} className="w-full h-11 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl px-4 text-xs font-bold outline-none focus:border-[var(--accent)] transition-all" placeholder="+237..." />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-[9px] font-black uppercase tracking-widest opacity-40">Node Status</p>
                    <select value={editForm.verification_status} onChange={e=>setEditForm(f=>({...f,verification_status:e.target.value}))} className="w-full h-11 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl px-4 text-[10px] font-black uppercase tracking-widest outline-none appearance-none cursor-pointer">
                      <option value="unverified">Unverified</option>
                      <option value="verified">Verified</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] font-black uppercase tracking-widest opacity-40">Cipher Override</p>
                    <input type="password" value={editForm.password} onChange={e=>setEditForm(f=>({...f,password:e.target.value}))} className="w-full h-11 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl px-4 text-xs font-bold outline-none focus:border-[var(--accent)] transition-all" placeholder="••••••••" />
                  </div>
                </div>

                <div className="pt-4">
                  <button type="submit" disabled={submitting} className="w-full h-14 bg-[var(--accent)] text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-[var(--accent)]/20 active:scale-95 transition-all">
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

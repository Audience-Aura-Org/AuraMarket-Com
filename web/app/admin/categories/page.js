"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { 
  Plus, Edit2, Trash2, ChevronRight, ChevronDown, 
  Folder, Search, Save, X, Database, Zap, Activity,
  RefreshCw, ShieldCheck
} from 'lucide-react';
import { useAuthStore } from '@/hooks/useAuth';
import api from '@/services/api';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import LoadingSpinner from '@/components/common/LoadingSpinner';

export default function AdminCategories() {
  const { user } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [editing, setEditing] = useState(null); 
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({ name: '', parent_id: null });

  useEffect(() => {
    setMounted(true);
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const res = await api.get('/categories/tree');
      if (res.data.success) {
        setCategories(res.data.data);
      }
    } catch (err) {
      console.error(err);
      toast.error("Scan of nodes failed.");
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAdd = async () => {
    if (!formData.name.trim()) return;
    try {
      const res = await api.post('/categories', formData);
      if (res.data.success) {
        fetchCategories();
        setIsAdding(false);
        setFormData({ name: '', parent_id: null });
        toast.success("Category node committed.");
      }
    } catch (err) {
      toast.error(err.response?.data?.error || "Deployment failed.");
    }
  };

  const handleUpdate = async () => {
    if (!editing.name.trim()) return;
    try {
      const res = await api.put(`/categories/${editing._id}`, editing);
      if (res.data.success) {
        fetchCategories();
        setEditing(null);
        toast.success("Matrix node recalibrated.");
      }
    } catch (err) {
      toast.error(err.response?.data?.error || "Recalibration failed.");
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure? This will delete the category node forever.")) return;
    try {
      const res = await api.delete(`/categories/${id}`);
      if (res.data.success) {
        fetchCategories();
        toast.success("Node terminated.");
      }
    } catch (err) {
      toast.error(err.response?.data?.error || "Purge failed.");
    }
  };

  const renderCategoryRow = (cat, depth = 0) => {
    const isExpanded = expanded[cat._id];
    const hasChildren = cat.children && cat.children.length > 0;

    return (
      <div key={cat._id} className="w-full">
        <div 
          className="flex items-center justify-between p-4 lg:p-5 hover:bg-[var(--accent)]/5 border-b border-[var(--glass-border)]/50 transition-all group"
          style={{ paddingLeft: `${depth * 2 + 2.5}rem` }}
        >
          <div className="flex items-center gap-4">
            {hasChildren ? (
              <button 
                onClick={() => toggleExpand(cat._id)}
                className="size-8 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent)] transition-all active:scale-90"
              >
                {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
              </button>
            ) : (
              <div className="size-8 flex items-center justify-center opacity-10">
                 <div className="size-1 bg-[var(--text-secondary)] rounded-full" />
              </div>
            )}
            
            <div className={`p-2 rounded-xl ${hasChildren ? 'bg-[var(--accent)]/10 text-[var(--accent)]' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'} border border-[var(--glass-border)]/20 shadow-sm`}>
               <Folder className="size-4" />
            </div>

            {editing?._id === cat._id ? (
              <input 
                value={editing.name}
                onChange={e => setEditing({...editing, name: e.target.value})}
                className="bg-[var(--bg-primary)] border border-[var(--accent)] rounded-xl px-4 py-2 text-[11px] font-bold text-[var(--accent)] outline-none ring-4 ring-[var(--accent)]/5 shadow-inner uppercase tracking-tight"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleUpdate()}
              />
            ) : (
              <div className="flex flex-col">
                <span className="text-[11px] font-bold tracking-tight text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors uppercase">{cat.name}</span>
                <span className="text-[10px] font-bold tracking-widest text-[var(--text-secondary)] opacity-30 uppercase">Node_ID: #{cat._id?.slice(-8).toUpperCase()}</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
            {editing?._id === cat._id ? (
              <>
                <button onClick={handleUpdate} className="size-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg shadow-emerald-500/20"><Save className="size-4" /></button>
                <button onClick={() => setEditing(null)} className="size-9 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center text-rose-500 hover:bg-rose-500 hover:text-white transition-all shadow-sm active:scale-95"><X className="size-4" /></button>
              </>
            ) : (
              <>
                <button 
                  onClick={() => {
                    setIsAdding(true);
                    setFormData({ name: '', parent_id: cat._id });
                  }}
                  className="size-9 rounded-xl bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20 flex items-center justify-center hover:bg-[var(--accent)] hover:text-white transition-all shadow-sm active:scale-95"
                  title="Add Sub"
                >
                  <Plus className="size-4" />
                </button>
                <button 
                  onClick={() => setEditing(cat)}
                  className="size-9 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center text-indigo-500 hover:bg-indigo-500 hover:text-white transition-all shadow-sm active:scale-95"
                  title="Edit"
                >
                  <Edit2 className="size-4" />
                </button>
                <button 
                  onClick={() => handleDelete(cat._id)}
                  className="size-9 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-sm active:scale-95"
                  title="Purge"
                >
                  <Trash2 className="size-4" />
                </button>
              </>
            )}
          </div>
        </div>
        {isExpanded && hasChildren && (
          <div className="bg-[var(--bg-secondary)]/10">
            {cat.children.map(child => renderCategoryRow(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Surgical Header */}
      <header className="h-24 flex items-center justify-between px-10 border-b border-[var(--glass-border)] bg-[var(--bg-primary)]/80 backdrop-blur-xl sticky top-16 z-40">
        <div className="flex items-center gap-6">
          <div className="size-12 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] shadow-inner border border-[var(--accent)]/20">
             <Database className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[var(--text-primary)] tracking-tight ">Category <span className="text-[var(--accent)]">Taxonomy</span> Matrix</h2>
            <div className="flex items-center gap-2 mt-1">
               <div className="size-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
               <p className="text-[11px] font-bold text-[var(--text-secondary)] tracking-tight opacity-50 uppercase">Operational Hierarchy // Node_Taxonomy_Root</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
           <button 
             onClick={() => {
               setIsAdding(true);
               setFormData({ name: '', parent_id: null });
             }}
             className="h-11 px-8 bg-[var(--accent)] text-white rounded-2xl text-[10px] font-bold tracking-[0.2em] uppercase shadow-lg shadow-[var(--accent)]/20 active:scale-95 transition-all flex items-center gap-2"
           >
             <Plus className="w-4 h-4" /> New Origin Node
           </button>
           <button onClick={fetchCategories} className="size-11 rounded-2xl border border-[var(--glass-border)] hover:bg-[var(--accent)]/10 text-[var(--text-secondary)] flex items-center justify-center transition-all shadow-sm active:scale-95">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
           </button>
        </div>
      </header>

      <div className="p-10 space-y-8 pb-40">
         {/* Live Stats */}
         <div className="grid grid-cols-4 gap-6">
            {[
               { label: 'Total Nodes', value: categories.length, icon: Database, color: 'var(--accent)', sub: 'MATRIX_INDEX' },
               { label: 'Active Sectors', value: '18', icon: Zap, color: '#10b981', sub: 'FLOW_ACTIVE' },
               { label: 'Growth Index', value: '+12.4%', icon: Activity, color: '#6366f1', sub: 'SCALE_VECTOR' },
               { label: 'System Uptime', value: '99.98%', icon: ShieldCheck, color: '#fbbf24', sub: 'CORE_STABLE' }
            ].map(s => (
               <div key={s.label} className="group relative p-8 rounded-[2.5rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 hover:bg-[var(--bg-primary)]/60 transition-all duration-500 overflow-hidden shadow-lg hover:shadow-2xl hover:-translate-y-1 backdrop-blur-2xl">
                  <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 size-32 rounded-full blur-[80px] opacity-10 transition-opacity group-hover:opacity-30" style={{ backgroundColor: s.color }} />
                  <div className="relative flex flex-col justify-between h-full space-y-8">
                     <div className="flex items-center justify-between">
                        <div className="size-12 rounded-[1.25rem] flex items-center justify-center border border-[var(--glass-border)] bg-[var(--bg-secondary)] shadow-inner text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-all duration-500">
                           <s.icon className="w-5 h-5 opacity-40 group-hover:opacity-100" />
                        </div>
                        <span className="text-[10px] font-bold tracking-[0.3em] uppercase opacity-20 group-hover:opacity-40 transition-opacity font-mono">{s.sub}</span>
                     </div>
                     <div>
                        <p className="text-[10px] font-bold text-[var(--text-secondary)] tracking-[0.2em] mb-2 uppercase opacity-40">{s.label}</p>
                        <h3 className="text-2xl font-bold text-[var(--text-primary)] tracking-tighter leading-none">{s.value}</h3>
                     </div>
                  </div>
               </div>
            ))}
         </div>

         {/* Node Deployment Section */}
         <AnimatePresence>
            {isAdding && (
               <motion.div 
                 initial={{ height: 0, opacity: 0 }}
                 animate={{ height: 'auto', opacity: 1 }}
                 exit={{ height: 0, opacity: 0 }}
                 className="overflow-hidden"
               >
                  <div className="glass-panel p-10 rounded-[3rem] border border-[var(--accent)]/30 bg-[var(--bg-primary)]/60 shadow-2xl relative mb-8 overflow-hidden group">
                     <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.1] transition-opacity pointer-events-none">
                        <Plus className="size-48" />
                     </div>
                     <div className="relative z-10">
                        <h3 className="text-xs font-bold text-[var(--accent)] tracking-[0.3em] uppercase mb-8 flex items-center gap-3">
                           <div className="h-5 w-1 bg-[var(--accent)] rounded-full" />
                           Provision {formData.parent_id ? 'Subscriber' : 'Origin'} Node
                        </h3>
                        <div className="flex flex-col md:flex-row gap-6">
                           <div className="flex-1 space-y-2">
                              <label className="text-[10px] font-bold tracking-widest text-[var(--text-secondary)] opacity-40 uppercase ml-1">Node Descriptor</label>
                              <input 
                                 placeholder="DESIGNATE LABEL..."
                                 value={formData.name}
                                 onChange={e => setFormData({...formData, name: e.target.value})}
                                 className="w-full h-14 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl px-6 text-[11px] font-bold uppercase outline-none focus:border-[var(--accent)] transition-all shadow-inner tracking-widest"
                                 autoFocus
                              />
                           </div>
                           <div className="flex items-end gap-3">
                              <button onClick={handleAdd} className="h-14 px-10 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-2xl font-bold text-[10px] tracking-[0.3em] uppercase hover:bg-[var(--accent)] hover:text-white transition-all shadow-xl active:scale-95">Commit</button>
                              <button onClick={() => setIsAdding(false)} className="h-14 px-10 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl font-bold text-[10px] tracking-[0.3em] uppercase hover:bg-rose-500 hover:text-white transition-all shadow-sm active:scale-95">Abort</button>
                           </div>
                        </div>
                     </div>
                  </div>
               </motion.div>
            )}
         </AnimatePresence>

         {/* Taxonomy Ledger */}
         <div className="glass-panel rounded-[3rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 overflow-hidden shadow-2xl">
            <div className="p-8 border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/30 flex items-center justify-between">
               <h3 className="text-[11px] font-bold text-[var(--text-primary)] tracking-[0.1em] flex items-center gap-3 uppercase">
                  <Database className="w-4 h-4 text-[var(--accent)]" /> 
                  Platform Taxonomy Ledger
               </h3>
               <p className="text-[10px] font-bold text-[var(--text-secondary)] opacity-40 uppercase tracking-widest">Global Hierarchy Tree</p>
            </div>

            <div className="min-h-[400px]">
              {loading ? (
                 <LoadingSpinner text="Synchronizing Taxonomy Nodes" />
              ) : categories.length === 0 ? (
                 <div className="py-40 flex flex-col items-center justify-center opacity-20 px-10 text-center">
                    <Folder className="w-16 h-16 mb-8 text-[var(--text-secondary)]" />
                    <p className="text-sm font-bold tracking-[0.2em] uppercase leading-relaxed max-w-sm">No taxonomy nodes detected in the matrix.</p>
                 </div>
              ) : (
                 <div className="divide-y divide-[var(--glass-border)]/50">
                    {categories.map(cat => renderCategoryRow(cat))}
                 </div>
              )}
            </div>
         </div>
      </div>
    </div>
  );
}

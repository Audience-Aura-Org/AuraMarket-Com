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
import StatCard from '@/components/layout/StatCard';

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
          className="flex flex-col md:flex-row md:items-center justify-between p-4 md:p-6 hover:bg-[var(--accent)]/5 border-b border-[var(--glass-border)]/50 transition-all group gap-4 md:gap-0"
          style={{ paddingLeft: typeof window !== 'undefined' && window.innerWidth < 768 ? '1rem' : `${depth * 2.5 + 2.5}rem` }}
        >
          <div className="flex items-center gap-4 min-w-0">
            {/* Indentation Spacer for Mobile */}
            <div className="md:hidden flex items-center shrink-0" style={{ width: `${depth * 1.5}rem` }}>
               {depth > 0 && <div className="w-px h-6 bg-[var(--glass-border)] mx-auto opacity-20" />}
            </div>

            {hasChildren ? (
              <button 
                onClick={() => toggleExpand(cat._id)}
                className="size-10 md:size-11 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent)] transition-all active:scale-90 shrink-0 shadow-sm"
              >
                {isExpanded ? <ChevronDown className="size-5" /> : <ChevronRight className="size-5" />}
              </button>
            ) : (
              <div className="size-10 md:size-11 flex items-center justify-center opacity-10 shrink-0">
                 <div className="size-1.5 bg-[var(--text-secondary)] rounded-full" />
              </div>
            )}
            
            <div className={`size-10 md:size-11 rounded-xl flex items-center justify-center shrink-0 ${hasChildren ? 'bg-[var(--accent)]/10 text-[var(--accent)]' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'} border border-[var(--glass-border)]/20 shadow-inner`}>
               <Folder className="size-5" />
            </div>

            {editing?._id === cat._id ? (
              <input 
                value={editing.name}
                onChange={e => setEditing({...editing, name: e.target.value})}
                className="flex-1 min-w-[150px] bg-[var(--bg-primary)] border border-[var(--accent)] rounded-xl px-4 h-10 text-xs font-bold text-[var(--accent)] outline-none ring-4 ring-[var(--accent)]/5 shadow-inner capitalize tracking-tight"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleUpdate()}
              />
            ) : (
              <div className="flex flex-col min-w-0">
                <span className="text-[12px] md:text-sm font-bold tracking-tight text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors capitalize truncate">{cat.name}</span>
                <span className="text-[10px] font-bold tracking-widest text-[var(--text-secondary)] opacity-30 uppercase mt-0.5">Node_ID: #{cat._id?.slice(-8).toUpperCase()}</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2 md:opacity-0 group-hover:opacity-100 transition-all transform md:translate-x-2 group-hover:translate-x-0 justify-end">
            {editing?._id === cat._id ? (
              <>
                <button onClick={handleUpdate} className="h-10 px-4 md:size-11 rounded-xl bg-emerald-500 text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg shadow-emerald-500/20 text-[10px] font-bold uppercase tracking-widest md:text-transparent">
                  <span className="md:hidden mr-2">Save</span>
                  <Save className="size-4" />
                </button>
                <button onClick={() => setEditing(null)} className="h-10 px-4 md:size-11 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center text-rose-500 hover:bg-rose-500 hover:text-white transition-all shadow-sm active:scale-95 text-[10px] font-bold uppercase tracking-widest md:text-transparent">
                  <span className="md:hidden mr-2">Cancel</span>
                  <X className="size-4" />
                </button>
              </>
            ) : (
              <>
                  <button 
                    onClick={() => {
                      setIsAdding(true);
                      setFormData({ name: '', parent_id: cat._id });
                    }}
                    className="size-10 md:size-11 rounded-xl bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20 flex items-center justify-center hover:bg-[var(--accent)] hover:text-white transition-all shadow-sm active:scale-95 text-[10px] font-bold uppercase"
                    title="Add Sub"
                  >
                    Sub
                  </button>
                <button 
                  onClick={() => setEditing(cat)}
                  className="size-10 md:size-11 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center text-indigo-500 hover:bg-indigo-500 hover:text-white transition-all shadow-sm active:scale-95"
                  title="Edit"
                >
                  <Edit2 className="size-4" />
                </button>
                <button 
                  onClick={() => handleDelete(cat._id)}
                  className="size-10 md:size-11 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-sm active:scale-95"
                  title="Purge"
                >
                  <Trash2 className="size-4" />
                </button>
              </>
            )}
          </div>
        </div>
        {isExpanded && hasChildren && (
          <div className="bg-[var(--bg-secondary)]/5">
            {cat.children.map(child => renderCategoryRow(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <header className="min-h-20 py-4 flex flex-col md:flex-row md:h-24 items-center justify-between px-4 md:px-10 border-b border-[var(--glass-border)] bg-[var(--bg-primary)]/80 backdrop-blur-xl sticky top-0 md:top-16 z-40 gap-4 md:gap-0">
        <div className="flex items-center justify-between w-full md:w-auto gap-4">
          <div className="flex items-center gap-4">
            <div className="size-10 md:size-12 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] border border-[var(--accent)]/20 shadow-inner shrink-0">
               <Database className="size-5 md:size-6" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-bold text-[var(--text-primary)] tracking-tight">Taxonomy <span className="text-[var(--accent)]">Manager</span></h2>
              <div className="flex items-center gap-2 mt-0.5">
                 <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                 <p className="text-[10px] md:text-[11px] lg:text-[12px] font-semibold text-[var(--text-secondary)] tracking-tight opacity-50 uppercase">Operational Hierarchy</p>
              </div>
            </div>
          </div>
          <button onClick={fetchCategories} className="md:hidden size-10 rounded-xl border border-[var(--glass-border)] flex items-center justify-center active:scale-95 text-[var(--text-secondary)]">
             <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <button 
             onClick={() => { setIsAdding(true); setFormData({ name: '', parent_id: null }); }}
             className="w-full md:w-auto h-12 md:h-14 px-8 bg-[var(--accent)] text-white rounded-2xl text-[11px] font-bold tracking-[0.2em] uppercase shadow-lg shadow-[var(--accent)]/20 active:scale-95 transition-all flex items-center justify-center gap-3"
           >
             New Sector Node
        </button>
      </header>

      <div className="p-4 md:p-10 space-y-8 pb-32">
         {/* Intelligence Matrix */}
         <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            <StatCard label="Total Nodes" value={categories.length} icon="database" color="primary" sub="REGISTRY" />
            <StatCard label="Sectors" value="18" icon="zap" color="emerald" sub="ACTIVE" />
            <StatCard label="Growth" value="+12%" icon="trending_up" color="blue" sub="SCALE" />
            <StatCard label="Health" value="Stable" icon="verified_user" color="amber" sub="CORE" />
         </div>

         <AnimatePresence>
            {isAdding && (
               <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="p-6 md:p-8 rounded-[2.5rem] border border-[var(--accent)]/30 bg-[var(--bg-primary)]/60 mb-8 shadow-2xl backdrop-blur-2xl">
                     <div className="flex items-center gap-3 mb-6">
                        <div className="size-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
                        <h3 className="text-[10px] font-bold text-[var(--accent)] tracking-[0.3em] uppercase">Provision New Asset Node</h3>
                     </div>
                     <div className="flex flex-col md:flex-row gap-4">
                        <input 
                           placeholder="Enter Node Designation..."
                           value={formData.name}
                           onChange={e => setFormData({...formData, name: e.target.value})}
                           className="flex-1 h-14 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl px-6 text-sm font-bold outline-none focus:border-[var(--accent)] transition-all shadow-inner"
                        />
                        <div className="flex gap-3">
                           <button onClick={handleAdd} className="flex-1 md:flex-none h-14 px-8 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-[var(--accent)] hover:text-white transition-all">Commit</button>
                           <button onClick={() => setIsAdding(false)} className="flex-1 md:flex-none h-14 px-8 bg-[var(--bg-secondary)] rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] border border-[var(--glass-border)] transition-all hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-500/20">Abort</button>
                        </div>
                     </div>
                  </div>
               </motion.div>
            )}
         </AnimatePresence>

         <div className="rounded-[2.5rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 overflow-hidden shadow-2xl backdrop-blur-xl">
            <div className="p-6 md:p-8 border-b border-[var(--glass-border)] flex items-center justify-between bg-[var(--bg-secondary)]/20">
               <h3 className="text-xs font-bold text-[var(--text-primary)] tracking-[0.2em] flex items-center gap-3 uppercase">
                  <Database className="size-4 text-[var(--accent)]" /> Taxonomy Ledger Protocol
               </h3>
               <p className="hidden md:block text-[10px] font-bold text-[var(--text-secondary)] opacity-30 uppercase tracking-[0.3em]">Sector_Hierarchy_v4.2</p>
            </div>
            <div className="min-h-[400px]">
              {loading ? (
                 <LoadingSpinner />
              ) : categories.length === 0 ? (
                 <div className="py-32 flex flex-col items-center justify-center opacity-10 gap-6">
                    <Folder className="size-20" />
                    <p className="text-xs font-bold tracking-[0.5em] uppercase">No Synchronization Items Detected</p>
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

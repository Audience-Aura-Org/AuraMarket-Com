"use client";

import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, ChevronRight, ChevronDown, Folder, Search, Save, X } from 'lucide-react';
import { useAuthStore } from '@/hooks/useAuth';
import RoleSidebar from '@/components/layout/RoleSidebar';
import api from '@/services/api';

export const dynamic = 'force-dynamic';

export default function AdminCategories() {
  const { user } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [editing, setEditing] = useState(null); // { id, name, parent_id }
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({ name: '', parent_id: null });
  const [toast, setToast] = useState(null);

  useEffect(() => {
    setMounted(true);
    fetchCategories();
  }, []);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchCategories = async () => {
    try {
      const res = await api.get('/categories/tree');
      if (res.data.success) {
        setCategories(res.data.data);
      }
    } catch (err) {
      console.error(err);
      showToast("Scan of nodes failed.", "error");
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
        showToast("Category data committed to matrix.");
      }
    } catch (err) {
      showToast(err.response?.data?.error || "Failed to add category", "error");
    }
  };

  const handleUpdate = async () => {
    if (!editing.name.trim()) return;
    try {
      const res = await api.put(`/categories/${editing._id}`, editing);
      if (res.data.success) {
        fetchCategories();
        setEditing(null);
        showToast("Matrix node recalibrated.");
      }
    } catch (err) {
      showToast(err.response?.data?.error || "Failed to update category", "error");
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure? This will delete the category node forever.")) return;
    try {
      const res = await api.delete(`/categories/${id}`);
      if (res.data.success) {
        fetchCategories();
        showToast("Node terminated from matrix.");
      }
    } catch (err) {
      showToast(err.response?.data?.error || "Failed to delete category", "error");
    }
  };

  const renderCategoryRow = (cat, depth = 0) => {
    const isExpanded = expanded[cat._id];
    const hasChildren = cat.children && cat.children.length > 0;

    return (
      <div key={cat._id} className="animate-in fade-in slide-in-from-left-2 duration-300">
        <div 
          className="flex items-center justify-between p-5 hover:bg-[var(--accent)]/5 border-b border-[var(--glass-border)] transition-all group relative"
          style={{ paddingLeft: `${depth * 2 + 1.5}rem` }}
        >
          <div className="flex items-center gap-4 relative z-10">
            {hasChildren ? (
              <button 
                onClick={() => toggleExpand(cat._id)}
                className="size-7 rounded-lg bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent)] transition-all active:scale-90"
              >
                {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
              </button>
            ) : (
              <div className="size-7 flex items-center justify-center opacity-10">
                 <div className="size-1 bg-[var(--text-secondary)] rounded-full" />
              </div>
            )}
            
            <div className={`p-2 rounded-lg ${hasChildren ? 'bg-[var(--accent)]/10 text-[var(--accent)]' : 'bg-[var(--text-secondary)]/5 text-[var(--text-secondary)]'} transition-colors`}>
               <Folder className="size-4" />
            </div>

            {editing?._id === cat._id ? (
              <input 
                value={editing.name}
                onChange={e => setEditing({...editing, name: e.target.value})}
                className="bg-[var(--bg-primary)] border border-[var(--accent)]/30 rounded-xl px-4 py-1.5 text-sm font-black text-[var(--accent)] outline-none ring-4 ring-[var(--accent)]/5 shadow-inner"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleUpdate()}
              />
            ) : (
              <div className="flex flex-col">
                <span className="text-sm font-black tracking-tight text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">{cat.name}</span>
                <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-40">Node ID: {cat._id?.slice(-8)}</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0 relative z-10">
            {editing?._id === cat._id ? (
              <>
                <button onClick={handleUpdate} className="size-10 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center hover:bg-emerald-500 hover:text-white transition-all shadow-lg active:scale-95"><Save className="size-4" /></button>
                <button onClick={() => setEditing(null)} className="size-10 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all shadow-lg active:scale-95"><X className="size-4" /></button>
              </>
            ) : (
              <>
                <button 
                  onClick={() => {
                    setIsAdding(true);
                    setFormData({ name: '', parent_id: cat._id });
                  }}
                  className="size-10 rounded-xl bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20 flex items-center justify-center hover:bg-[var(--accent)] hover:text-white transition-all shadow-lg active:scale-95"
                  title="Add Subcategory"
                >
                  <Plus className="size-4" />
                </button>
                <button 
                  onClick={() => setEditing(cat)}
                  className="size-10 rounded-xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 flex items-center justify-center hover:bg-indigo-500 hover:text-white transition-all shadow-lg active:scale-95"
                  title="Edit"
                >
                  <Edit2 className="size-4" />
                </button>
                <button 
                  onClick={() => handleDelete(cat._id)}
                  className="size-10 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all shadow-lg active:scale-95"
                  title="Delete"
                >
                  <Trash2 className="size-4" />
                </button>
              </>
            )}
          </div>
        </div>
        {isExpanded && hasChildren && (
          <div className="bg-[var(--bg-secondary)]/30">
            {cat.children.map(child => renderCategoryRow(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (!mounted) return null;

  return (
    <>
      <header className="h-20 lg:h-24 flex items-center justify-between px-6 lg:px-12 border-b border-[var(--nav-border)] bg-[var(--nav-bg)] backdrop-blur-2xl shrink-0 z-10 text-[var(--nav-text)]">
        <div className="flex flex-col">
          <h2 className="text-lg lg:text-2xl font-black uppercase tracking-tighter leading-none">Category <span className="text-[var(--accent)]">Matrix</span></h2>
          <p className="hidden sm:block text-[8px] lg:text-[10px] font-black uppercase tracking-[0.3em] text-[var(--text-secondary)] mt-1.5 lg:mt-2 opacity-50">Authorized Taxonomy Management</p>
        </div>
        <button 
          onClick={() => {
            setIsAdding(true);
            setFormData({ name: '', parent_id: null });
          }}
          className="flex items-center gap-2 lg:gap-3 bg-[var(--accent)] text-white px-4 lg:px-8 py-2.5 lg:py-4 rounded-xl lg:rounded-[1.25rem] text-[8px] lg:text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-[var(--accent)]/20"
        >
          <Plus className="size-3.5 lg:size-4" /> New Origin Node
        </button>
      </header>

      <div className="p-4 lg:p-12 space-y-6 lg:space-y-10 pb-32">
        {isAdding && (
          <div className="glass-panel p-6 lg:p-8 rounded-[24px] lg:rounded-[2.5rem] border border-[var(--accent)]/30 bg-[var(--bg-primary)]/60 animate-in fade-in slide-in-from-top-6 duration-500 shadow-2xl">
            <div className="flex items-center gap-3 mb-4 lg:mb-6">
               <div className="size-1 w-6 lg:w-8 bg-[var(--accent)] rounded-full" />
               <h3 className="text-[8px] lg:text-[10px] font-black uppercase tracking-widest text-[var(--accent)]">Protocol: Add {formData.parent_id ? 'Subscriber Node' : 'Origin Node'}</h3>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 lg:gap-4">
              <input 
                placeholder="Designate Label..."
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                className="flex-1 bg-[var(--bg-primary)]/80 border border-[var(--glass-border)] rounded-xl lg:rounded-2xl px-5 lg:px-6 py-3 lg:py-4 text-xs lg:text-sm font-black text-[var(--text-primary)] focus:ring-4 focus:ring-[var(--accent)]/10 focus:border-[var(--accent)]/30 outline-none transition-all shadow-inner uppercase tracking-wider"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
              <div className="flex gap-2">
                <button onClick={handleAdd} className="flex-1 sm:flex-none bg-[var(--text-primary)] text-[var(--bg-primary)] px-6 lg:px-10 py-3 lg:py-4 rounded-xl lg:rounded-2xl text-[8px] lg:text-[10px] font-black uppercase tracking-widest hover:bg-[var(--accent)] hover:text-white transition-all shadow-lg active:scale-95">Commit</button>
                <button onClick={() => setIsAdding(false)} className="flex-1 sm:flex-none glass-panel px-6 lg:px-8 py-3 lg:py-4 rounded-xl lg:rounded-2xl text-[8px] lg:text-[10px] font-black uppercase tracking-widest hover:bg-rose-500/10 hover:text-rose-500 transition-all border border-[var(--glass-border)]">Abort</button>
              </div>
            </div>
          </div>
        )}

        <div className="glass-panel rounded-[24px] lg:rounded-[3rem] overflow-hidden border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 shadow-2xl relative">
           <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent)]/5 to-transparent pointer-events-none" />
          {loading ? (
            <div className="py-20 lg:py-32 flex flex-col items-center justify-center gap-6 opacity-40">
              <div className="size-10 lg:size-12 rounded-full border-4 border-[var(--accent)] border-t-transparent animate-spin" />
              <p className="text-[9px] lg:text-[10px] font-black uppercase tracking-[0.4em]">Synchronizing Matrix Nodes...</p>
            </div>
          ) : categories.length === 0 ? (
            <div className="py-20 lg:py-40 text-center space-y-6 opacity-30">
              <Folder className="size-16 lg:size-20 mx-auto mb-4" />
              <p className="text-xs lg:text-sm font-black uppercase tracking-[0.3em]">Matrix Voids Detected. Initiate nodes to begin.</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--glass-border)] relative z-10 overflow-x-auto">
              <div className="min-w-[600px] lg:min-w-0">
                {categories.map(cat => renderCategoryRow(cat))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}



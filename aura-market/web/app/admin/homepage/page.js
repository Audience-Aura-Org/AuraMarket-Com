"use client";
import { useState, useEffect } from 'react';
import api from '@/services/api';
import { 
  Plus, GripVertical, Settings2, Trash2, 
  CheckCircle2, XCircle, ChevronUp, 
  ChevronDown, Grid, Package, Store, Tag, 
  List, ImageIcon, ArrowRight, Layers, Sparkles, Activity,
  MonitorPlay
} from 'lucide-react';
import SectionForm from '../storefront/components/SectionForm';

export const dynamic = 'force-dynamic';

export default function AdminHomepagePage() {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSection, setEditingSection] = useState(null);

  const fetchSections = async () => {
    try {
      const res = await api.get('/homepage/admin/sections');
      if (res.data?.success) {
        setSections(res.data.data.sections);
      }
    } catch (err) {
      console.error('Failed to fetch sections:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSections();
  }, []);

  const handleToggle = async (id, currentStatus) => {
    try {
      await api.patch(`/homepage/admin/sections/${id}`, { is_active: !currentStatus });
      fetchSections();
    } catch (err) {
      alert('Failed to update status');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Decommission this storefront sector?')) return;
    try {
      await api.delete(`/homepage/admin/sections/${id}`);
      fetchSections();
    } catch (err) {
      alert('Failed to delete section');
    }
  };

  const handleMove = async (index, direction) => {
    const newSections = [...sections];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= sections.length) return;

    const [removed] = newSections.splice(index, 1);
    newSections.splice(targetIndex, 0, removed);

    const orders = newSections.map((s, i) => ({ id: s._id, order: i + 1 }));
    setSections(newSections);

    try {
      await api.patch('/homepage/admin/sections/reorder', { orders });
    } catch (err) {
      alert('Failed to reorder');
      fetchSections();
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)] py-12 px-6 md:px-12 lg:px-20 selection:bg-[var(--accent)] selection:text-white transition-all duration-300 font-[var(--font-poppins)]">
      <div className="max-w-[1400px] mx-auto space-y-16">
        
        {/* Dynamic Header */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-8 animate-in fade-in slide-in-from-top-10 duration-700">
           <div className="flex items-center gap-6">
              <div className="size-16 rounded-[22px] bg-gradient-to-tr from-[var(--accent)] to-[var(--accent-light)] text-white flex items-center justify-center shadow-xl shadow-[var(--accent)]/30 border border-white/20">
                 <MonitorPlay className="size-8" />
              </div>
              <div className="space-y-1">
                 <h1 className="text-4xl font-black text-[var(--text-primary)] tracking-tighter leading-none">CMS <span className="text-[var(--accent)]">Architect</span></h1>
                 <div className="flex items-center gap-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--text-secondary)] opacity-40">Homepage Topology Control</p>
                    <div className="h-1 w-1 rounded-full bg-[var(--glass-border)]" />
                    <span className="text-[10px] font-bold text-[var(--accent)] uppercase tracking-widest">{sections.length} Active Nodes</span>
                 </div>
              </div>
           </div>

           <div className="flex items-center gap-4">
              <button 
                onClick={() => { setEditingSection(null); setIsFormOpen(true); }}
                className="h-14 px-8 rounded-2xl bg-[var(--text-primary)] text-[var(--bg-primary)] text-[11px] font-black uppercase tracking-[0.2em] flex items-center gap-4 hover:scale-[1.03] active:scale-95 shadow-2xl transition-all group"
              >
                 <Plus className="size-4 group-hover:rotate-90 transition-transform duration-300" /> Deploy New Component
              </button>
           </div>
        </div>

        {/* Main Architect View */}
        <div className="grid gap-6 animate-in fade-in slide-in-from-bottom-5 duration-700 delay-200">
           {loading ? (
             [...Array(3)].map((_, i) => (
                <div key={i} className="h-64 rounded-[2.5rem] bg-[var(--bg-primary)]/20 border border-[var(--glass-border)] animate-pulse" />
             ))
           ) : sections.length === 0 ? (
              <div className="py-40 text-center glass-panel rounded-[3rem] border border-[var(--glass-border)] space-y-6">
                 <div className="size-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto opacity-20">
                    <MonitorPlay className="size-10" />
                 </div>
                 <div className="space-y-1">
                    <h3 className="text-2xl font-black opacity-30 uppercase tracking-widest">No Components Manifested</h3>
                    <p className="text-xs font-medium opacity-20 uppercase tracking-[0.2em]">Begin deploying modular blocks to your homepage storefront.</p>
                 </div>
              </div>
           ) : (
             sections.map((section, index) => (
                <div 
                  key={section._id} 
                  className={`group relative glass-panel rounded-[2.5rem] bg-[var(--bg-primary)]/40 border-[1.5px] border-[var(--glass-border)] hover:border-[var(--accent)]/30 transition-all duration-500 flex flex-col lg:flex-row overflow-hidden shadow-sm hover:shadow-2xl ${!section.is_active ? 'opacity-40 grayscale-50 backdrop-grayscale' : ''}`}
                >
                   {/* Status vertical band */}
                   <div className={`absolute left-0 top-0 bottom-0 w-1 ${section.is_active ? 'bg-[var(--accent)] shadow-[2px_0_15px_var(--accent)]/30' : 'bg-[var(--glass-border)]'}`} />

                   {/* 1. Component Control (Side) */}
                   <div className="p-6 md:p-8 lg:w-80 border-b lg:border-b-0 lg:border-r border-[var(--glass-border)] bg-white/5 flex lg:flex-col items-center justify-between gap-6 shrink-0 backdrop-blur-md">
                      <div className="flex lg:flex-col items-center lg:items-start gap-4 lg:gap-6 w-full">
                         <div className="size-14 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--accent)] shadow-xl relative overflow-hidden group-hover:scale-105 transition-transform duration-500">
                            <div className="absolute inset-0 bg-[var(--accent)]/5 animate-pulse" />
                            {section.type === 'hero' && <Grid className="size-6 relative" />}
                            {section.type === 'categories' && <List className="size-6 relative" />}
                            {section.type === 'stores' && <Store className="size-6 relative" />}
                            {section.type === 'featured_products' && <Sparkles className="size-6 relative" />}
                            {section.type === 'trending' && <Activity className="size-6 relative" />}
                            {(!section.type || !['hero', 'categories', 'stores', 'featured_products', 'trending'].includes(section.type)) && <Package className="size-6 relative" />}
                         </div>

                         <div className="flex-1 lg:w-full space-y-1">
                            <div className="flex items-center gap-2">
                               <span className="text-[8px] font-black uppercase tracking-[0.2em] bg-[var(--accent)] text-white px-2 py-0.5 rounded shadow-lg shadow-[var(--accent)]/20">
                                  {section.type.replace('_', ' ')}
                               </span>
                               <span className={`text-[8px] font-bold px-2 py-0.5 rounded border ${section.is_active ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-white/5 text-white/40 border-white/10'} uppercase tracking-widest`}>
                                  {section.is_active ? 'Live' : 'Offline'}
                               </span>
                            </div>
                            <h3 className="text-xl font-black text-[var(--text-primary)] leading-tight tracking-tight uppercase truncate group-hover:text-[var(--accent)] transition-colors duration-300">{section.title || section.type}</h3>
                            <div className="flex items-center gap-2 text-[9px] font-bold text-[var(--text-secondary)] opacity-40 uppercase tracking-[0.2em]">
                               <span>{section.data?.length || 0} Elements</span>
                               {section.scheduled_start && (
                                 <div className="flex items-center gap-1 text-[var(--accent)] opacity-100">
                                    <div className="h-1 w-1 rounded-full bg-current" />
                                    <span>Scheduled</span>
                                 </div>
                               )}
                            </div>
                         </div>
                      </div>

                      <div className="flex lg:w-full items-center justify-between gap-4">
                         <div className="flex items-center gap-1.5 p-1.5 bg-[var(--bg-secondary)] rounded-xl border border-[var(--glass-border)] shadow-inner">
                            <button onClick={() => handleMove(index, -1)} disabled={index === 0} className="size-8 rounded-lg flex items-center justify-center hover:bg-white/10 hover:text-[var(--accent)] disabled:opacity-0 transition-all">
                               <ChevronUp className="size-4" />
                            </button>
                            <div className="h-4 w-px bg-[var(--glass-border)]" />
                            <button onClick={() => handleMove(index, 1)} disabled={index === sections.length - 1} className="size-8 rounded-lg flex items-center justify-center hover:bg-white/10 hover:text-[var(--accent)] disabled:opacity-0 transition-all">
                               <ChevronDown className="size-4" />
                            </button>
                         </div>

                         <div className="flex items-center gap-2">
                            <button 
                              onClick={() => handleToggle(section._id, section.is_active)}
                              className={`size-10 rounded-xl border border-[var(--glass-border)] flex items-center justify-center transition-all shadow-lg ${section.is_active ? 'text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500 hover:text-white' : 'text-white/20 hover:bg-emerald-500/20 hover:text-emerald-500'}`}
                              title={section.is_active ? "Deactivate" : "Activate"}
                            >
                               <CheckCircle2 className="size-5" />
                            </button>
                            <button 
                              onClick={() => { setEditingSection(section); setIsFormOpen(true); }}
                              className="h-10 px-4 rounded-xl border border-[var(--glass-border)] bg-[var(--text-primary)] text-[var(--bg-primary)] hover:scale-[1.05] transition-all shadow-lg flex items-center gap-2 text-[9px] font-black uppercase tracking-widest"
                            >
                               <Settings2 className="size-4" /> Modify
                            </button>
                         </div>
                      </div>
                   </div>

                   {/* 2. Content Snapshot (Main Body) */}
                   <div className="flex-1 p-6 md:p-8 overflow-x-auto no-scrollbar relative min-h-[220px]">
                      <div className="flex items-center gap-6 pb-2 min-w-full lg:min-w-0">
                         {section.data && section.data.length > 0 ? (
                            section.data.map((item, idx) => {
                               const isVendor = section.type === 'stores';
                               const vendorLogo = item.vendor_id?.store?.logo || item.vendor_logo;
                               const vendorName = item.vendor_id?.store_name || item.vendor_name || 'Vendor';
                               const initialsLogo = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(vendorName)}&backgroundColor=0d0d0d&textColor=ffffff`;
                               
                               return (
                                 <div key={idx} className="w-[180px] md:w-[220px] shrink-0 space-y-4 group/preview relative">
                                    <div className="aspect-[16/10] rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] overflow-hidden shadow-lg group-hover/preview:shadow-[0_20px_50px_rgba(0,0,0,0.3)] transition-all duration-500 relative">
                                       {item.image_url ? (
                                         <img src={item.image_url} alt="" className="size-full object-cover group-hover/preview:scale-110 transition-transform duration-700" />
                                       ) : isVendor ? (
                                         <img src={vendorLogo || initialsLogo} alt="" className="size-full object-cover group-hover/preview:scale-110 transition-transform duration-700" />
                                       ) : item.category_name ? (
                                         <div className="size-full flex flex-col items-center justify-center gap-2 opacity-20 bg-gradient-to-br from-[var(--glass-border)] to-transparent">
                                            <Tag className="size-8" />
                                            <span className="text-[8px] font-black uppercase tracking-[0.2em]">Category Mapping</span>
                                         </div>
                                       ) : (
                                         <div className="size-full flex flex-col items-center justify-center gap-2 opacity-10">
                                            <ImageIcon className="size-8" />
                                         </div>
                                       )}
                                       
                                       {/* Quick action bar */}
                                       <div className="absolute bottom-3 left-3 right-3 px-3 py-2 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-between translate-y-4 opacity-0 group-hover/preview:translate-y-0 group-hover/preview:opacity-100 transition-all duration-300">
                                          <span className="text-[8px] font-black text-white uppercase tracking-widest truncate max-w-[100px]">{item.headline || item.category_name || item.product_name || vendorName || 'NODE'}</span>
                                          <ArrowRight className="size-3 text-[var(--accent)]" />
                                       </div>
                                    </div>
                                    
                                    <div className="px-1 space-y-1">
                                       <div className="flex items-center justify-between">
                                          <h4 className="text-[11px] font-black text-[var(--text-primary)] uppercase tracking-tight truncate max-w-[140px]">{item.headline || item.category_name || item.product_name || vendorName || 'Unnamed Node'}</h4>
                                       </div>
                                       {(item.subtext || isVendor) && <p className="text-[9px] font-medium text-[var(--text-secondary)] opacity-40 truncate leading-none">{item.subtext || 'Vendor Profile Active'}</p>}
                                    </div>
                                 </div>
                               );
                            })
                         ) : (
                            <div className="flex-1 flex flex-col items-center justify-center py-10 opacity-20 space-y-3">
                               <Grid className="size-8" />
                               <p className="text-[10px] font-black uppercase tracking-[0.3em]">Module Devoid of Content</p>
                            </div>
                         )}
                      </div>

                      <button 
                         onClick={() => handleDelete(section._id)}
                         className="absolute top-6 right-6 size-10 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-500 hover:bg-rose-500 hover:text-white transition-all duration-300 flex items-center justify-center shadow-xl backdrop-blur-md opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100"
                      >
                         <Trash2 className="size-5" />
                      </button>
                   </div>
                </div>
             ))
           )}
        </div>

        {/* Deployment Metrics */}
        {!loading && sections.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pt-16 border-t border-[var(--glass-border)] animate-in fade-in slide-in-from-bottom-10 duration-1000">
             <div className="glass-panel p-8 rounded-[2rem] border border-[var(--glass-border)] flex flex-col items-center text-center space-y-2">
                <span className="text-[10px] font-black text-[var(--text-secondary)] opacity-40 uppercase tracking-[0.3em]">Total Components</span>
                <span className="text-4xl font-black text-[var(--text-primary)] tracking-tighter">{sections.length}</span>
             </div>
             <div className="glass-panel p-8 rounded-[2rem] border border-[var(--glass-border)] flex flex-col items-center text-center space-y-2">
                <span className="text-[10px] font-black text-emerald-500 opacity-40 uppercase tracking-[0.3em]">Live Components</span>
                <span className="text-4xl font-black text-emerald-500 tracking-tighter">{sections.filter(s => s.is_active).length}</span>
             </div>
             <div className="glass-panel p-8 rounded-[2rem] border border-[var(--glass-border)] flex flex-col items-center text-center space-y-2">
                <span className="text-[10px] font-black text-blue-500 opacity-40 uppercase tracking-[0.3em]">Scheduled Tasks</span>
                <span className="text-4xl font-black text-blue-500 tracking-tighter">{sections.filter(s => s.scheduled_start).length}</span>
             </div>
             <div className="glass-panel p-8 rounded-[2rem] border border-[var(--glass-border)] flex flex-col items-center text-center space-y-2">
                <span className="text-[10px] font-black text-[var(--accent)] opacity-40 uppercase tracking-[0.3em]">Complexity Score</span>
                <span className="text-4xl font-black text-[var(--accent)] tracking-tighter">{sections.reduce((acc, s) => acc + (s.data?.length || 0), 0)}</span>
             </div>
          </div>
        )}

        {isFormOpen && (
          <SectionForm 
            section={editingSection} 
            onClose={() => setIsFormOpen(false)} 
            onSuccess={() => { setIsFormOpen(false); fetchSections(); }}
          />
        )}

      </div>
    </div>
  );
}

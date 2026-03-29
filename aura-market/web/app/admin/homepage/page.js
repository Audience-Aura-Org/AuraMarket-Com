"use client";
import { useState, useEffect } from 'react';
import api from '@/services/api';
import { 
  MonitorPlay, 
  Plus, 
  GripVertical, 
  Settings2, 
  Trash2, 
  View, 
  CheckCircle2, 
  XCircle,
  Clock,
  ChevronUp,
  ChevronDown,
  Layout,
  Smartphone,
  Tablet,
  MonitorIcon
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
    if (!confirm('Are you sure you want to delete this section?')) return;
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex-col items-center justify-center relative">
        <div className="flex-1 flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-full border-4 border-[var(--accent)]/30 border-t-[var(--accent)] animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] relative">
        <header className="h-20 flex items-center justify-between px-10 glass-panel border-b border-[var(--glass-border)] bg-[var(--bg-primary)] text-[var(--text-primary)]">
          <div className="flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-[var(--accent)]/20 text-[var(--accent)] shadow-lg shadow-[var(--accent)]/5">
              <MonitorPlay className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight mb-0.5 text-[var(--text-primary)]">Storefront Control</h1>
              <span className="px-2.5 py-0.5 bg-[var(--accent)]/10 text-[var(--accent)] text-[10px] font-black tracking-widest rounded-full border border-[var(--accent)]/30 uppercase">
                Dynamic Modular System
              </span>
            </div>
          </div>
          <div className="flex gap-4">
            <button 
               onClick={() => { setEditingSection(null); setIsFormOpen(true); }}
               className="bg-[var(--accent)] text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-[var(--accent)]/30 hover:scale-105 transition-all uppercase tracking-widest text-[10px]"
            >
              <Plus className="w-4 h-4" /> Add Section
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto w-full p-10">
          <div className="max-w-6xl mx-auto space-y-10">
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
              <div className="space-y-1">
                <h1 className="text-4xl font-bold tracking-tighter text-[var(--text-primary)]">
                  Storefront Management
                </h1>
                <p className="text-[var(--text-secondary)] font-bold">Manage your Amazon-style dynamic blocks.</p>
              </div>
              <div className="flex gap-4">
                <button 
                  onClick={() => window.open('/', '_blank')}
                  className="px-6 py-3 rounded-xl bg-[var(--bg-primary)]/50 hover:bg-[var(--accent)]/5 border border-[var(--glass-border)] font-black tracking-widest text-[10px] transition-all flex items-center gap-2 text-[var(--text-primary)] uppercase"
                >
                  <View className="w-4 h-4" /> View Site
                </button>
              </div>
            </div>

            {/* Section List */}
            <div className="space-y-4">
              {sections.map((section, index) => (
                <div 
                  key={section._id} 
                  className={`group glass-panel rounded-3xl border border-[var(--glass-border)] p-6 flex items-center gap-6 hover:border-[var(--accent)]/30 transition-all ${!section.is_active ? 'opacity-60 grayscale-[0.2]' : ''}`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <button onClick={() => handleMove(index, -1)} disabled={index === 0} className="p-1 hover:text-[var(--accent)] disabled:opacity-20 transition-colors">
                      <ChevronUp className="w-6 h-6" />
                    </button>
                    <GripVertical className="w-6 h-6 opacity-20" />
                    <button onClick={() => handleMove(index, 1)} disabled={index === sections.length - 1} className="p-1 hover:text-[var(--accent)] disabled:opacity-20 transition-colors">
                      <ChevronDown className="w-6 h-6" />
                    </button>
                  </div>

                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] bg-[var(--accent)]/10 text-[var(--accent)] px-2 py-1 rounded-md border border-[var(--accent)]/20">
                        {section.type}
                      </span>
                      <h3 className="text-xl font-bold text-[var(--text-primary)]">
                        {section.title || section.type.replace('_', ' ')}
                      </h3>
                    </div>
                    <p className="text-sm text-[var(--text-secondary)] font-medium">
                      {section.data?.length || 0} items configured • {section.is_active ? 'Live' : 'Hidden'}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    {section.scheduled_start && (
                      <div className="flex items-center gap-2 text-[var(--text-secondary)] text-[10px] font-black uppercase tracking-widest border border-[var(--glass-border)] px-3 py-2 rounded-xl">
                        <Clock className="w-4 h-4" /> Scheduled
                      </div>
                    )}

                    <button 
                      onClick={() => handleToggle(section._id, section.is_active)}
                      className={`p-3 rounded-2xl border border-[var(--glass-border)] transition-all ${section.is_active ? 'text-emerald-500 bg-emerald-500/10' : 'text-slate-400'}`}
                    >
                      {section.is_active ? <CheckCircle2 className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
                    </button>

                    <button 
                      onClick={() => { setEditingSection(section); setIsFormOpen(true); }}
                      className="p-3 rounded-2xl border border-[var(--glass-border)] hover:bg-[var(--accent)]/10 hover:text-[var(--accent)] transition-all"
                    >
                      <Settings2 className="w-6 h-6" />
                    </button>

                    <button 
                      onClick={() => handleDelete(section._id)}
                      className="p-3 rounded-2xl border border-[var(--glass-border)] hover:bg-red-500/10 hover:text-red-500 transition-all"
                    >
                      <Trash2 className="w-6 h-6" />
                    </button>
                  </div>
                </div>
              ))}

              {sections.length === 0 && (
                <div className="p-20 text-center glass-panel rounded-[3rem] border border-dashed border-[var(--glass-border)]">
                   <Layout className="w-16 h-16 text-[var(--accent)] mx-auto opacity-20 mb-4" />
                   <h3 className="text-xl font-bold opacity-40">No homepage sections yet</h3>
                   <p className="text-sm opacity-30 mt-2">Click "Add Section" to start building your storefront.</p>
                </div>
              )}
            </div>

            {/* Stats */}
            {!loading && sections.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-12 pb-20">
                <div className="glass-panel p-8 rounded-3xl border border-[var(--glass-border)] text-center space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[var(--accent)]">Total Components</p>
                  <h4 className="text-5xl font-black text-[var(--text-primary)]">{sections.length}</h4>
                </div>
                <div className="glass-panel p-8 rounded-3xl border border-[var(--glass-border)] text-center space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Active Live</p>
                  <h4 className="text-5xl font-black text-[var(--text-primary)]">{sections.filter(s => s.is_active).length}</h4>
                </div>
                <div className="glass-panel p-8 rounded-3xl border border-[var(--glass-border)] text-center space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">Scheduled Events</p>
                  <h4 className="text-5xl font-black text-[var(--text-primary)]">{sections.filter(s => s.scheduled_start).length}</h4>
                </div>
              </div>
            )}
          </div>
        </div>

        {isFormOpen && (
          <SectionForm 
            section={editingSection} 
            onClose={() => setIsFormOpen(false)} 
            onSuccess={() => { setIsFormOpen(false); fetchSections(); }}
          />
        )}
    </div>
  );
}



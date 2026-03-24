"use client";
import { useState, useEffect } from 'react';
import api from '@/services/api';
import { 
  Layout, 
  Plus, 
  GripVertical, 
  Settings2, 
  Trash2, 
  Eye, 
  CheckCircle2, 
  XCircle,
  Clock,
  ChevronUp,
  ChevronDown,
  Save
} from 'lucide-react';
import SectionForm from './components/SectionForm';

export const dynamic = 'force-dynamic';

export default function StorefrontBuilder() {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSection, setEditingSection] = useState(null);

  const fetchSections = async () => {
    try {
      const res = await api.get('/homepage');
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

    // Prepare for API
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
    <div className="min-h-screen bg-[var(--bg-secondary)] p-8">
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-4xl font-black text-[var(--text-primary)] tracking-tight flex items-center gap-3">
              <Layout className="w-8 h-8 text-[var(--accent)]" /> 
              Storefront Builder
            </h1>
            <p className="text-[var(--text-secondary)] font-medium">
              Manage your Amazon-style dynamic homepage blocks.
            </p>
          </div>
          <button 
            onClick={() => { setEditingSection(null); setIsFormOpen(true); }}
            className="bg-[var(--accent)] text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-xl shadow-[var(--accent)]/30 hover:scale-105 transition-all"
          >
            <Plus className="w-5 h-5" /> Add New Section
          </button>
        </div>

        {/* Section List */}
        {loading ? (
          <div className="flex justify-center p-20">
            <div className="w-12 h-12 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            {sections.map((section, index) => (
              <div 
                key={section._id} 
                className={`group glass-panel rounded-3xl border border-[var(--glass-border)] p-6 flex items-center gap-6 hover:border-[var(--accent)]/30 transition-all ${!section.is_active ? 'opacity-60 grayscale-[0.2]' : ''}`}
              >
                {/* Drag Handle & Ordering */}
                <div className="flex flex-col items-center gap-2">
                  <button onClick={() => handleMove(index, -1)} disabled={index === 0} className="p-1 hover:text-[var(--accent)] disabled:opacity-20">
                    <ChevronUp className="w-6 h-6" />
                  </button>
                  <GripVertical className="w-6 h-6 opacity-20" />
                  <button onClick={() => handleMove(index, 1)} disabled={index === sections.length - 1} className="p-1 hover:text-[var(--accent)] disabled:opacity-20">
                    <ChevronDown className="w-6 h-6" />
                  </button>
                </div>

                {/* Section Info */}
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] bg-[var(--accent)]/10 text-[var(--accent)] px-2 py-1 rounded-md">
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

                {/* Status & Actions */}
                <div className="flex items-center gap-3">
                  {section.scheduled_start && (
                    <div className="flex items-center gap-2 text-[var(--text-secondary)] text-xs border border-[var(--glass-border)] px-3 py-2 rounded-xl">
                      <Clock className="w-4 h-4" /> 
                      Scheduled
                    </div>
                  )}

                  <button 
                    onClick={() => handleToggle(section._id, section.is_active)}
                    className={`p-3 rounded-2xl border border-[var(--glass-border)] transition-all ${section.is_active ? 'text-green-500 bg-green-500/10' : 'text-slate-400'}`}
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
          </div>
        )}

        {/* Summary / Stats */}
        {!loading && sections.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-12">
            <div className="glass-panel p-8 rounded-3xl border border-[var(--glass-border)] text-center space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--accent)]">Sections</p>
              <h4 className="text-5xl font-black text-[var(--text-primary)]">{sections.length}</h4>
            </div>
            <div className="glass-panel p-8 rounded-3xl border border-[var(--glass-border)] text-center space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-green-500">Active</p>
              <h4 className="text-5xl font-black text-[var(--text-primary)]">{sections.filter(s => s.is_active).length}</h4>
            </div>
            <div className="glass-panel p-8 rounded-3xl border border-[var(--glass-border)] text-center space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">Scheduled</p>
              <h4 className="text-5xl font-black text-[var(--text-primary)]">{sections.filter(s => s.scheduled_start).length}</h4>
            </div>
          </div>
        )}

        {/* Modal Overlay Component */}
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



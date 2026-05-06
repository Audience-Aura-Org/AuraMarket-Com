'use client';

import { useState, useEffect } from 'react';
import api from '@/services/api';
import { 
  Shield, Clock, User, FileText, Filter, 
  Search, RefreshCw, ChevronRight, AlertTriangle,
  Database, Fingerprint, Activity, Loader2
} from 'lucide-react';
import { toast } from 'react-hot-toast';

import Pagination from '@/components/common/Pagination';

export default function AdminAuditLogs() {
  const [mounted, setMounted] = useState(false);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 7;

  useEffect(() => {
    setMounted(true);
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/audit');
      if (res.data?.success) setLogs(res.data.data.logs || []);
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
      toast.error('Failed to sync security logs');
    } finally {
      setLoading(false);
    }
  };

  const getActionColor = (action) => {
    if (action.includes('resolve') || action.includes('approve')) return 'text-emerald-500 bg-emerald-500/10';
    if (action.includes('reject') || action.includes('delete') || action.includes('ban')) return 'text-rose-500 bg-rose-500/10';
    if (action.includes('change') || action.includes('update')) return 'text-amber-500 bg-amber-500/10';
    return 'text-indigo-500 bg-indigo-500/10';
  };

  const filteredLogs = logs.filter(log => {
      if (activeFilter === 'all') return true;
      return log.target_type === activeFilter;
  });

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const currentLogs = filteredLogs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <header className="min-h-20 py-4 flex flex-col md:flex-row md:h-24 items-center justify-between px-4 md:px-10 border-b border-[var(--glass-border)] bg-[var(--bg-primary)]/80 backdrop-blur-xl sticky top-0 md:top-16 z-40 gap-4 md:gap-0">
        <div className="flex items-center gap-4 md:gap-6 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-4">
            <div className="size-10 md:size-12 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] shadow-inner border border-[var(--accent)]/20 shrink-0">
               <Shield className="w-5 h-5 md:w-6 md:h-6" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-bold text-[var(--text-primary)] tracking-tight">Security <span className="text-[var(--accent)]">Audit</span></h2>
              <div className="flex items-center gap-2 mt-0.5">
                 <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                 <p className="text-[10px] md:text-[11px] lg:text-[12px] font-semibold text-[var(--text-secondary)] tracking-tight opacity-50 uppercase">Live Stream_V3</p>
              </div>
            </div>
          </div>
          <button onClick={fetchLogs} className="md:hidden size-10 rounded-xl border border-[var(--glass-border)] text-[var(--text-secondary)] flex items-center justify-center active:scale-95">
             <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
           <div className="flex bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl p-1 overflow-x-auto no-scrollbar flex-1 md:flex-none justify-between md:justify-start shadow-inner">
              {['all', 'product', 'user', 'dispute'].map(type => (
                <button 
                  key={type}
                  onClick={() => { setActiveFilter(type); setCurrentPage(1); }}
                  className={`px-3 md:px-4 py-1.5 rounded-xl text-[10px] lg:text-[12px] font-bold tracking-tight transition-all uppercase ${activeFilter === type ? 'bg-[var(--accent)] text-white shadow-lg' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] opacity-40'}`}
                >
                  {type}
                </button>
              ))}
           </div>
           <button onClick={fetchLogs} className="hidden md:flex size-11 md:size-12 rounded-2xl border border-[var(--glass-border)] hover:bg-[var(--accent)]/10 text-[var(--text-secondary)] items-center justify-center transition-all shadow-sm active:scale-95">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
           </button>
        </div>
      </header>

      <div className="p-4 md:p-10 space-y-8 pb-32">
         {/* Live Intelligence Metadata */}
         <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
               { label: 'Total Events', value: logs.length, icon: Database, color: 'text-[var(--accent)]', sub: 'REGISTRY' },
               { label: 'High Priority', value: logs.filter(l => l.action.includes('ban')).length, icon: AlertTriangle, color: 'text-rose-500', sub: 'CRITICAL' },
               { label: 'Items Tracked', value: '7 Active', icon: Fingerprint, color: 'text-indigo-500', sub: 'IDENTITY' },
               { label: 'Feed Uptime', value: '99.99%', icon: Activity, color: 'text-emerald-500', sub: 'HEALTH' }
            ].map(s => (
               <div key={s.label} className="group relative p-5 md:p-6 rounded-[2rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 hover:bg-[var(--bg-primary)]/60 transition-all duration-500 backdrop-blur-xl shadow-sm hover:shadow-xl overflow-hidden">
                  <div className="flex items-center justify-between mb-4">
                     <div className={`size-9 rounded-xl bg-[var(--bg-secondary)] flex items-center justify-center ${s.color} border border-[var(--glass-border)] shadow-inner`}>
                        <s.icon className="size-4 opacity-40 group-hover:opacity-100" />
                     </div>
                     <span className="text-[9px] font-bold tracking-[0.2em] text-[var(--text-secondary)] opacity-20 group-hover:opacity-40 uppercase font-mono">{s.sub}</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase opacity-40 mb-1">{s.label}</p>
                    <h3 className={`text-xl font-bold tracking-tight truncate ${s.color}`}>{s.value}</h3>
                  </div>
               </div>
            ))}
         </div>

         {/* Event Stream */}
         <div className="rounded-[2.5rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 overflow-hidden shadow-2xl backdrop-blur-xl">
            <div className="p-6 md:p-8 border-b border-[var(--glass-border)] flex items-center justify-between bg-[var(--bg-secondary)]/20">
               <h3 className="text-xs font-bold text-[var(--text-primary)] tracking-[0.2em] flex items-center gap-3 uppercase">
                  <Clock className="size-4 text-[var(--accent)]" /> Chronological Mutation Stream
               </h3>
               <div className="hidden md:flex items-center gap-2 text-[10px] font-bold text-[var(--text-secondary)] opacity-30 uppercase tracking-[0.3em]">
                  <Filter className="size-3" /> Filter: {activeFilter}
               </div>
            </div>

            <div className="divide-y divide-[var(--glass-border)]/30">
               {loading ? (
                  <div className="py-20 flex flex-col items-center justify-center gap-4 opacity-20">
                     <Loader2 className="animate-spin size-10" />
                     <p className="text-[10px] font-bold uppercase tracking-[0.3em]">Decrypting Stream...</p>
                  </div>
               ) : currentLogs.length > 0 ? (
                  currentLogs.map(log => (
                    <div key={log._id} className="p-6 md:p-8 hover:bg-[var(--accent)]/[0.02] transition-colors group flex flex-col md:flex-row gap-6">
                        <div className="flex items-center md:flex-col md:gap-3 gap-4 shrink-0">
                           <div className="size-12 md:size-14 rounded-2xl border border-[var(--glass-border)] overflow-hidden bg-[var(--bg-secondary)] shadow-inner">
                              {log.user_id?.avatar ? <img src={log.user_id.avatar} className="size-full object-cover" alt="" /> : <User className="size-full p-3 opacity-20" />}
                           </div>
                           <div className="flex-1 md:hidden">
                              <p className="text-[13px] font-bold text-[var(--text-primary)] tracking-tight truncate">{log.user_id?.name || 'System Operator'}</p>
                              <p className="text-[9px] font-bold text-[var(--text-secondary)] opacity-40 uppercase tracking-widest">{log.user_id?.role || 'SYSTEM'}</p>
                           </div>
                           <div className="hidden md:block w-px h-full bg-gradient-to-b from-[var(--glass-border)] to-transparent" />
                        </div>

                        <div className="flex-1 min-w-0">
                           <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                              <div className="hidden md:flex items-center gap-3">
                                 <span className="text-sm font-bold text-[var(--text-primary)] tracking-tight">{log.user_id?.name || 'System Operator'}</span>
                                 <span className="px-2 py-0.5 rounded-lg bg-[var(--bg-secondary)] text-[var(--text-secondary)] text-[10px] font-bold tracking-widest uppercase border border-[var(--glass-border)]">
                                    {log.user_id?.role || 'SYSTEM'}
                                 </span>
                              </div>
                              <div className="flex items-center gap-3 flex-wrap">
                                 <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold tracking-widest uppercase border ${getActionColor(log.action)}`}>
                                    {log.action.replace('_', ' ')}
                                 </span>
                                 <time className="text-[9px] font-bold text-[var(--text-secondary)] opacity-30 uppercase tracking-widest flex items-center gap-2">
                                    <Clock className="w-3 h-3" /> {new Date(log.createdAt).toLocaleString()}
                                 </time>
                              </div>
                           </div>

                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="bg-[var(--bg-secondary)]/30 border border-[var(--glass-border)] p-5 rounded-2xl group-hover:border-[var(--accent)]/30 transition-colors">
                                 <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.2em] mb-3 opacity-40 flex items-center gap-2">
                                    <FileText className="size-3" /> Targeted Entity
                                 </p>
                                 <div className="flex items-center justify-between">
                                    <p className="text-[11px] font-bold text-[var(--text-primary)] flex items-center gap-2">
                                       <span className="opacity-30 uppercase">{log.target_type}:</span>
                                       <span className="font-mono text-[var(--accent)] tracking-tighter">#{log.target_id.slice(-8).toUpperCase()}</span>
                                    </p>
                                    <ChevronRight className="size-4 opacity-20 group-hover:translate-x-1 transition-transform" />
                                 </div>
                              </div>

                              <div className="bg-[var(--bg-secondary)]/30 border border-[var(--glass-border)] p-5 rounded-2xl group-hover:border-[var(--accent)]/30 transition-colors">
                                 <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.2em] mb-3 opacity-40">Mutation Payload</p>
                                 <div className="font-mono text-[10px] text-[var(--text-primary)]/80 leading-relaxed max-h-24 overflow-y-auto no-scrollbar scroll-smooth">
                                    {JSON.stringify(log.changes, null, 2)}
                                 </div>
                              </div>
                           </div>
                        </div>
                    </div>
                  ))
               ) : (
                  <div className="py-40 flex flex-col items-center justify-center opacity-10 px-10 text-center gap-6">
                     <Shield className="w-16 h-16 text-[var(--text-secondary)]" />
                     <p className="text-xs font-bold tracking-[0.4em] uppercase max-w-sm">No System Mutations Recorded</p>
                  </div>
               )}
            </div>

            <div className="p-6 md:p-8 border-t border-[var(--glass-border)] bg-[var(--bg-secondary)]/10 flex justify-center">
               <Pagination 
                   currentPage={currentPage}
                   totalPages={totalPages}
                   onPageChange={setCurrentPage}
               />
            </div>
         </div>
      </div>
    </div>
  );
}

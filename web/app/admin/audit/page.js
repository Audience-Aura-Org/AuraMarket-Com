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
      <header className="h-24 flex items-center justify-between px-10 border-b border-[var(--glass-border)] bg-[var(--bg-primary)] shrink-0 sticky top-16 z-10 backdrop-blur-xl text-[var(--text-primary)]">
        <div className="flex items-center gap-6">
          <div className="size-12 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] shadow-inner">
             <Shield className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[var(--text-primary)] tracking-tight ">System <span className="text-[var(--accent)]">Audit</span> Ledger</h2>
            <div className="flex items-center gap-2 mt-1">
               <div className="size-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
               <p className="text-[10px] font-bold text-[var(--text-secondary)] tracking-tight  opacity-50">Monitoring immutable event stream</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
           <div className="flex items-center gap-2 bg-[var(--bg-secondary)]/50 p-1 rounded-xl border border-[var(--glass-border)]">
              {['all', 'product', 'user', 'dispute', 'transaction'].map(type => (
                <button 
                  key={type}
                  onClick={() => { setActiveFilter(type); setCurrentPage(1); }}
                  className={`px-4 py-2 rounded-lg text-[9px] font-bold tracking-tight transition-all ${activeFilter === type ? 'bg-[var(--accent)] text-white shadow-lg' : 'text-[var(--text-secondary)] hover:bg-[var(--glass-border)]'}`}
                >
                  {type}
                </button>
              ))}
           </div>
           <button onClick={fetchLogs} className="p-3 rounded-xl border border-[var(--glass-border)] hover:bg-[var(--accent)]/10 text-[var(--text-secondary)] transition-all">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
           </button>
        </div>
      </header>

      <div className="p-10 space-y-8 pb-32">
         {/* Live Metadata */}
         <div className="grid grid-cols-4 gap-4">
            {[
               { label: 'Total Events', value: logs.length, icon: Database, color: 'text-[var(--accent)]' },
               { label: 'High Priority', value: logs.filter(l => l.action.includes('ban')).length, icon: AlertTriangle, color: 'text-rose-500' },
               { label: 'Nodes Tracked', value: '7 Active', icon: Fingerprint, color: 'text-indigo-500' },
               { label: 'Feed Uptime', value: '99.99%', icon: Activity, color: 'text-emerald-500' }
            ].map(s => (
               <div key={s.label} className="glass-panel p-6 rounded-[2rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 hover:-translate-y-1 transition-all">
                  <p className="text-[9px] font-bold text-[var(--text-secondary)]  tracking-[0.2em] mb-2 opacity-40">{s.label}</p>
                  <div className="flex items-center justify-between">
                     <h3 className={`text-2xl font-bold ${s.color}`}>{s.value}</h3>
                     <s.icon className={`w-5 h-5 ${s.color} opacity-20`} />
                  </div>
               </div>
            ))}
         </div>

         {/* Event Stream */}
         <div className="glass-panel rounded-[2.5rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 overflow-hidden shadow-2xl">
            <div className="p-8 border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/30 flex items-center justify-between">
               <h3 className="text-sm font-bold text-[var(--text-primary)] tracking-tight flex items-center gap-3">
                  <Clock className="w-4 h-4 text-[var(--accent)]" /> 
                  Chronological Mutation Stream
               </h3>
               <div className="flex items-center gap-2 text-[10px] font-bold text-[var(--text-secondary)] opacity-50 tracking-tight">
                  <Filter className="w-3.5 h-3.5" /> Filter Applied: {activeFilter}
               </div>
            </div>

            <div className="divide-y divide-[var(--glass-border)]/50">
               {loading ? (
                  <div className="py-40 flex flex-col items-center justify-center opacity-30">
                     <Loader2 className="w-10 h-10 animate-spin mb-4 text-[var(--accent)]" />
                     <p className="text-[10px] font-bold tracking-tight">Decrypting Mutation Stream...</p>
                  </div>
               ) : currentLogs.length > 0 ? (
                  currentLogs.map(log => (
                    <div key={log._id} className="p-8 hover:bg-[var(--accent)]/[0.02] transition-colors group flex items-start gap-8">
                        <div className="flex flex-col items-center gap-3 py-1">
                           <div className="size-10 rounded-full border border-[var(--glass-border)] overflow-hidden bg-[var(--bg-secondary)] shadow-sm">
                              {log.user_id?.avatar ? <img src={log.user_id.avatar} className="size-full object-cover" /> : <User className="size-full p-2.5 opacity-30" />}
                           </div>
                           <div className="w-px h-full bg-gradient-to-b from-[var(--glass-border)] to-transparent" />
                        </div>

                        <div className="flex-1 min-w-0">
                           <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-3">
                                 <span className="text-sm font-bold text-[var(--text-primary)] tracking-tight">{log.user_id?.name || 'System Operator'}</span>
                                 <span className="px-3 py-1 rounded-lg bg-[var(--bg-secondary)] text-[var(--text-secondary)] text-[8px] font-bold tracking-tight border border-[var(--glass-border)]">
                                    {log.user_id?.role || 'SYSTEM'}
                                 </span>
                                 <span className={`px-3 py-1 rounded-lg text-[8px] font-bold tracking-tight ${getActionColor(log.action)}`}>
                                    {log.action.replace('_', ' ')}
                                 </span>
                              </div>
                              <time className="text-[9px] font-bold text-[var(--text-secondary)] opacity-40 tracking-tight flex items-center gap-2">
                                 <Clock className="w-3 h-3" /> {new Date(log.createdAt).toLocaleString()}
                              </time>
                           </div>

                           <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                              <div className="bg-[var(--bg-secondary)]/30 border border-[var(--glass-border)] p-5 rounded-2xl">
                                 <p className="text-[8px] font-bold text-[var(--text-secondary)]  tracking-[0.2em] mb-3 opacity-50 flex items-center gap-2">
                                    <FileText className="w-3 h-3" /> Targeted Entity
                                 </p>
                                 <div className="flex items-center justify-between">
                                    <p className="text-[11px] font-bold text-[var(--text-primary)] flex items-center gap-2">
                                       <span className=" opacity-40">{log.target_type}:</span>
                                       <span className="font-mono text-[var(--accent)] tracking-tighter">#{log.target_id.slice(-8).toUpperCase()}</span>
                                    </p>
                                    <ChevronRight className="w-4 h-4 opacity-20 group-hover:translate-x-1 transition-transform" />
                                 </div>
                              </div>

                              <div className="bg-[var(--bg-secondary)]/30 border border-[var(--glass-border)] p-5 rounded-2xl overflow-hidden">
                                 <p className="text-[8px] font-bold text-[var(--text-secondary)]  tracking-[0.2em] mb-3 opacity-50">Mutation Payload</p>
                                 <div className="font-mono text-[10px] text-[var(--text-primary)]/80 leading-relaxed max-h-20 overflow-y-auto no-scrollbar">
                                    {JSON.stringify(log.changes, null, 2)}
                                 </div>
                              </div>
                           </div>
                        </div>
                    </div>
                  ))
               ) : (
                  <div className="py-40 flex flex-col items-center justify-center opacity-20 px-10 text-center">
                     <Shield className="w-16 h-16 mb-8 text-[var(--text-secondary)]" />
                     <p className="text-sm font-bold  tracking-[0.2em] leading-relaxed max-w-sm">No system mutations recorded in this vector.</p>
                  </div>
               )}
            </div>

            <div className="p-8 border-t border-[var(--glass-border)] bg-[var(--bg-secondary)]/10">
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

"use client";

import { useState, useEffect } from 'react';
import { 
  Zap, Activity, Shield, Terminal, 
  Search, Filter, RefreshCw, AlertCircle,
  Database, User, ShoppingBag, Truck, Lock
} from 'lucide-react';
import api from '@/services/api';

import Pagination from '@/components/common/Pagination';

const LOG_TYPES = {
  auth: { icon: Lock, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  order: { icon: ShoppingBag, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  system: { icon: Terminal, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  logistics: { icon: Truck, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  security: { icon: Shield, color: 'text-rose-500', bg: 'bg-rose-500/10' }
};

export default function AdminLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      // Mocking 20 logs to demonstrate pagination
      const mockLogs = Array.from({ length: 20 }, (_, i) => ({
        id: i + 1,
        type: ['auth', 'order', 'security', 'system', 'logistics'][i % 5],
        action: `Event ${i+1}`,
        details: `Log details for event ${i+1} at node calibration layer.`,
        time: `${i * 10} mins ago`,
        user: i % 2 === 0 ? 'Admin' : 'System'
      }));
      setLogs(mockLogs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(logs.length / itemsPerPage);
  const currentLogs = logs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] py-12 px-6 md:px-12 transition-all duration-300">
      <div className="max-w-5xl mx-auto space-y-12">
        {/* ... header (kept same) ... */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-6 border-b border-[var(--glass-border)]">
           <div className="flex items-center gap-4">
              <div className="size-12 rounded-xl bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center">
                 <Terminal className="size-6" />
              </div>
              <div className="space-y-0.5">
                 <h1 className="text-2xl  font-bold text-[var(--text-primary)] tracking-tight">Audit Trail</h1>
                 <p className="text-[11px] lg:text-[12px]  font-semibold  tracking-[0.2em] text-[var(--text-secondary)] opacity-40">System-wide Event Log</p>
              </div>
           </div>

           <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative group w-full md:w-64">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-[var(--text-secondary)] opacity-20" />
                 <input 
                   type="text" 
                   placeholder="Search hashes..." 
                   className="w-full h-10 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl pl-10 pr-4 text-xs focus:border-[var(--accent)]/50 focus:ring-4 focus:ring-[var(--accent)]/5 transition-all outline-none text-[var(--text-primary)]"
                 />
              </div>
              <button className="h-10 px-4 rounded-xl border border-[var(--glass-border)] text-[var(--text-secondary)] hover:bg-white/5 transition-all">
                 <Filter className="size-4" />
              </button>
           </div>
        </div>

        {/* Dense List */}
        <div className="space-y-3 min-h-[600px]">
           {loading ? (
             [...Array(6)].map((_, i) => (
                <div key={i} className="h-24 rounded-2xl bg-[var(--bg-primary)]/40 border border-[var(--glass-border)] animate-pulse" />
             ))
           ) : (
             currentLogs.map(log => {
               const config = LOG_TYPES[log.type] || LOG_TYPES.system;
               return (
                 <div key={log.id} className="p-4 rounded-2xl bg-[var(--bg-primary)]/40 border border-[var(--glass-border)] hover:border-[var(--accent)]/30 transition-all flex items-center gap-6 group">
                   <div className={`size-10 rounded-xl ${config.bg} ${config.color} flex items-center justify-center shrink-0`}>
                      <config.icon className="size-5" />
                   </div>
                   
                   <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                         <h3 className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-primary)] tracking-tight">{log.action}</h3>
                         <span className="text-[10px] lg:text-[12px] font-medium text-[var(--text-secondary)] opacity-30 tracking-tight">{log.time}</span>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] opacity-60 truncate font-mono">{log.details}</p>
                   </div>

                   <div className="hidden md:flex flex-col items-end shrink-0">
                      <span className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] opacity-30 ">Operator</span>
                      <span className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-primary)]">{log.user}</span>
                   </div>
                 </div>
               );
             })
           )}
        </div>

        <Pagination 
          currentPage={currentPage} 
          totalPages={totalPages} 
          onPageChange={setCurrentPage} 
        />

        <div className="text-center pb-20 opacity-20">
           <p className="text-[11px] lg:text-[12px]  font-semibold tracking-[0.4em] text-[var(--text-secondary)] ">
              Authenticated Governance Logs // Node Aura_Audit_Master
           </p>
        </div>
      </div>
    </div>
  );
}

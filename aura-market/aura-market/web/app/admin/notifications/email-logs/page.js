'use client';

import { useState, useEffect } from 'react';
import { 
  Mail, Search, Filter, RefreshCcw, 
  CheckCircle, XCircle, Clock, User, 
  ArrowRight, ShieldAlert, ChevronLeft, ChevronRight
} from 'lucide-react';
import api from '@/services/api';
import { toast } from 'react-hot-toast';

/**
 * Admin: Email Audit Logs
 * A high-fidelity diagnostic board to track all platform SMTP transmissions.
 */
export default function EmailLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/notifications/email-logs?page=${page}&search=${search}&status=${status}`);
      if (res.data.success) {
        setLogs(res.data.data.emailLogs);
        setTotal(res.data.total);
      }
    } catch (err) {
      toast.error("Failed to sync Signal Audit.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, status]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)] text-[var(--text-primary)] pb-20">
      {/* Header Grid */}
      <div className="p-10 lg:px-20 space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-4 opacity-50">
              <Mail className="size-4" />
              <span className="text-[10px] font-black tracking-widest uppercase">Platform Intelligence</span>
            </div>
            <h1 className="text-6xl font-black tracking-tighter uppercase leading-none">Signal <span className="text-[var(--accent)]">Audit</span></h1>
            <p className="text-sm font-medium text-[var(--text-secondary)] mt-4">Monitoring SMTP transmissions and delivery coordinates across the notification grid.</p>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={fetchLogs}
              className="size-12 rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] flex items-center justify-center hover:bg-[var(--accent)] hover:text-white transition-all group"
            >
              <RefreshCcw className={`size-5 ${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-700'}`} />
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="glass-panel p-4 rounded-3xl border border-[var(--glass-border)] flex flex-col md:flex-row items-center gap-4 bg-[var(--bg-primary)]/40">
           <form onSubmit={handleSearch} className="flex-1 relative group w-full">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 size-4 opacity-20 group-focus-within:text-[var(--accent)] transition-all" />
              <input 
                placeholder="Search by recipient or subject..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-14 pr-6 py-4 rounded-2xl bg-[var(--bg-secondary)] border border-transparent focus:border-[var(--accent)]/30 outline-none text-sm font-bold transition-all"
              />
           </form>
           <div className="flex items-center gap-2 p-1 bg-[var(--bg-secondary)] rounded-2xl border border-[var(--glass-border)]">
              {['all', 'sent', 'failed'].map(s => (
                <button
                  key={s}
                  onClick={() => { setStatus(s); setPage(1); }}
                  className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${status === s ? 'bg-[var(--accent)] text-white shadow-lg' : 'opacity-40 hover:opacity-100'}`}
                >
                  {s}
                </button>
              ))}
           </div>
        </div>

        {/* Audit Table */}
        <div className="glass-panel rounded-[40px] border border-[var(--glass-border)] overflow-hidden bg-[var(--bg-primary)]/20">
           <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                 <thead>
                    <tr className="border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/30">
                       <th className="p-8 text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Timestamp</th>
                       <th className="p-8 text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Recipient Node</th>
                       <th className="p-8 text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Subject / Role</th>
                       <th className="p-8 text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Status</th>
                       <th className="p-8 text-[10px] font-black uppercase tracking-[0.2em] opacity-40 text-right">Action</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-[var(--glass-border)]/50">
                    {loading ? (
                      [...Array(5)].map((_, i) => (
                        <tr key={i} className="animate-pulse">
                          {[...Array(5)].map((_, j) => <td key={j} className="p-8"><div className="h-4 bg-white/5 rounded-full w-24"></div></td>)}
                        </tr>
                      ))
                    ) : logs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-20 text-center">
                           <div className="flex flex-col items-center gap-4 opacity-20">
                              <ShieldAlert className="size-12" />
                              <p className="text-sm font-black uppercase tracking-widest">No signals detected in the audit log.</p>
                           </div>
                        </td>
                      </tr>
                    ) : logs.map((log) => (
                      <tr key={log._id} className="group hover:bg-white/[0.02] transition-colors">
                         <td className="p-8">
                            <div className="flex items-center gap-3">
                               <Clock className="size-4 opacity-20" />
                               <div>
                                  <p className="text-sm font-bold font-mono">{new Date(log.timestamp).toLocaleTimeString()}</p>
                                  <p className="text-[10px] opacity-40 font-bold uppercase">{new Date(log.timestamp).toLocaleDateString()}</p>
                               </div>
                            </div>
                         </td>
                         <td className="p-8">
                            <div className="flex items-center gap-4">
                               <div className="size-10 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center">
                                  <User className="size-5 opacity-40" />
                               </div>
                               <div>
                                  <p className="text-sm font-black truncate max-w-[200px]">{log.recipient_user_id?.name || 'External Consignee'}</p>
                                  <p className="text-[11px] font-medium opacity-60">{log.recipient_email}</p>
                                </div>
                            </div>
                         </td>
                         <td className="p-8">
                            <div>
                               <p className="text-[11px] font-black uppercase tracking-tight mb-1">{log.subject}</p>
                               <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest border ${
                                 log.role === 'logistics' ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' :
                                 log.role === 'vendor' ? 'bg-blue-500/10 border-blue-500/20 text-blue-500' :
                                 'bg-white/5 border-white/10 opacity-60'
                               }`}>
                                 {log.role}
                               </span>
                            </div>
                         </td>
                         <td className="p-8">
                            <div className="flex items-center gap-2">
                               {log.status === 'sent' ? (
                                  <>
                                    <CheckCircle className="size-4 text-emerald-500" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Delivered</span>
                                  </>
                               ) : (
                                  <>
                                    <XCircle className="size-4 text-red-500" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-red-500">Failed</span>
                                  </>
                               )}
                            </div>
                            {log.error && <p className="text-[9px] text-red-500/60 font-medium mt-1 max-w-[150px] truncate">{log.error}</p>}
                         </td>
                         <td className="p-8 text-right">
                            <button className="px-6 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[9px] font-black uppercase tracking-widest hover:bg-[var(--accent)] hover:text-white hover:border-transparent transition-all">
                               View Trace
                            </button>
                         </td>
                      </tr>
                    ))}
                 </tbody>
              </table>
           </div>

           {/* Pagination */}
           <div className="p-8 border-t border-[var(--glass-border)] bg-[var(--bg-secondary)]/20 flex items-center justify-between">
              <p className="text-[10px] font-black opacity-40 uppercase tracking-widest">
                 Showing {logs.length} of {total} Signals
              </p>
              <div className="flex items-center gap-2">
                 <button 
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="size-10 rounded-xl bg-[var(--bg-primary)] border border-[var(--glass-border)] flex items-center justify-center disabled:opacity-20 hover:border-[var(--accent)] transition-all"
                 >
                   <ChevronLeft className="size-4" />
                 </button>
                 <div className="h-10 px-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center text-xs font-black">
                   {page}
                 </div>
                 <button 
                  onClick={() => setPage(p => p + 1)}
                  disabled={logs.length < 50}
                  className="size-10 rounded-xl bg-[var(--bg-primary)] border border-[var(--glass-border)] flex items-center justify-center disabled:opacity-20 hover:border-[var(--accent)] transition-all"
                 >
                   <ChevronRight className="size-4" />
                 </button>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}

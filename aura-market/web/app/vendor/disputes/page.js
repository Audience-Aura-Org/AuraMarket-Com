"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { 
  AlertTriangle, Shield, CheckCircle2, Search,
  TrendingUp, RefreshCw, Box, User
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import api from '@/services/api';
import RoleSidebar from '@/components/layout/RoleSidebar';
import { useAuthStore } from '@/hooks/useAuth';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function VendorDisputesPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchDisputes = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/vendors/disputes');
      if (res.data.success) {
        setDisputes(res.data.data.disputes || []);
      }
    } catch (err) {
      console.error('Failed to fetch disputes:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { 
    if (!user || user.role !== 'vendor') return;
    let mounted = true;
    if (mounted) fetchDisputes(); 
    return () => { mounted = false; };
  }, [fetchDisputes, user]);

  const filtered = disputes.filter(d => {
    const orderStr = (d.order_id?._id || '').toLowerCase();
    const reasonStr = (d.reason || '').toLowerCase();
    return orderStr.includes(search.toLowerCase()) || reasonStr.includes(search.toLowerCase());
  });

  const activeCount = disputes.filter(d => d.status !== 'resolved').length;

  if (user?.role !== 'vendor') return null;

  return (
    <>
      <header className="h-20 lg:h-24 flex flex-col lg:flex-row lg:items-center justify-between px-6 lg:px-10 border-b border-[var(--glass-border)] bg-[var(--bg-primary)]/50 shrink-0 z-10 py-4 lg:py-0 gap-4 lg:gap-0">
        <div className="flex items-center gap-4 lg:gap-6">
          <h2 className="text-lg lg:text-xl font-black text-[var(--text-primary)] tracking-tight uppercase">Resolution <span className="text-rose-500">Center</span></h2>
          <div className="hidden sm:block h-6 w-px bg-[var(--glass-border)] opacity-30" />
          <p className="text-[var(--text-secondary)] text-[9px] font-black uppercase tracking-[0.3em] opacity-40"><span>{disputes.length}</span> Protocol Anomalies</p>
        </div>

        <div className="flex items-center gap-3 lg:gap-4 self-end lg:self-auto">
          <button onClick={fetchDisputes} className="p-2 lg:p-2.5 rounded-xl border border-[var(--glass-border)] hover:bg-[var(--accent)]/10 transition-all text-[var(--text-secondary)]">
            <RefreshCw className={`w-3.5 h-3.5 lg:w-4 lg:h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <div className="bg-rose-500/10 text-rose-500 px-4 lg:px-6 py-2 lg:py-3 rounded-xl lg:rounded-2xl font-black text-[8px] lg:text-[10px] uppercase tracking-widest border border-rose-500/20 shadow-lg shadow-rose-500/10">
             Override Hub
          </div>
        </div>
      </header>

      <div className="p-4 lg:p-10 space-y-6 lg:space-y-10 pb-32">
           {/* Dynamic Override Matrix */}
           <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-6 mt-2">
              <div className="glass-panel p-4 lg:p-6 rounded-[24px] lg:rounded-[40px] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 flex items-center gap-3 lg:gap-6 shadow-sm">
                 <div className="size-10 lg:size-16 rounded-xl lg:rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center shrink-0">
                    <AlertTriangle className="size-5 lg:size-8" />
                 </div>
                 <div className="min-w-0">
                    <p className="text-[7px] lg:text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] opacity-60">Active Cases</p>
                    <h2 className="text-base lg:text-3xl font-black tracking-tighter mt-0.5 lg:mt-1 font-mono">{activeCount}</h2>
                 </div>
              </div>
              
              <div className="glass-panel p-4 lg:p-6 rounded-[24px] lg:rounded-[40px] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 flex items-center gap-3 lg:gap-6 shadow-sm">
                 <div className="size-10 lg:size-16 rounded-xl lg:rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="size-5 lg:size-8" />
                 </div>
                 <div className="min-w-0">
                    <p className="text-[7px] lg:text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] opacity-60">Resolved</p>
                    <h2 className="text-base lg:text-3xl font-black tracking-tighter mt-0.5 lg:mt-1 font-mono">{disputes.length - activeCount}</h2>
                 </div>
              </div>

              <div className="hidden lg:flex glass-panel p-6 rounded-[40px] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 items-center gap-6 shadow-sm col-span-2 lg:col-span-1">
                 <div className="size-16 rounded-2xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 flex items-center justify-center shrink-0">
                    <Shield className="size-8" />
                 </div>
                 <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] opacity-60">Arbitration</p>
                    <h2 className="text-xl font-black tracking-tighter mt-1 uppercase text-indigo-500 px-3 py-1 bg-indigo-500/10 rounded-lg inline-block text-[9px] whitespace-nowrap">Admin Oversight Active</h2>
                 </div>
              </div>
           </div>

           {/* Query Input Terminal */}
           <div className="relative w-full lg:w-96 group">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-[var(--text-secondary)] group-focus-within:text-rose-500 transition-colors opacity-40" />
             <input 
               type="text" 
               placeholder="Filter Anomalies ID/Reason..." 
               value={search}
               onChange={e => setSearch(e.target.value)}
               className="w-full bg-[var(--bg-primary)]/50 border border-[var(--glass-border)] rounded-2xl pl-11 pr-4 py-3 lg:py-4 text-[10px] lg:text-xs font-black focus:border-rose-500/40 outline-none transition-all shadow-xl placeholder:tracking-widest placeholder:uppercase placeholder:opacity-30 uppercase tracking-tighter"
             />
           </div>

           {/* Dispute Grid - High Density Protocol */}
           {loading ? (
             <div className="py-20 flex justify-center"><div className="animate-spin size-8 lg:size-10 border-2 border-rose-500 border-t-transparent rounded-full shadow-lg shadow-rose-500/20" /></div>
           ) : filtered.length === 0 ? (
             <div className="py-20 lg:py-40 flex flex-col items-center justify-center text-center max-w-md mx-auto">
                <div className="size-20 lg:size-28 rounded-[28px] lg:rounded-[40px] bg-[var(--bg-primary)] opacity-40 border border-[var(--glass-border)] flex items-center justify-center mb-8 relative group">
                   <Shield className="size-10 lg:size-14 text-[var(--text-secondary)] group-hover:scale-110 transition-transform" />
                </div>
                <h3 className="text-xl lg:text-2xl font-black uppercase tracking-tighter text-[var(--text-primary)]">System Equilibrium</h3>
                <p className="text-[10px] lg:text-xs font-black uppercase tracking-[0.25em] text-[var(--text-secondary)] mt-4 opacity-40 leading-relaxed">No protocol overrides or anomalies detected in current market cycle.</p>
             </div>
           ) : (
             <div className="grid gap-4 lg:gap-8">
                {filtered.map(d => (
                  <div key={d._id} className="glass-panel p-6 lg:p-10 rounded-[32px] lg:rounded-[56px] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 hover:bg-[var(--bg-primary)]/60 transition-all shadow-2xl relative overflow-hidden flex flex-col lg:flex-row gap-6 lg:gap-10 group/row">
                     <div className={`absolute left-0 top-0 bottom-0 w-1.5 transition-all group-hover/row:w-2 ${d.status === 'resolved' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                     
                     <div className="lg:w-[320px] lg:border-r border-[var(--glass-border)] lg:pr-10 flex flex-col justify-between gap-6">
                        <div>
                           <div className="flex items-center gap-3">
                              <span className={`px-4 py-2 rounded-xl text-[8px] lg:text-[9px] font-black uppercase tracking-widest border transition-all ${
                                d.status === 'resolved' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20 animate-pulse'
                              }`}>
                                {d.status === 'resolved' ? 'Archive: Settled' : 'Protocol: Active'}
                              </span>
                           </div>
                           <h4 className="text-base lg:text-xl font-black tracking-tight mt-4 uppercase group-hover/row:text-[var(--accent)] transition-colors leading-tight">{d.reason.replace(/_/g, ' ')}</h4>
                           <p className="text-[8px] lg:text-[10px] font-black tracking-widest uppercase text-[var(--text-secondary)] opacity-30 mt-1 lg:mt-2">ANOMALY NODE: {d._id.slice(-12).toUpperCase()}</p>
                        </div>
                        
                        <div className="flex items-center gap-4 p-3 lg:p-4 rounded-2xl bg-[var(--bg-secondary)]/30 border border-[var(--glass-border)]">
                           <div className="size-10 lg:size-12 rounded-xl lg:rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] flex items-center justify-center shadow-inner group-hover/row:scale-110 transition-transform">
                              <User className="size-5 lg:size-6 text-[var(--accent)] opacity-40" />
                           </div>
                           <div className="min-w-0">
                              <p className="text-[8px] lg:text-[9px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] opacity-40">Counterparty Agent</p>
                              <p className="text-xs lg:text-sm font-black truncate text-[var(--text-primary)]">{d.initiator_id?.name || 'TERMINAL CLIENT'}</p>
                           </div>
                        </div>
                     </div>

                     <div className="flex-1 space-y-4 lg:space-y-6 flex flex-col justify-center">
                        <div className="p-5 lg:p-8 rounded-[24px] lg:rounded-[36px] bg-[var(--bg-secondary)]/50 border border-[var(--glass-border)] shadow-inner relative group/note">
                           <div className="absolute top-4 right-6 opacity-10 group-hover/note:opacity-40 transition-opacity">
                              <span className="material-symbols-outlined text-4xl lg:text-6xl uppercase">format_quote</span>
                           </div>
                           <p className="text-[8px] lg:text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] opacity-30 mb-3 lg:mb-4">Internal Signal Manifest</p>
                           <p className="text-xs lg:text-base font-black leading-relaxed italic text-[var(--text-primary)] pr-10">"{d.description}"</p>
                        </div>

                        {d.status === 'resolved' && d.admin_notes && (
                          <div className="p-5 lg:p-6 rounded-[24px] lg:rounded-[32px] bg-indigo-500/5 border border-indigo-500/20 shadow-lg shadow-indigo-500/5">
                             <p className="text-[8px] lg:text-[10px] font-black uppercase tracking-widest text-indigo-500 mb-2 flex items-center gap-2">
                                <Shield className="size-3" />
                                Arbitration Resolution ({d.resolution_type?.replace(/_/g, ' ')})
                             </p>
                             <p className="text-[10px] lg:text-xs font-bold leading-relaxed text-[var(--text-primary)]">"{d.admin_notes}"</p>
                          </div>
                        )}
                     </div>

                     <div className="lg:w-[280px] flex flex-col justify-between gap-6 lg:items-end lg:text-right pt-6 lg:pt-0 lg:border-l border-[var(--glass-border)] lg:pl-10">
                        <div className="space-y-2 lg:space-y-3">
                           <p className="text-[8px] lg:text-[10px] font-black uppercase tracking-[0.25em] text-[var(--text-secondary)] opacity-30">Transaction Node</p>
                           <p className="text-sm lg:text-lg font-black tracking-widest font-mono text-[var(--text-primary)]">#{d.order_id?._id?.slice(-10).toUpperCase()}</p>
                           <div className="flex items-center gap-2 lg:justify-end">
                              <span className="text-[10px] lg:text-xs font-black text-rose-500 font-mono">{(d.order_id?.total_amount || 0).toLocaleString()}</span>
                              <span className="text-[8px] lg:text-[10px] font-black text-rose-500 uppercase tracking-tighter opacity-40">Locked XAF</span>
                           </div>
                        </div>
                        <div className="w-full lg:w-auto">
                           {d.status !== 'resolved' ? (
                             <div className="px-6 py-4 lg:py-5 border border-amber-500/20 rounded-[20px] lg:rounded-[28px] bg-amber-500/5 shadow-xl shadow-amber-500/5 group/pulse transition-all">
                                <p className="text-[8px] lg:text-[10px] font-black uppercase tracking-widest text-amber-500 animate-pulse text-center">
                                   Arbitration in Progress
                                </p>
                             </div>
                           ) : (
                             <div className="px-6 py-4 lg:py-5 border border-emerald-500/20 rounded-[20px] lg:rounded-[28px] bg-emerald-500/5 transition-all shadow-xl shadow-emerald-500/5">
                                <p className="text-[8px] lg:text-[10px] font-black uppercase tracking-widest text-emerald-500 text-center">
                                   Network Settle Verified
                                </p>
                             </div>
                           )}
                        </div>
                     </div>
                  </div>
                ))}
             </div>
           )}
      </div>
    </>
  );
}



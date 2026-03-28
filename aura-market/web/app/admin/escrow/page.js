"use client";

import { useState, useEffect } from 'react';
import { 
  ShieldCheck, Lock, Unlock, History, 
  DollarSign, ArrowUpRight, ArrowDownLeft, RefreshCw
} from 'lucide-react';
import RoleSidebar from '@/components/layout/RoleSidebar';
import api from '@/services/api';
import { toast } from 'react-hot-toast';

export const dynamic = 'force-dynamic';

export default function AdminEscrow() {
  const [mounted, setMounted] = useState(false);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
    fetchEscrow();
  }, []);

  const fetchEscrow = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/escrow/logs');
      if (res.data?.success) {
        setLogs(res.data.data.logs || []);
        setStats(res.data.data.stats || []);
      }
    } catch (err) {
      console.error('Failed to fetch escrow data:', err);
      toast.error('Failed to sync with secure vault');
    } finally {
      setLoading(false);
    }
  };

  const heldTotal = stats.find(s => s._id === 'held')?.totalAmount || 0;
  const releasedTotal = stats.find(s => s._id === 'released')?.totalAmount || 0;

  if (!mounted) return null;

  return (
    <>
      <header className="h-20 lg:h-24 flex items-center justify-between px-6 lg:px-10 border-b border-[var(--glass-border)] bg-[var(--bg-primary)] shrink-0 z-10 text-[var(--text-primary)]">
        <div className="flex items-center gap-4 lg:gap-6">
          <h2 className="text-lg lg:text-xl font-black text-[var(--text-primary)] tracking-tight uppercase">Escrow <span className="text-[var(--accent)]">Vault</span></h2>
          <div className="hidden sm:block h-6 w-px bg-[var(--glass-border)] opacity-30" />
          <div className="hidden sm:block px-3 lg:px-4 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[8px] lg:text-[9px] font-black tracking-widest uppercase shadow-sm">
              Monitoring Active
           </div>
        </div>
        <button onClick={fetchEscrow} className="p-2 lg:p-2.5 rounded-lg border border-[var(--glass-border)] hover:bg-[var(--accent)]/10 transition-all text-[var(--text-secondary)]">
           <RefreshCw className={`w-3.5 h-3.5 lg:w-4 lg:h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      <div className="p-4 lg:p-10 space-y-6 lg:space-y-10 pb-32">
         {/* Vault State */}
         <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
            {[
              { label: 'Funds Under Custody', value: `${heldTotal.toLocaleString()} XAF`, icon: Lock, color: 'text-[var(--accent)]' },
              { label: 'Settled Capital', value: `${releasedTotal.toLocaleString()} XAF`, icon: Unlock, color: 'text-emerald-500' },
              { label: 'Active Escrows', value: logs.filter(l => l.status === 'held').length, icon: ShieldCheck, color: 'text-indigo-500' },
              { label: 'Platform Trust Level', value: 'Immutable', icon: History, color: 'text-amber-500' }
            ].map(s => (
              <div key={s.label} className="glass-panel p-4 lg:p-5 rounded-2xl lg:rounded-[2rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 hover:scale-[1.02] transition-all shadow-sm">
                 <p className="text-[7px] lg:text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] mb-1 opacity-50">{s.label}</p>
                 <h3 className={`text-base lg:text-xl font-black ${s.color} tracking-tight`}>{s.value}</h3>
              </div>
            ))}
         </div>

         {/* Transaction Ledger */}
         <div className="glass-panel rounded-[24px] lg:rounded-[32px] overflow-hidden border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 shadow-xl">
            <div className="overflow-x-auto scroll-smooth">
               <table className="w-full text-left min-w-[800px] lg:min-w-0">
                  <thead>
                     <tr className="text-[8px] lg:text-[10px] font-black tracking-[0.3em] uppercase text-[var(--text-secondary)] border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/30">
                        <th className="px-6 lg:px-8 py-4 lg:py-5">Vault Trace</th>
                        <th className="px-4 lg:px-6 py-4 lg:py-5">Counterparties</th>
                        <th className="px-4 lg:px-6 py-4 lg:py-5">Amount (XAF)</th>
                        <th className="px-4 lg:px-6 py-4 lg:py-5">Protocol State</th>
                        <th className="px-6 lg:px-8 py-4 lg:py-5 text-right">Timestamp</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--glass-border)]/50">
                     {logs.map(l => (
                       <tr key={l._id} className="hover:bg-[var(--accent)]/5 transition-colors group">
                          <td className="px-6 lg:px-8 py-4 lg:py-5">
                             <div className="flex items-center gap-3">
                                <div className={`p-2 lg:p-2.5 rounded-lg flex-shrink-0 ${l.status === 'held' ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'} shadow-sm border border-current opacity-30 group-hover:opacity-100 transition-opacity`}>
                                   {l.status === 'held' ? <Lock className="size-3.5 lg:size-4" /> : <Unlock className="size-3.5 lg:size-4" />}
                                </div>
                                <div className="min-w-0">
                                   <p className="text-xs lg:text-sm font-black text-[var(--text-primary)] uppercase tracking-tight font-mono">Order #{l.order_id?._id?.slice(-8) || 'LEGACY'}</p>
                                   <p className="text-[8px] lg:text-[9px] font-bold text-[var(--text-secondary)] opacity-50">ID: {l._id.slice(-12)}</p>
                                </div>
                             </div>
                          </td>
                          <td className="px-4 lg:px-6 py-4 lg:py-5">
                             <div className="flex flex-col gap-1 min-w-0">
                                <p className="text-[10px] lg:text-xs font-bold text-[var(--text-primary)] truncate uppercase max-w-[120px] lg:max-w-[180px]">To: {l.vendor_id?.store_name || 'Protocol'}</p>
                                <p className="text-[8px] lg:text-[9px] text-[var(--text-secondary)] font-black uppercase tracking-widest opacity-40 truncate">From: {l.buyer_id?.name || 'Customer'}</p>
                             </div>
                          </td>
                          <td className="px-4 lg:px-6 py-4 lg:py-5">
                             <p className="text-xs lg:text-sm font-black text-[var(--text-primary)] font-mono">
                                {l.amount.toLocaleString()} 
                             </p>
                          </td>
                          <td className="px-4 lg:px-6 py-4 lg:py-5">
                             <span className={`px-2.5 lg:px-3 py-1 rounded-full text-[7px] lg:text-[8px] font-black uppercase tracking-[0.2em] border shrink-0 inline-block transition-all shadow-sm ${
                               l.status === 'held' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 
                               l.status === 'released' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                               'bg-rose-500/10 text-rose-500 border-rose-500/20'
                             }`}>
                                {l.status}
                             </span>
                          </td>
                          <td className="px-6 lg:px-8 py-4 lg:py-5 text-right whitespace-nowrap">
                             <p className="text-[10px] lg:text-xs font-bold text-[var(--text-primary)] uppercase tracking-tight">{new Date(l.createdAt).toLocaleDateString()}</p>
                             <p className="text-[8px] lg:text-[9px] text-[var(--text-secondary)] opacity-40 lowercase">{new Date(l.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                          </td>
                       </tr>
                     ))}
                     {logs.length === 0 && !loading && (
                       <tr>
                          <td colSpan={5} className="px-8 py-20 lg:py-32 text-center">
                             <div className="flex flex-col items-center gap-4 lg:gap-6 opacity-20">
                                <History className="size-10 lg:size-16" />
                                <p className="text-[9px] lg:text-[11px] font-black uppercase tracking-widest leading-relaxed">System scan complete.<br/>Vault history clear.</p>
                             </div>
                          </td>
                       </tr>
                     )}
                  </tbody>
               </table>
            </div>
         </div>
      </div>
    </>
  );
}


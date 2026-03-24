"use client";

import { useState, useEffect } from 'react';
import { 
  AlertCircle, CheckCircle2, XCircle, 
  Eye, Scale, Loader2, RefreshCw, 
  User, Store, DollarSign, Shield, ShieldCheck
} from 'lucide-react';
import RoleSidebar from '@/components/layout/RoleSidebar';
import api from '@/services/api';
import { toast } from 'react-hot-toast';

export const dynamic = 'force-dynamic';

export default function AdminDisputes() {
  const [mounted, setMounted] = useState(false);
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('All');
  const [actioning, setActioning] = useState(null);

  useEffect(() => {
    setMounted(true);
    fetchDisputes();
  }, []);

  const fetchDisputes = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/disputes');
      if (res.data?.success) setDisputes(res.data.data.disputes || []);
    } catch (err) {
      console.error('Failed to fetch disputes:', err);
      toast.error('Failed to sync with dispute center');
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (disputeId, resolutionType) => {
    setActioning(disputeId);
    try {
      const res = await api.patch(`/admin/disputes/${disputeId}/resolve`, { 
        resolution_type: resolutionType,
        admin_notes: `Platform intervention. Selected: ${resolutionType.replace('_', ' ')}.` 
      });
      if (res.data.success) {
        toast.success(`Dispute resolved: ${resolutionType}`);
        setDisputes(prev => prev.map(d => d._id === disputeId ? { ...d, status: 'resolved', resolution_type: resolutionType } : d));
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Resolution failed');
    } finally {
      setActioning(null);
    }
  };

  const filtered = disputes.filter(d => {
    if (activeTab === 'All') return d.status !== 'resolved';
    if (activeTab === 'Resolved') return d.status === 'resolved';
    return d.status === activeTab.toLowerCase();
  });

  if (!mounted) return null;

  return (
    <>
      <header className="h-20 lg:h-24 flex flex-col lg:flex-row lg:items-center justify-between px-6 lg:px-10 border-b border-[var(--glass-border)] bg-[var(--bg-primary)]/50 shrink-0 z-10 py-4 lg:py-0 gap-4 lg:gap-0">
        <div className="flex items-center gap-4 lg:gap-6">
          <h2 className="text-lg lg:text-xl font-black text-[var(--text-primary)] tracking-tight uppercase">Dispute <span className="text-[var(--accent)]">Tribunal</span></h2>
          <div className="hidden sm:block h-4 lg:h-5 w-px bg-[var(--glass-border)] opacity-30" />
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
             {['All', 'Investigating', 'Resolved'].map(tab => (
               <button 
                 key={tab}
                 onClick={() => setActiveTab(tab)} 
                 className={`px-3 lg:px-4 py-1.5 lg:py-2 rounded-lg text-[8px] lg:text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === tab ? 'bg-[var(--accent)] text-white shadow-lg' : 'hover:bg-[var(--accent)]/10 text-[var(--text-secondary)]'}`}
               >
                 {tab}
               </button>
             ))}
          </div>
        </div>
        <div className="flex items-center justify-between lg:justify-end gap-3 lg:gap-4 border-t lg:border-t-0 pt-3 lg:pt-0 border-[var(--glass-border)]/20">
           <button onClick={fetchDisputes} className="p-2 lg:p-2.5 rounded-lg border border-[var(--glass-border)] hover:bg-[var(--accent)]/10 transition-all text-[var(--text-secondary)]">
              <RefreshCw className={`w-3.5 h-3.5 lg:w-4 lg:h-4 ${loading ? 'animate-spin' : ''}`} />
           </button>
           <div className="px-3 lg:px-4 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 text-[8px] lg:text-[9px] font-black tracking-widest uppercase shadow-sm">
              Protocol Active
           </div>
        </div>
      </header>

      <div className="p-4 lg:p-10 space-y-8 pb-32">
         {/* Tribunal Overview */}
         <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
            {[
              { label: 'Active Disputes', value: disputes.filter(d => d.status !== 'resolved').length, icon: AlertCircle, color: 'text-[var(--accent)]' },
              { label: 'Settled Cases', value: disputes.filter(d => d.status === 'resolved').length, icon: CheckCircle2, color: 'text-emerald-500' },
              { label: 'Avg Resolution', value: '2.4 days', icon: Scale, color: 'text-indigo-500' },
              { label: 'Equity Balance', value: 'High', icon: ShieldCheck, color: 'text-amber-500' }
            ].map(s => (
              <div key={s.label} className="glass-panel p-4 lg:p-5 rounded-2xl lg:rounded-[2rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 shadow-sm hover:translate-y-[-2px] transition-all">
                 <p className="text-[7px] lg:text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] mb-1 opacity-50">{s.label}</p>
                 <h3 className={`text-base lg:text-xl font-black ${s.color} tracking-tight`}>{s.value}</h3>
              </div>
            ))}
         </div>

         {/* Dispute Ledger */}
         <div className="glass-panel rounded-[24px] lg:rounded-[32px] overflow-hidden border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 shadow-xl">
            <div className="overflow-x-auto scroll-smooth">
               <table className="w-full text-left min-w-[800px] lg:min-w-0">
                  <thead>
                     <tr className="text-[8px] lg:text-[10px] font-black tracking-[0.3em] uppercase text-[var(--text-secondary)] border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/30">
                        <th className="px-6 lg:px-8 py-4 lg:py-5">Case Identifier</th>
                        <th className="px-4 lg:px-6 py-4 lg:py-5">Initiator / Parties</th>
                        <th className="px-4 lg:px-6 py-4 lg:py-5">Reasoning</th>
                        <th className="px-4 lg:px-6 py-4 lg:py-5">Amount</th>
                        <th className="px-6 lg:px-8 py-4 lg:py-5 text-right">Resolution Path</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--glass-border)]/50">
                     {filtered.map(d => (
                       <tr key={d._id} className="hover:bg-[var(--accent)]/5 transition-colors group">
                          <td className="px-6 lg:px-8 py-4 lg:py-5">
                             <div className="flex items-center gap-3">
                                <div className={`size-2 rounded-full flex-shrink-0 ${d.status === 'resolved' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]' : 'bg-amber-500 animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.4)]'}`} />
                                <div>
                                   <p className="text-xs lg:text-sm font-black text-[var(--text-primary)] uppercase tracking-tight font-mono">#{d._id?.slice(-6).toUpperCase()}</p>
                                   <p className="text-[8px] lg:text-[9px] font-bold text-[var(--text-secondary)] opacity-50">ORDER: #{d.order_id?._id?.slice(-6) || '—'}</p>
                                </div>
                             </div>
                          </td>
                          <td className="px-4 lg:px-6 py-4 lg:py-5">
                             <div className="flex flex-col gap-1">
                                <p className="text-[10px] lg:text-xs font-bold text-[var(--text-primary)] flex items-center gap-2 uppercase">
                                   <User className="size-3 lg:size-3.5 text-[var(--accent)]" /> {d.initiator_id?.name || 'Party'}
                                </p>
                                <p className="text-[7px] lg:text-[8px] text-[var(--text-secondary)] font-black uppercase tracking-widest opacity-40">
                                   VS. VENDOR NODE
                                </p>
                             </div>
                          </td>
                          <td className="px-4 lg:px-6 py-4 lg:py-5 max-w-[200px] lg:max-w-xs">
                             <p className="text-[11px] lg:text-sm font-bold text-[var(--text-primary)] truncate uppercase">{d.reason}</p>
                             <p className="text-[9px] lg:text-[10px] text-[var(--text-secondary)] font-medium mt-1 line-clamp-1 opacity-60 italic">{d.description}</p>
                          </td>
                          <td className="px-4 lg:px-6 py-4 lg:py-5">
                             <p className="text-xs lg:text-sm font-black text-[var(--text-primary)] font-mono whitespace-nowrap">
                                {(d.order_id?.total_amount || 0).toLocaleString()} <span className="text-[8px] opacity-40">XAF</span>
                             </p>
                          </td>
                          <td className="px-6 lg:px-8 py-4 lg:py-5 text-right">
                             {d.status === 'resolved' ? (
                               <span className="px-3 lg:px-4 py-1 lg:py-1.5 rounded flex-shrink-0 border border-emerald-500/20 bg-emerald-500/5 text-emerald-500 text-[8px] lg:text-[9px] font-black uppercase tracking-widest">
                                  {d.resolution_type?.replace('_', ' ')}
                               </span>
                             ) : (
                               <div className="flex items-center justify-end gap-2 shrink-0">
                                  <button 
                                     onClick={() => handleResolve(d._id, 'full_refund')}
                                     disabled={actioning === d._id}
                                     className="px-3 lg:px-4 py-1.5 lg:py-2 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20 text-[8px] lg:text-[9px] font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all shadow-sm active:scale-95 disabled:opacity-30"
                                  >
                                     Refund
                                  </button>
                                  <button 
                                     onClick={() => handleResolve(d._id, 'release_payment')}
                                     disabled={actioning === d._id}
                                     className="px-3 lg:px-4 py-1.5 lg:py-2 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[8px] lg:text-[9px] font-black uppercase tracking-widest hover:bg-emerald-500 hover:text-white transition-all shadow-sm active:scale-95 disabled:opacity-30"
                                  >
                                     Release
                                  </button>
                               </div>
                             )}
                           </td>
                       </tr>
                     ))}
                     {filtered.length === 0 && !loading && (
                       <tr>
                          <td colSpan={5} className="px-8 py-20 lg:py-32 text-center">
                             <div className="flex flex-col items-center gap-4 lg:gap-6 opacity-20">
                                <Scale className="size-10 lg:size-16" />
                                <p className="text-[9px] lg:text-[11px] font-black uppercase tracking-widest leading-relaxed">System scan complete.<br/>No active disputes detected.</p>
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


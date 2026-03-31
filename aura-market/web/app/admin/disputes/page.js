'use client';

import { useState, useEffect } from 'react';
import api from '@/services/api';
import { 
  Scale, AlertCircle, CheckCircle2, XCircle, Clock, 
  ArrowLeft, RefreshCw, MoreVertical, ShieldCheck, 
  Loader2, User, Search, Filter, ExternalLink, Info
} from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function AdminDisputes() {
  const [mounted, setMounted] = useState(false);
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('All');
  const [actioning, setActioning] = useState(null);
  const [selectedCase, setSelectedCase] = useState(null);
  const [caseShipment, setCaseShipment] = useState(null);
  const [fetchingCase, setFetchingCase] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetchDisputes();
  }, []);

  const fetchDisputes = async () => {
    setLoading(true);
    try {
      const res = await api.get('/disputes/admin');
      if (res.data?.success) setDisputes(res.data.data.disputes || []);
    } catch (err) {
      console.error('Failed to fetch disputes:', err);
      toast.error('Failed to sync with dispute center');
    } finally {
      setLoading(false);
    }
  };

  const openCase = async (dispute) => {
    setSelectedCase(dispute);
    setCaseShipment(null);
    if (!dispute.order_id?._id) return;
    
    setFetchingCase(true);
    try {
       // Search for shipment related to this order
       const res = await api.get(`/admin/shipments?order_id=${dispute.order_id._id}`);
       if (res.data.success && res.data.data.shipments.length > 0) {
          setCaseShipment(res.data.data.shipments[0]);
       }
    } catch (err) {
       console.warn("Could not find matching shipment for proof.");
    } finally {
       setFetchingCase(false);
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
        if (selectedCase?._id === disputeId) setSelectedCase(prev => ({ ...prev, status: 'resolved', resolution_type: resolutionType }));
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
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Case Details Modal */}
      {selectedCase && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 lg:p-10">
          <div className="w-full max-w-4xl glass-panel bg-[var(--bg-primary)]/95 border border-[var(--glass-border)] rounded-[2.5rem] p-6 lg:p-10 shadow-2xl relative max-h-[90vh] overflow-y-auto no-scrollbar animate-in zoom-in duration-300">
            <button onClick={() => setSelectedCase(null)} className="absolute top-6 right-6 p-2 rounded-xl hover:bg-[var(--bg-secondary)] transition-all text-[var(--text-secondary)]"><XCircle className="w-6 h-6" /></button>
            
            <div className="flex items-center gap-4 mb-8">
               <div className="p-3 bg-[var(--accent)]/10 text-[var(--accent)] rounded-2xl"><Scale className="w-6 h-6" /></div>
               <div>
                  <h2 className="text-xl lg:text-2xl font-black text-[var(--text-primary)] tracking-tight uppercase leading-none">Inspect Case #{selectedCase._id.slice(-6).toUpperCase()}</h2>
                  <p className="text-[10px] font-black text-[var(--text-secondary)] tracking-widest uppercase mt-2 opacity-50">High-level arbitration in progress</p>
               </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
               {/* Left: Client Evidence */}
               <div className="space-y-6">
                  <h3 className="text-xs font-black text-[var(--text-secondary)] tracking-[0.2em] uppercase mb-4 border-b border-[var(--glass-border)] pb-2 flex items-center gap-2">
                     <AlertCircle className="w-3.5 h-3.5" /> Customer Argument
                  </h3>
                  <div className="bg-[var(--bg-secondary)]/50 p-6 rounded-3xl border border-[var(--glass-border)]">
                     <p className="text-sm font-bold text-[var(--text-primary)] mb-2 uppercase tracking-wide">{selectedCase.reason}</p>
                     <p className="text-xs text-[var(--text-secondary)] leading-relaxed italic opacity-80">"{selectedCase.description}"</p>
                  </div>
                  
                  {selectedCase.evidence_urls?.length > 0 ? (
                     <div className="grid grid-cols-2 gap-3">
                        {selectedCase.evidence_urls.map((url, i) => (
                          <div key={i} className="aspect-square rounded-2xl overflow-hidden border border-[var(--glass-border)] bg-[var(--bg-secondary)] relative group">
                             <img src={url} className="w-full h-full object-cover group-hover:scale-110 transition-transform cursor-pointer" onClick={() => window.open(url, '_blank')} />
                          </div>
                        ))}
                     </div>
                  ) : (
                    <div className="p-10 border-2 border-dashed border-[var(--glass-border)] rounded-3xl text-center opacity-30">
                       <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">No visual evidence provided by customer</p>
                    </div>
                  )}
               </div>

               {/* Right: Logistics Node Check */}
               <div className="space-y-6">
                  <h3 className="text-xs font-black text-[var(--text-secondary)] tracking-[0.2em] uppercase mb-4 border-b border-[var(--glass-border)] pb-2 flex items-center gap-2">
                     <ShieldCheck className="w-3.5 h-3.5" /> Proof of Delivery
                  </h3>
                  
                  {fetchingCase ? (
                     <div className="h-40 flex flex-col items-center justify-center opacity-40">
                        <Loader2 className="animate-spin w-8 h-8 mb-4 text-[var(--accent)]" />
                        <p className="text-[9px] font-black tracking-widest uppercase">Fetching Node Status...</p>
                     </div>
                  ) : caseShipment?.proof_of_delivery?.image_url ? (
                    <div className="space-y-4">
                       <div className="aspect-[4/3] rounded-[2rem] overflow-hidden border-2 border-[var(--accent)]/10 shadow-xl bg-[var(--bg-secondary)]">
                          <img src={caseShipment.proof_of_delivery.image_url} className="w-full h-full object-cover" />
                       </div>
                       <div className="bg-emerald-500/5 p-5 rounded-2xl border border-emerald-500/10">
                          <div className="flex items-center gap-2 mb-2">
                             <div className="size-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                             <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Shipment Operational Log</p>
                          </div>
                          <p className="text-xs font-bold text-[var(--text-primary)]">Recipient: <span className="text-[var(--accent)]">{caseShipment.proof_of_delivery.receiver_name || 'Verified Signatory'}</span></p>
                          <p className="text-[10px] text-[var(--text-secondary)] mt-1.5 opacity-70 leading-normal">{caseShipment.proof_of_delivery.note || 'No additional courier notes recorded.'}</p>
                       </div>
                    </div>
                  ) : (
                    <div className="h-64 border-2 border-dashed border-[var(--glass-border)] rounded-[2.5rem] flex flex-col items-center justify-center px-10 text-center bg-[var(--bg-secondary)]/30 group">
                       <Scale className="w-10 h-10 mb-4 opacity-10 group-hover:rotate-12 transition-transform duration-500" />
                       <p className="text-[11px] font-bold text-[var(--text-secondary)] opacity-50 uppercase tracking-[0.1em] leading-relaxed">
                          {caseShipment ? 'Courier has not uploaded proof of delivery yet for this shipment node.' : 'No active shipment found matching this order node.'}
                       </p>
                    </div>
                  )}
               </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-8 border-t border-[var(--glass-border)]">
               <div className="flex items-center gap-4 p-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)]">
                  <div className="size-10 rounded-full bg-[var(--bg-primary)] border border-[var(--glass-border)] flex items-center justify-center overflow-hidden">
                     {selectedCase.initiator_id?.avatar ? <img src={selectedCase.initiator_id?.avatar} className="size-full object-cover" /> : <User className="size-5 opacity-40" />}
                  </div>
                  <div>
                    <p className="text-[11px] font-black tracking-tight text-[var(--text-primary)] uppercase leading-none mb-1">{selectedCase.initiator_id?.name}</p>
                    <p className="text-[9px] font-bold text-[var(--text-secondary)] opacity-50">{selectedCase.initiator_id?.email}</p>
                  </div>
               </div>

               <div className="flex items-center gap-3">
                  <span className="text-[10px] font-black uppercase text-[var(--text-secondary)] opacity-40 mr-4 tracking-widest">Final Resolution:</span>
                  {selectedCase.status === 'resolved' ? (
                    <div className="px-8 py-3 rounded-2xl bg-emerald-500 text-white font-black text-xs uppercase tracking-widest shadow-xl">
                       {selectedCase.resolution_type?.replace('_', ' ')} Applied
                    </div>
                  ) : (
                    <>
                      <button 
                        onClick={() => handleResolve(selectedCase._id, 'full_refund')} 
                        disabled={actioning === selectedCase._id}
                        className="px-8 py-4 rounded-2xl bg-rose-500 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-rose-500/20 hover:shadow-rose-500/50 hover:-translate-y-1 transition-all flex items-center gap-2"
                      >
                         {actioning === selectedCase._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />} Refund
                      </button>
                      <button 
                         onClick={() => handleResolve(selectedCase._id, 'release_payment')} 
                         disabled={actioning === selectedCase._id}
                         className="px-8 py-4 rounded-2xl bg-emerald-500 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/50 hover:-translate-y-1 transition-all flex items-center gap-2"
                      >
                         {actioning === selectedCase._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Release
                      </button>
                    </>
                  )}
               </div>
            </div>
          </div>
        </div>
      )}

      <header className="h-20 lg:h-24 flex flex-col lg:flex-row lg:items-center justify-between px-6 lg:px-10 border-b border-[var(--glass-border)] bg-[var(--bg-primary)] shrink-0 z-10 py-4 lg:py-0 gap-4 lg:gap-0 text-[var(--text-primary)]">
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
                       <tr 
                         key={d._id} 
                         onClick={() => openCase(d)}
                         className="hover:bg-[var(--accent)]/5 transition-colors group cursor-pointer"
                       >
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
                                     onClick={(e) => { e.stopPropagation(); handleResolve(d._id, 'full_refund'); }}
                                     disabled={actioning === d._id}
                                     className="px-3 lg:px-4 py-1.5 lg:py-2 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20 text-[8px] lg:text-[9px] font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all shadow-sm active:scale-95 disabled:opacity-30"
                                  >
                                     Refund
                                  </button>
                                  <button 
                                     onClick={(e) => { e.stopPropagation(); handleResolve(d._id, 'release_payment'); }}
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
    </div>
  );
}

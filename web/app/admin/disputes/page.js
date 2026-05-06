'use client';

import { useState, useEffect } from 'react';
import api from '@/services/api';
import { 
  Scale, AlertCircle, CheckCircle2, XCircle, Clock, 
  ArrowLeft, RefreshCw, MoreVertical, ShieldCheck, 
  Loader2, User, Search, Filter, ExternalLink, Info,
  Database, Zap
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

import Pagination from '@/components/common/Pagination';
import LoadingSpinner from '@/components/common/LoadingSpinner';

export default function AdminDisputes() {
  const [mounted, setMounted] = useState(false);
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
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

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const currentDisputes = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Case Details Modal */}
      <AnimatePresence>
        {selectedCase && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 lg:p-10">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-4xl glass-panel bg-[var(--bg-primary)]/95 border border-[var(--glass-border)] rounded-[2.5rem] p-6 lg:p-10 shadow-2xl relative max-h-[90vh] overflow-y-auto no-scrollbar"
            >
              <button onClick={() => setSelectedCase(null)} className="absolute top-6 right-6 p-2 rounded-xl hover:bg-[var(--bg-secondary)] transition-all text-[var(--text-secondary)]"><XCircle className="w-6 h-6" /></button>
              
              <div className="flex items-center gap-4 mb-8">
                 <div className="p-3 bg-[var(--accent)]/10 text-[var(--accent)] rounded-2xl"><Scale className="w-6 h-6" /></div>
                 <div>
                    <h2 className="text-xl lg:text-2xl  font-bold text-[var(--text-primary)] tracking-tight  leading-none">Inspect Case #{selectedCase._id.slice(-6).toUpperCase()}</h2>
                    <p className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] tracking-tight  mt-2 opacity-50">High-level arbitration in progress</p>
                 </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
                 {/* Left: Client Evidence */}
                 <div className="space-y-6">
                    <h3 className="text-xs  font-bold text-[var(--text-secondary)] tracking-[0.2em]  mb-4 border-b border-[var(--glass-border)] pb-2 flex items-center gap-2">
                       <AlertCircle className="w-3.5 h-3.5" /> Customer Argument
                    </h3>
                    <div className="bg-[var(--bg-secondary)]/50 p-6 rounded-3xl border border-[var(--glass-border)]">
                       <p className="text-sm  font-bold text-[var(--text-primary)] mb-2  tracking-tight">{selectedCase.reason}</p>
                       <p className="text-xs text-[var(--text-secondary)] leading-relaxed opacity-80">{selectedCase.description}</p>
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
                         <p className="text-[11px] lg:text-[12px]  font-semibold tracking-tight text-[var(--text-secondary)]">No visual evidence provided by customer</p>
                      </div>
                    )}
                 </div>

                 {/* Right: Logistics Node Check */}
                 <div className="space-y-6">
                    <h3 className="text-xs  font-bold text-[var(--text-secondary)] tracking-[0.2em]  mb-4 border-b border-[var(--glass-border)] pb-2 flex items-center gap-2">
                       <ShieldCheck className="w-3.5 h-3.5" /> Proof of Delivery
                    </h3>
                    
                    {fetchingCase ? (
                       <div className="flex flex-col items-center justify-center h-64 gap-4">
                          <Loader2 className="w-8 h-8 animate-spin text-[var(--accent)]" />
                          <p className="text-[10px] lg:text-[12px]  font-semibold tracking-widest text-[var(--text-secondary)]">FETCHING COURIER NODES...</p>
                       </div>
                    ) : caseShipment?.proof_of_delivery?.image_url ? (
                      <div className="space-y-4">
                         <div className="aspect-[4/3] rounded-[2rem] overflow-hidden border-2 border-[var(--accent)]/10 shadow-xl bg-[var(--bg-secondary)]">
                            <img src={caseShipment.proof_of_delivery.image_url} className="w-full h-full object-cover" />
                         </div>
                         <div className="bg-emerald-500/5 p-5 rounded-2xl border border-emerald-500/10">
                            <div className="flex items-center gap-2 mb-2">
                               <div className="size-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                               <p className="text-[11px] lg:text-[12px]  font-semibold tracking-tight text-emerald-600">Shipment Operational Log</p>
                            </div>
                            <p className="text-xs  font-bold text-[var(--text-primary)]">Recipient: <span className="text-[var(--accent)]">{caseShipment.proof_of_delivery.receiver_name || 'Verified Signatory'}</span></p>
                            <p className="text-[10px] lg:text-[12px] text-[var(--text-secondary)] mt-1.5 opacity-70 leading-normal">{caseShipment.proof_of_delivery.note || 'No additional courier notes recorded.'}</p>
                         </div>
                      </div>
                    ) : (
                      <div className="h-64 border-2 border-dashed border-[var(--glass-border)] rounded-[2.5rem] flex flex-col items-center justify-center px-10 text-center bg-[var(--bg-secondary)]/30 group">
                         <Scale className="w-10 h-10 mb-4 opacity-10 group-hover:rotate-12 transition-transform duration-500" />
                         <p className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] opacity-50  tracking-[0.1em] leading-relaxed">
                            {caseShipment ? 'Courier has not uploaded proof of delivery yet.' : 'No active shipment found matching this order node.'}
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
                      <p className="text-[11px] lg:text-[12px]  font-semibold tracking-tight text-[var(--text-primary)]  leading-none mb-1">{selectedCase.initiator_id?.name}</p>
                      <p className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] opacity-50">{selectedCase.initiator_id?.email}</p>
                    </div>
                 </div>

                 <div className="flex items-center gap-3">
                    <span className="text-[11px] lg:text-[12px]  font-semibold  text-[var(--text-secondary)] opacity-40 mr-4 tracking-tight">Final Resolution:</span>
                    {selectedCase.status === 'resolved' ? (
                      <div className="px-8 py-3 rounded-2xl bg-emerald-500 text-white  font-bold text-xs tracking-tight shadow-xl capitalize">
                         {selectedCase.resolution_type?.replace('_', ' ')} Applied
                      </div>
                    ) : (
                      <>
                        <button 
                          onClick={() => handleResolve(selectedCase._id, 'full_refund')} 
                          disabled={actioning === selectedCase._id}
                          className="px-8 py-4 rounded-2xl bg-rose-500 text-white  font-bold text-xs tracking-tight shadow-lg shadow-rose-500/20 hover:shadow-rose-500/50 hover:-translate-y-1 transition-all flex items-center gap-2"
                        >
                           {actioning === selectedCase._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />} Refund
                        </button>
                        <button 
                           onClick={() => handleResolve(selectedCase._id, 'release_payment')} 
                           disabled={actioning === selectedCase._id}
                           className="px-8 py-4 rounded-2xl bg-emerald-500 text-white  font-bold text-xs tracking-tight shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/50 hover:-translate-y-1 transition-all flex items-center gap-2"
                        >
                           {actioning === selectedCase._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Release
                        </button>
                      </>
                    )}
                 </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Surgical Header */}
      <header className="h-24 flex items-center justify-between px-10 border-b border-[var(--glass-border)] bg-[var(--bg-primary)]/80 backdrop-blur-xl sticky top-16 z-40">
        <div className="flex items-center gap-6">
          <div className="size-12 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] shadow-inner border border-[var(--accent)]/20">
             <Scale className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl  font-bold text-[var(--text-primary)] tracking-tight ">Dispute <span className="text-[var(--accent)]">Tribunal</span> Matrix</h2>
            <div className="flex items-center gap-2 mt-1">
               <div className="size-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
               <p className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] tracking-tight opacity-50 capitalize">Equity Node Active // System_Arbitrator</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
           <div className="flex bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl p-1">
              {['All', 'Investigating', 'Resolved'].map(tab => (
                <button 
                  key={tab}
                  onClick={() => { setActiveTab(tab); setCurrentPage(1); }} 
                  className={`px-4 py-1.5 rounded-xl text-[10px] lg:text-[12px]  font-semibold tracking-tight transition-all capitalize ${activeTab === tab ? 'bg-[var(--accent)] text-white shadow-lg' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                >
                  {tab}
                </button>
              ))}
           </div>
           <button onClick={fetchDisputes} className="size-11 rounded-2xl border border-[var(--glass-border)] hover:bg-[var(--accent)]/10 text-[var(--text-secondary)] flex items-center justify-center transition-all shadow-sm active:scale-95">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
           </button>
        </div>
      </header>

      <div className="p-10 space-y-8 pb-40">
         {/* Live Stats */}
         <div className="grid grid-cols-4 gap-6">
            {[
               { label: 'Active Disputes', value: disputes.filter(d => d.status !== 'resolved').length, icon: AlertCircle, color: 'var(--accent)', sub: 'THREAT_VECTORS' },
               { label: 'Settled Cases', value: disputes.filter(d => d.status === 'resolved').length, icon: CheckCircle2, color: '#10b981', sub: 'EQUITY_FEED' },
               { label: 'Avg Resolution', value: '2.4 Days', icon: Clock, color: '#6366f1', sub: 'TIME_TO_SOLVE' },
               { label: 'System Integrity', value: 'High', icon: ShieldCheck, color: '#fbbf24', sub: 'PROTOCOL_INDEX' }
            ].map(s => (
               <div key={s.label} className="group relative p-8 rounded-[2.5rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 hover:bg-[var(--bg-primary)]/60 transition-all duration-500 overflow-hidden shadow-lg hover:shadow-2xl hover:-translate-y-1 backdrop-blur-2xl">
                  <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 size-32 rounded-full blur-[80px] opacity-10 transition-opacity group-hover:opacity-30" style={{ backgroundColor: s.color }} />
                  <div className="relative flex flex-col justify-between h-full space-y-8">
                     <div className="flex items-center justify-between">
                        <div className="size-12 rounded-[1.25rem] flex items-center justify-center border border-[var(--glass-border)] bg-[var(--bg-secondary)] shadow-inner text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-all duration-500">
                           <s.icon className="w-5 h-5 opacity-40 group-hover:opacity-100" />
                        </div>
                        <span className="text-[10px] lg:text-[12px]  font-semibold tracking-[0.3em] capitalize opacity-20 group-hover:opacity-40 transition-opacity font-mono">{s.sub}</span>
                     </div>
                     <div>
                        <p className="text-[10px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] tracking-[0.2em] mb-2 capitalize opacity-40">{s.label}</p>
                        <h3 className="text-2xl  font-bold text-[var(--text-primary)] tracking-tighter leading-none">{s.value}</h3>
                     </div>
                  </div>
               </div>
            ))}
         </div>

         {/* Dispute Ledger */}
         <div className="glass-panel rounded-[3rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 overflow-hidden shadow-2xl">
            <div className="p-8 border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/30 flex items-center justify-between">
               <h3 className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-primary)] tracking-[0.1em] flex items-center gap-3 capitalize">
                  <Database className="w-4 h-4 text-[var(--accent)]" /> 
                  Platform Dispute Ledger
               </h3>
               <p className="text-[10px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] opacity-40 capitalize tracking-widest">Awaiting Arbitration</p>
            </div>

            <div className="space-y-4">
              {loading ? (
                 <LoadingSpinner text="Synchronizing Tribunal Nodes" />
              ) : currentDisputes.length > 0 ? (
                 <div className="grid grid-cols-1 gap-4 p-6 lg:p-10">
                   {currentDisputes.map(d => {
                     const statusColor = d.status === 'resolved' ? 'text-emerald-500' : 'text-amber-500';
                     const statusBg = statusColor.replace('text-', 'bg-').concat('/10');

                     return (
                        <div 
                           key={d._id} 
                           onClick={() => openCase(d)}
                           className="group relative rounded-[2.5rem] bg-[var(--bg-primary)]/40 border border-[var(--glass-border)] shadow-sm hover:shadow-2xl transition-all duration-500 overflow-hidden hover:-translate-y-1 backdrop-blur-xl flex flex-col cursor-pointer"
                        >
                           <div className="p-6 lg:p-8 flex items-center gap-6 md:gap-8">
                              <div className={`size-12 md:size-14 rounded-[1.5rem] ${statusBg} ${statusColor} flex items-center justify-center shrink-0 border ${statusColor.replace('text-', 'border-')}/10 shadow-inner`}>
                                 <AlertCircle className="w-6 h-6 md:w-7 md:h-7" />
                              </div>

                              <div className="flex-1 min-w-0">
                                 <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-3">
                                       <span className="text-[11px] lg:text-[12px] md:text-[13px]  font-semibold text-[var(--text-primary)] tracking-tight capitalize">Case Node</span>
                                       <span className={`px-3 py-1 rounded-full text-[10px] lg:text-[12px] md:text-[10px] lg:text-[12px]  font-semibold tracking-widest border ${statusBg} ${statusColor} ${statusColor.replace('text-', 'border-')}/20 capitalize`}>
                                          {d.status}
                                       </span>
                                    </div>
                                    <time className="text-[10px] lg:text-[12px] md:text-[10px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] opacity-30 tracking-widest flex items-center gap-2 capitalize">
                                       <Clock className="w-3 h-3" /> {new Date(d.createdAt).toLocaleDateString()}
                                    </time>
                                 </div>
                                 <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2 text-[10px] lg:text-[12px] md:text-[11px] lg:text-[12px] font-medium text-[var(--text-secondary)] opacity-60 truncate">
                                       <span className="font-mono text-[var(--accent)]  font-bold">#{d._id.slice(-6).toUpperCase()}</span>
                                       <span>•</span>
                                       <span className="truncate max-w-[200px] md:max-w-md">{d.reason}: {d.description}</span>
                                    </div>
                                 </div>
                              </div>

                              <div className="text-right shrink-0">
                                 <p className="text-xl md:text-2xl  font-bold tabular-nums text-[var(--text-primary)] tracking-tighter">{(d.order_id?.total_amount || 0).toLocaleString()} <span className="text-[10px] lg:text-[12px] md:text-[12px] opacity-30 ml-1">XAF</span></p>
                                 <div className="flex items-center justify-end gap-3 mt-2">
                                    <span className="text-[10px] lg:text-[12px] md:text-[10px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] opacity-40 capitalize tracking-widest">{d.initiator_id?.name || 'Party'}</span>
                                    <div className="size-6 rounded-lg overflow-hidden bg-[var(--bg-secondary)] border border-[var(--glass-border)] shadow-sm">
                                       {d.initiator_id?.avatar ? <img src={d.initiator_id.avatar} className="size-full object-cover" /> : <User className="size-full p-1 opacity-20" />}
                                    </div>
                                 </div>
                              </div>
                           </div>
                        </div>
                     );
                   })}
                 </div>
              ) : (
                 <div className="py-40 flex flex-col items-center justify-center opacity-20 px-10 text-center">
                    <Scale className="w-16 h-16 mb-8 text-[var(--text-secondary)]" />
                    <p className="text-sm  font-bold tracking-[0.2em] capitalize leading-relaxed max-w-sm">No active disputes in the system matrix.</p>
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

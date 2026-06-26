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
import Link from 'next/link';

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

  const disputeTabs = [
    { label: 'All', matches: () => true },
    { label: 'Active', matches: d => d.status !== 'resolved' },
    { label: 'Investigating', matches: d => d.status === 'investigating' },
    { label: 'Resolved', matches: d => d.status === 'resolved' }
  ];

  const selectedTab = disputeTabs.find(tab => tab.label === activeTab) || disputeTabs[0];
  const filtered = disputes.filter(selectedTab.matches);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const currentDisputes = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Case Details Modal */}
      <AnimatePresence>
        {selectedCase && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setSelectedCase(null)} />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-4xl bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-[2.5rem] p-6 md:p-10 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col backdrop-blur-3xl"
            >
              <div className="flex items-start justify-between mb-8 shrink-0">
                <div className="flex items-center gap-4">
                   <div className="size-12 rounded-2xl bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center border border-[var(--accent)]/20 shadow-inner"><Scale className="w-6 h-6" /></div>
                   <div>
                      <h2 className="text-xl md:text-2xl font-bold tracking-tight">Case Inspection</h2>
                      <p className="text-[10px] md:text-[11px] font-bold text-[var(--accent)] tracking-[0.3em] uppercase opacity-60 mt-1">Arbitration Protocol // #{selectedCase._id.slice(-6).toUpperCase()}</p>
                   </div>
                </div>
                <button onClick={() => setSelectedCase(null)} className="p-2 rounded-xl hover:bg-[var(--bg-secondary)] transition-all text-[var(--text-secondary)]"><XCircle className="w-6 h-6" /></button>
              </div>
              
              <div className="flex-1 overflow-y-auto no-scrollbar pr-2">
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12">
                    {/* Argument Section */}
                    <div className="space-y-6">
                       <h3 className="text-[10px] font-bold text-[var(--text-secondary)] tracking-[0.3em] uppercase opacity-40 flex items-center gap-2">
                          <AlertCircle className="w-3.5 h-3.5" /> Customer Argumentation
                       </h3>
                       <div className="bg-[var(--bg-secondary)]/40 p-6 rounded-[2rem] border border-[var(--glass-border)] backdrop-blur-xl">
                          <p className="text-[13px] font-bold text-[var(--text-primary)] mb-3 tracking-tight capitalize">{selectedCase.reason}</p>
                          <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed opacity-70">{selectedCase.description}</p>
                       </div>
                       
                       {selectedCase.evidence_urls?.length > 0 ? (
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                             {selectedCase.evidence_urls.map((url, i) => (
                                <div key={i} className="aspect-square rounded-2xl overflow-hidden border border-[var(--glass-border)] bg-[var(--bg-secondary)] relative group shadow-sm">
                                   <img src={url} className="w-full h-full object-cover group-hover:scale-110 transition-transform cursor-pointer" onClick={() => window.open(url, '_blank')} />
                                </div>
                             ))}
                          </div>
                       ) : (
                         <div className="py-12 border-2 border-dashed border-[var(--glass-border)] rounded-[2rem] text-center opacity-10">
                            <Database className="size-8 mx-auto mb-3" />
                            <p className="text-[10px] font-bold tracking-widest uppercase">Evidence Void</p>
                         </div>
                       )}
                    </div>

                    {/* Logistics Verification */}
                    <div className="space-y-6">
                       <h3 className="text-[10px] font-bold text-[var(--text-secondary)] tracking-[0.3em] uppercase opacity-40 flex items-center gap-2">
                          <ShieldCheck className="w-3.5 h-3.5" /> Network Proof Verify
                       </h3>
                       
                       {fetchingCase ? (
                          <div className="flex flex-col items-center justify-center py-20 gap-4">
                             <Loader2 className="w-8 h-8 animate-spin text-[var(--accent)]" />
                             <p className="text-[10px] font-bold tracking-widest text-[var(--text-secondary)] uppercase">Synchronizing Items...</p>
                          </div>
                       ) : caseShipment?.proof_of_delivery?.image_url ? (
                         <div className="space-y-4">
                            <div className="aspect-[4/3] rounded-[2rem] overflow-hidden border border-[var(--glass-border)] shadow-xl bg-[var(--bg-secondary)] group">
                               <img src={caseShipment.proof_of_delivery.image_url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                            </div>
                            <div className="bg-emerald-500/5 p-5 rounded-2xl border border-emerald-500/10">
                               <div className="flex items-center gap-2 mb-2">
                                  <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  <p className="text-[10px] font-bold tracking-widest text-emerald-600 uppercase">Operational Proof Log</p>
                               </div>
                               <p className="text-[11px] font-bold text-[var(--text-primary)]">Recipient: <span className="text-[var(--accent)]">{caseShipment.proof_of_delivery.receiver_name || 'Verified Signatory'}</span></p>
                               <p className="text-[10px] text-[var(--text-secondary)] mt-1.5 opacity-60 leading-normal italic">"{caseShipment.proof_of_delivery.note || 'No additional courier telemetry recorded.'}"</p>
                            </div>
                         </div>
                       ) : (
                         <div className="py-20 border-2 border-dashed border-[var(--glass-border)] rounded-[2rem] flex flex-col items-center justify-center px-10 text-center bg-[var(--bg-secondary)]/20 opacity-20 group">
                            <Scale className="w-10 h-10 mb-4 group-hover:rotate-12 transition-transform duration-500" />
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] leading-relaxed">
                               {caseShipment ? 'Logistics proof pending upload' : 'No network shipment matched to node'}
                            </p>
                         </div>
                       )}
                    </div>
                 </div>
              </div>

              <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-8 border-t border-[var(--glass-border)] mt-8 shrink-0">
                 <div className="flex items-center gap-4 w-full md:w-auto p-4 rounded-2xl bg-[var(--bg-secondary)]/40 border border-[var(--glass-border)]">
                    <div className="size-11 rounded-full bg-[var(--bg-primary)] border border-[var(--glass-border)] flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                       {selectedCase.initiator_id?.avatar ? <img src={selectedCase.initiator_id?.avatar} className="size-full object-cover" /> : <User className="size-5 opacity-40" />}
                    </div>
                    <div>
                      <p className="text-[12px] font-bold tracking-tight text-[var(--text-primary)] leading-none mb-1">{selectedCase.initiator_id?.name}</p>
                      <p className="text-[10px] font-bold text-[var(--text-secondary)] opacity-40 uppercase tracking-tighter">{selectedCase.initiator_id?.email}</p>
                    </div>
                 </div>

                 <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
                    {selectedCase.initiator_id?._id && selectedCase.initiator_id?.verification_status !== 'verified' && (
                      <Link
                        href={`/admin/users?verification=held&search=${encodeURIComponent(selectedCase.initiator_id.email || '')}`}
                        className="h-14 px-5 rounded-2xl border border-amber-500/25 bg-amber-500/10 text-amber-500 font-bold text-[10px] tracking-[0.16em] uppercase transition-all hover:bg-amber-500 hover:text-white active:scale-95 flex items-center justify-center gap-2"
                      >
                        Request KYC
                      </Link>
                    )}
                    {selectedCase.status === 'resolved' ? (
                      <div className="w-full md:w-auto px-8 py-4 rounded-2xl bg-emerald-500 text-white font-bold text-[10px] tracking-[0.2em] uppercase shadow-lg shadow-emerald-500/20 text-center">
                         {selectedCase.resolution_type?.replace('_', ' ')} Executed
                      </div>
                    ) : (
                      <>
                        <button 
                          onClick={() => handleResolve(selectedCase._id, 'full_refund')} 
                          disabled={actioning === selectedCase._id}
                          className="flex-1 md:flex-none h-14 px-8 rounded-2xl bg-rose-500 text-white font-bold text-[10px] tracking-[0.2em] uppercase shadow-lg shadow-rose-500/20 hover:bg-rose-600 transition-all active:scale-95 flex items-center justify-center gap-3"
                        >
                           {actioning === selectedCase._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />} Refund
                        </button>
                        <button 
                           onClick={() => handleResolve(selectedCase._id, 'release_payment')} 
                           disabled={actioning === selectedCase._id}
                           className="flex-1 md:flex-none h-14 px-8 rounded-2xl bg-emerald-500 text-white font-bold text-[10px] tracking-[0.2em] uppercase shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all active:scale-95 flex items-center justify-center gap-3"
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

      <header className="min-h-20 py-4 flex flex-col md:flex-row md:h-24 items-center justify-between px-4 md:px-10 border-b border-[var(--glass-border)] bg-[var(--bg-primary)]/80 backdrop-blur-xl sticky top-0 md:top-16 z-40 gap-4 md:gap-0">
        <div className="flex items-center gap-4 md:gap-6 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-4">
            <div className="size-10 md:size-12 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] shadow-inner border border-[var(--accent)]/20 shrink-0">
               <Scale className="w-5 h-5 md:w-6 md:h-6" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-bold text-[var(--text-primary)] tracking-tight">Dispute <span className="text-[var(--accent)]">Tribunal</span></h2>
              <div className="flex items-center gap-2 mt-0.5">
                 <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                 <p className="text-[10px] md:text-[11px] lg:text-[12px] font-semibold text-[var(--text-secondary)] tracking-tight opacity-50 uppercase">Arbitration Master</p>
              </div>
            </div>
          </div>
          <button onClick={fetchDisputes} className="md:hidden size-10 rounded-xl border border-[var(--glass-border)] text-[var(--text-secondary)] flex items-center justify-center active:scale-95">
             <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
           <div className="flex bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl p-1 overflow-x-auto no-scrollbar flex-1 md:flex-none justify-between md:justify-start">
              {disputeTabs.map(({ label }) => (
                <button 
                  key={label}
                  onClick={() => { setActiveTab(label); setCurrentPage(1); }} 
                  className={`px-3 md:px-4 py-1.5 rounded-xl text-[10px] lg:text-[12px] font-semibold tracking-tight transition-all uppercase ${activeTab === label ? 'bg-[var(--accent)] text-white shadow-lg' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] opacity-40'}`}
                >
                  {label}
                </button>
              ))}
           </div>
           <button onClick={fetchDisputes} className="hidden md:flex size-11 md:size-12 rounded-2xl border border-[var(--glass-border)] hover:bg-[var(--accent)]/10 text-[var(--text-secondary)] items-center justify-center transition-all shadow-sm active:scale-95">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
           </button>
        </div>
      </header>

      <div className="p-4 md:p-10 space-y-8 pb-32">
         {/* Live Intelligence Stats */}
         <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
               { label: 'Active Disputes', value: disputes.filter(d => d.status !== 'resolved').length, icon: AlertCircle, color: 'var(--accent)', sub: 'THREATS' },
               { label: 'Settled Cases', value: disputes.filter(d => d.status === 'resolved').length, icon: CheckCircle2, color: '#10b981', sub: 'EQUITY' },
               { label: 'Avg Latency', value: '2.4 Days', icon: Clock, color: '#6366f1', sub: 'TIME' },
               { label: 'System Health', value: 'High', icon: ShieldCheck, color: '#fbbf24', sub: 'INTEGRITY' }
            ].map(s => (
               <div key={s.label} className="group relative p-5 md:p-6 rounded-[2rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 hover:bg-[var(--bg-primary)]/60 transition-all duration-500 backdrop-blur-xl shadow-sm hover:shadow-xl">
                  <div className="flex items-center justify-between mb-4">
                     <div className="size-9 rounded-xl bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--text-secondary)] border border-[var(--glass-border)] group-hover:text-[var(--text-primary)] transition-colors">
                        <s.icon className="size-4 opacity-40 group-hover:opacity-100" />
                     </div>
                     <span className="text-[9px] font-bold tracking-[0.2em] text-[var(--text-secondary)] opacity-20 group-hover:opacity-40 uppercase">{s.sub}</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase opacity-40 mb-1">{s.label}</p>
                    <h3 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">{s.value}</h3>
                  </div>
               </div>
            ))}
         </div>

         {/* Dispute Ledger */}
         <div className="rounded-[2.5rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 overflow-hidden shadow-2xl backdrop-blur-xl">
            <div className="p-6 md:p-8 border-b border-[var(--glass-border)] flex items-center justify-between bg-[var(--bg-secondary)]/20">
               <h3 className="text-xs font-bold text-[var(--text-primary)] tracking-[0.2em] flex items-center gap-3 uppercase">
                  <Database className="size-4 text-[var(--accent)]" /> Platform Dispute Ledger Protocol
               </h3>
               <p className="hidden md:block text-[10px] font-bold text-[var(--text-secondary)] opacity-30 uppercase tracking-[0.3em]">Arbitration Queue Synchronized</p>
            </div>

            <div className="p-4 md:p-8">
              {loading ? (
                 <LoadingSpinner />
              ) : currentDisputes.length > 0 ? (
                 <div className="grid grid-cols-1 gap-4">
                   {currentDisputes.map(d => {
                     const statusColor = d.status === 'resolved' ? 'text-emerald-500' : 'text-amber-500';
                     const statusBg = statusColor.replace('text-', 'bg-').concat('/10');

                     return (
                        <div 
                           key={d._id} 
                           onClick={() => openCase(d)}
                           className="group relative rounded-[2rem] bg-[var(--bg-primary)]/40 border border-[var(--glass-border)] shadow-sm hover:shadow-2xl transition-all duration-500 overflow-hidden hover:-translate-y-1 backdrop-blur-xl flex flex-col md:flex-row md:items-center p-5 md:p-6 gap-6 cursor-pointer"
                        >
                           <div className={`size-12 md:size-14 rounded-2xl ${statusBg} ${statusColor} flex items-center justify-center shrink-0 border ${statusColor.replace('text-', 'border-')}/10 shadow-inner group-hover:scale-105 transition-transform duration-500`}>
                              <AlertCircle className="w-6 h-6 md:w-7 h-7" />
                           </div>

                           <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-3">
                                 <div className="flex items-center gap-3">
                                    <span className="text-[11px] font-bold text-[var(--text-primary)] tracking-tight uppercase">Case Node #{d._id.slice(-6).toUpperCase()}</span>
                                    <span className={`px-2 py-0.5 rounded-lg text-[9px] font-bold tracking-widest border uppercase ${statusBg} ${statusColor} ${statusColor.replace('text-', 'border-')}/20`}>
                                       {d.status}
                                    </span>
                                 </div>
                                 <div className="flex items-center gap-2 text-[9px] font-bold text-[var(--text-secondary)] opacity-30 uppercase tracking-widest">
                                    <Clock className="w-3 h-3" /> {new Date(d.createdAt).toLocaleDateString()}
                                 </div>
                              </div>
                              <div className="space-y-1">
                                 <p className="text-[13px] font-bold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors capitalize truncate">{d.reason}</p>
                                 <p className="text-[11px] text-[var(--text-secondary)] opacity-60 truncate leading-relaxed">{d.description}</p>
                              </div>
                           </div>

                           <div className="flex items-center justify-between md:flex-col md:items-end md:justify-center gap-4 pt-5 md:pt-0 border-t md:border-t-0 border-[var(--glass-border)]/50">
                              <div className="text-left md:text-right">
                                 <p className="text-xl font-bold tabular-nums text-[var(--text-primary)] tracking-tighter">{(d.order_id?.total_amount || 0).toLocaleString()} <span className="text-[10px] opacity-30 ml-1 font-mono">XAF</span></p>
                                 <p className="text-[9px] font-bold text-[var(--text-secondary)] opacity-20 uppercase tracking-[0.2em] mt-0.5">Asset Value</p>
                              </div>
                              <div className="flex items-center gap-3 bg-[var(--bg-secondary)]/40 p-2 rounded-xl border border-[var(--glass-border)]">
                                 <div className="size-7 rounded-lg overflow-hidden border border-[var(--glass-border)] shadow-sm shrink-0">
                                    {d.initiator_id?.avatar ? <img src={d.initiator_id.avatar} className="size-full object-cover" /> : <User className="size-full p-1 opacity-20" />}
                                 </div>
                                 <p className="hidden lg:block text-[10px] font-bold text-[var(--text-secondary)] opacity-60 uppercase tracking-tighter max-w-[80px] truncate">{d.initiator_id?.name || 'Party'}</p>
                              </div>
                           </div>
                        </div>
                     );
                   })}
                 </div>
              ) : (
                 <div className="py-40 flex flex-col items-center justify-center opacity-10 px-10 text-center gap-6">
                    <Scale className="w-16 h-16 text-[var(--text-secondary)]" />
                    <p className="text-xs font-bold tracking-[0.4em] uppercase max-w-sm">No Active Arbitration Items</p>
                 </div>
              )}
            </div>

            <div className="p-6 md:p-8 border-t border-[var(--glass-border)] bg-[var(--bg-secondary)]/10">
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

"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { 
  Truck, Building2, MapPin, Package, 
  CheckCircle2, AlertTriangle, RefreshCw, Eye, Search, 
  ChevronDown, DollarSign, Scale, Database, Zap, 
  ShieldCheck, Loader2, Globe, Activity
} from 'lucide-react';
import api from '@/services/api';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { motion, AnimatePresence } from 'framer-motion';

export default function AdminLogistics() {
  const [mounted, setMounted] = useState(false);
  const [shipments, setShipments] = useState([]);
  const [shipmentTotal, setShipmentTotal] = useState(0);
  const [shipmentPage, setShipmentPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [firms, setFirms] = useState([]);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Shipments');
  const [newZone, setNewZone] = useState({ name: '', type: 'region', parent_id: '' });
  const [selectedFirm, setSelectedFirm] = useState(null);
  const [priceEditor, setPriceEditor] = useState({ quartier: '', price: '' });
  const [selectedShipment, setSelectedShipment] = useState(null);
  const [shipmentEdit, setShipmentEdit] = useState({
    status: 'pending',
    logistics_id: '',
    price: '',
    tracking_code: '',
    note: '',
  });

  useEffect(() => {
    setMounted(true);
    fetchLogistics();
  }, []);

  const fetchLogistics = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: 1, limit: 50 });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const respShip = await api.get(`/admin/logistics/shipments?${params}`);
      const respFirm = await api.get('/admin/logistics/firms');
      const respZone = await api.get('/logistics/zones');
      if (respShip.data?.success) {
        setShipments(respShip.data.data.shipments || []);
        setShipmentTotal(respShip.data.total || 0);
        setShipmentPage(1);
      }
      if (respFirm.data?.success) setFirms(respFirm.data.data.firms || []);
      if (respZone.data?.success) setZones(respZone.data.data.zones || []);
    } catch (err) {
      console.error('Failed to fetch logistics:', err);
      toast.error('Logistics monitoring failed to sync');
    } finally {
      setLoading(false);
    }
  };

  const loadMoreShipments = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const nextPage = shipmentPage + 1;
      const params = new URLSearchParams({ page: nextPage, limit: 50 });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await api.get(`/admin/logistics/shipments?${params}`);
      if (res.data?.success) {
        setShipments(prev => [...prev, ...(res.data.data.shipments || [])]);
        setShipmentTotal(res.data.total || 0);
        setShipmentPage(nextPage);
      }
    } catch {
      toast.error('Failed to load more shipments');
    } finally {
      setLoadingMore(false);
    }
  };

  // Re-fetch when status filter changes
  useEffect(() => {
    if (mounted) fetchLogistics();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const openShipmentEditor = (shipment) => {
    setSelectedShipment(shipment);
    setShipmentEdit({
      status: shipment.status || 'pending',
      logistics_id: shipment.logistics_id?._id || '',
      price: shipment.price || 0,
      tracking_code: shipment.tracking_code || '',
      note: '',
    });
  };

  const saveShipmentEdit = async () => {
    if (!selectedShipment?._id) return;
    try {
      const res = await api.patch(`/admin/logistics/shipments/${selectedShipment._id}`, shipmentEdit);
      if (res.data?.success) {
        toast.success('Shipment package updated.');
        setSelectedShipment(null);
        fetchLogistics();
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update shipment');
    }
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Surgical Header */}
      <header className="min-h-20 py-4 flex flex-col md:flex-row md:h-24 items-center justify-between px-4 md:px-10 border-b border-[var(--glass-border)] bg-[var(--bg-primary)]/80 backdrop-blur-xl sticky top-0 md:top-16 lg:top-0 z-40 gap-4 md:gap-0">
        <div className="flex items-center gap-4 md:gap-6 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-4">
            <div className="size-10 md:size-12 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] shadow-inner border border-[var(--accent)]/20 shrink-0">
               <Truck className="w-5 h-5 md:w-6 md:h-6" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-bold text-[var(--text-primary)] tracking-tight">Transit <span className="text-[var(--accent)]">Protocol</span></h2>
              <div className="flex items-center gap-2 mt-0.5">
                 <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                 <p className="text-[10px] md:text-[11px] lg:text-[12px] font-semibold text-[var(--text-secondary)] tracking-tight opacity-50 uppercase">Network Master</p>
              </div>
            </div>
          </div>
          <button onClick={fetchLogistics} className="md:hidden size-10 rounded-xl border border-[var(--glass-border)] text-[var(--text-secondary)] flex items-center justify-center active:scale-95">
             <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
           <div className="flex bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl p-1 overflow-x-auto no-scrollbar flex-1 md:flex-none justify-between md:justify-start">
              {['Shipments', 'Delivery Partners', 'Zones'].map(tab => (
                <button 
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 md:px-4 py-1.5 rounded-xl text-[10px] lg:text-[12px] font-semibold tracking-tight transition-all capitalize whitespace-nowrap ${activeTab === tab ? 'bg-[var(--accent)] text-white shadow-lg' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] opacity-40'}`}
                >
                  {tab}
                </button>
              ))}
           </div>
           <button onClick={fetchLogistics} className="hidden md:flex size-11 md:size-12 rounded-2xl border border-[var(--glass-border)] hover:bg-[var(--accent)]/10 text-[var(--text-secondary)] items-center justify-center transition-all shadow-sm active:scale-95">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
           </button>
        </div>
      </header>

      <div className="p-4 md:p-10 space-y-8 pb-32">
         {/* Live Intelligence Stats */}
         <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
               { label: 'Active Transit', value: shipments.filter(s => s.status !== 'delivered' && s.status !== 'failed').length, icon: Package, color: 'var(--accent)', sub: 'TRANSIT' },
               { label: 'Flow Success', value: '98.4%', icon: CheckCircle2, color: '#10b981', sub: 'FLOW' },
               { label: 'Node Count', value: firms.length, icon: Building2, color: '#6366f1', sub: 'NODES' },
               { label: 'Alert Items', value: shipments.filter(s => s.status === 'failed').length, icon: AlertTriangle, color: '#f43f5e', sub: 'RISK' }
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

         {/* Logistics Ledger */}
         <div className="rounded-[2.5rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 overflow-hidden shadow-2xl backdrop-blur-xl">
            <div className="p-6 md:p-8 border-b border-[var(--glass-border)] flex items-center justify-between bg-[var(--bg-secondary)]/20">
               <h3 className="text-xs font-bold text-[var(--text-primary)] tracking-[0.2em] flex items-center gap-3 uppercase">
                  <Database className="size-4 text-[var(--accent)]" /> Platform Transit Ledger // {activeTab}
               </h3>
               <p className="hidden md:block text-[10px] font-bold text-[var(--text-secondary)] opacity-30 uppercase tracking-[0.3em]">Synchronized Fulfillment Matrix</p>
            </div>

            {/* Shipment status filter bar */}
            {activeTab === 'Shipments' && (
              <div className="px-4 md:px-8 py-3 border-b border-[var(--glass-border)] flex flex-wrap items-center gap-2">
                {['all', 'pending', 'assigned', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed'].map(s => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${
                      statusFilter === s
                        ? 'bg-[var(--accent)] text-white'
                        : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--glass-border)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {s.replace(/_/g, ' ')}
                  </button>
                ))}
                <span className="ml-auto text-[10px] font-bold text-[var(--text-secondary)] opacity-40 uppercase tracking-widest">
                  {shipments.length} / {shipmentTotal} shipments
                </span>
              </div>
            )}

            <div className="min-h-[400px] p-4 md:p-8">
              {loading ? (
                 <LoadingSpinner />
              ) : (
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {activeTab === 'Shipments' ? shipments.map(s => (
                       <div key={s._id} className="group relative rounded-[2rem] bg-[var(--bg-primary)]/40 border border-[var(--glass-border)] shadow-sm hover:shadow-2xl transition-all duration-500 overflow-hidden hover:-translate-y-1 backdrop-blur-xl flex flex-col p-5 md:p-6">
                          <div className="flex items-center justify-between mb-6">
                             <div className="flex items-center gap-4">
                                <div className="size-11 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--accent)] shadow-inner group-hover:scale-105 transition-transform duration-500">
                                   <Package className="w-5 h-5" />
                                </div>
                                <div>
                                   <p className="text-[11px] font-bold text-[var(--text-primary)] font-mono tracking-tight uppercase">#{s.tracking_code || s._id.slice(-8).toUpperCase()}</p>
                                   <p className="text-[9px] font-bold text-[var(--text-secondary)] opacity-40 uppercase tracking-widest mt-0.5">Asset Transit ID</p>
                                </div>
                             </div>
                             <span className={`px-2 py-0.5 rounded-lg text-[9px] font-bold tracking-widest border uppercase ${
                                s.status === 'delivered' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 
                                s.status === 'failed' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' :
                                'bg-indigo-500/10 text-indigo-500 border-indigo-500/20'
                             }`}>
                                {s.status.replace(/_/g, ' ')}
                             </span>
                          </div>

                          <div className="space-y-4 mb-6">
                             <div className="flex items-start gap-3">
                                <MapPin className="size-3.5 text-[var(--accent)] mt-0.5" />
                                <div className="min-w-0">
                                   <p className="text-[11px] font-bold text-[var(--text-primary)] truncate capitalize">{s.delivery_address?.quartier || 'UNMAPPED_NODE'}</p>
                                   <p className="text-[9px] font-bold text-[var(--text-secondary)] opacity-30 uppercase tracking-widest mt-0.5">Destination Topology</p>
                                </div>
                             </div>
                             <div className="flex items-start gap-3">
                                <Building2 className="size-3.5 text-indigo-500 mt-0.5" />
                                <div className="min-w-0">
                                   <p className="text-[11px] font-bold text-[var(--text-primary)] truncate capitalize">{s.logistics_id?.company_name || 'PENDING_CARRIER'}</p>
                                   <p className="text-[9px] font-bold text-[var(--text-secondary)] opacity-30 uppercase tracking-widest mt-0.5">Assigned Network Center</p>
                                </div>
                             </div>
                          </div>

                          <div className="flex items-center justify-between pt-6 border-t border-[var(--glass-border)]/50 mt-auto">
                             <div>
                                <p className="text-base font-bold font-mono tracking-tight text-[var(--text-primary)]">{(s.price || 0).toLocaleString()} <span className="text-[10px] opacity-30">XAF</span></p>
                                <p className="text-[9px] font-bold text-[var(--text-secondary)] opacity-20 uppercase tracking-widest mt-0.5">Operational Tariff</p>
                             </div>
                             <button onClick={() => openShipmentEditor(s)} className="size-11 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)]/40 transition-all active:scale-95 shadow-sm">
                                <Eye className="w-5 h-5" />
                             </button>
                          </div>
                       </div>
                    )) : null}
                    {/* Load More — spans full grid width */}
                    {activeTab === 'Shipments' && shipments.length < shipmentTotal && (
                      <div className="col-span-full flex justify-center pt-4">
                        <button
                          onClick={loadMoreShipments}
                          disabled={loadingMore}
                          className="flex items-center gap-2 px-8 h-12 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] text-[11px] font-bold uppercase tracking-widest hover:text-[var(--accent)] hover:border-[var(--accent)]/40 transition-all active:scale-95 disabled:opacity-40"
                        >
                          {loadingMore ? <Loader2 className="size-4 animate-spin" /> : <ChevronDown className="size-4" />}
                          {loadingMore ? 'Loading...' : `Load more  (${shipmentTotal - shipments.length} remaining)`}
                        </button>
                      </div>
                    )}
                    {activeTab === 'Delivery Partners' ? firms.map(f => (
                       <div key={f._id} className="group relative rounded-[2rem] bg-[var(--bg-primary)]/40 border border-[var(--glass-border)] shadow-sm hover:shadow-2xl transition-all duration-500 overflow-hidden hover:-translate-y-1 backdrop-blur-xl flex flex-col p-5 md:p-6">
                          <div className="flex items-center justify-between mb-6">
                             <div className="flex items-center gap-4">
                                <div className="size-12 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-bold border border-indigo-500/10 overflow-hidden shadow-inner group-hover:scale-105 transition-transform duration-500">
                                   {f.user_id?.branding?.logo ? <img src={f.user_id.branding.logo} className="size-full object-cover" /> : f.company_name[0].toUpperCase()}
                                </div>
                                <div>
                                   <p className="text-[12px] font-bold text-[var(--text-primary)] truncate capitalize tracking-tight">{f.company_name}</p>
                                   <p className={`text-[9px] font-bold tracking-widest uppercase mt-0.5 ${f.is_verified ? 'text-emerald-500' : 'text-amber-500'}`}>
                                      {f.is_verified ? 'Verified Node' : 'Pending Verification'}
                                   </p>
                                </div>
                             </div>
                          </div>

                          <div className="space-y-4 mb-6">
                             <div className="flex flex-wrap gap-1.5">
                                {f.service_regions?.slice(0, 4).map(r => (
                                   <span key={r} className="px-2 py-0.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-tighter opacity-70">{r}</span>
                                ))}
                                {f.service_regions?.length > 4 && <span className="px-2 py-0.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[9px] font-bold text-[var(--text-secondary)] uppercase opacity-40">+{f.service_regions.length - 4} More</span>}
                             </div>
                             <p className="text-[10px] font-bold text-[var(--text-secondary)] opacity-30 uppercase tracking-[0.2em]">
                                Coverage Vector: {f.vehicle_types?.join(' // ')}
                             </p>
                          </div>

                          <div className="flex items-center gap-3 pt-6 border-t border-[var(--glass-border)]/50 mt-auto">
                             <button onClick={() => setSelectedFirm(f)} className="flex-1 h-12 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center gap-2 text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)]/40 transition-all active:scale-95 shadow-sm text-[10px] font-bold uppercase tracking-widest">
                                <Scale className="w-4 h-4" /> Tariffs
                             </button>
                             <button 
                                onClick={async () => {
                                   try {
                                      const res = await api.patch(`/admin/logistics/firms/${f._id}/verify`);
                                      if (res.data.success) {
                                         toast.success(res.data.message);
                                         fetchLogistics();
                                      }
                                   } catch { toast.error("Handshake failed."); }
                                }}
                                className={`flex-1 h-12 rounded-xl text-[10px] font-bold tracking-widest uppercase transition-all shadow-sm active:scale-95 border ${f.is_verified ? 'bg-rose-500/10 text-rose-500 border-rose-500/20 hover:bg-rose-500 hover:text-white' : 'bg-[var(--accent)] text-white border-transparent hover:opacity-90'}`}
                             >
                                {f.is_verified ? 'Revoke' : 'Verify'}
                             </button>
                          </div>
                       </div>
                    )) : zones.map(z => (
                       <div key={z._id} className="group relative rounded-[2rem] bg-[var(--bg-primary)]/40 border border-[var(--glass-border)] shadow-sm hover:shadow-2xl transition-all duration-500 overflow-hidden hover:-translate-y-1 backdrop-blur-xl flex flex-col p-5 md:p-6">
                          <div className="flex items-center justify-between mb-6">
                             <div className="flex items-center gap-4">
                                <div className="size-11 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--accent)] shadow-inner group-hover:scale-105 transition-transform duration-500">
                                   <Globe className="w-5 h-5" />
                                </div>
                                <div>
                                   <p className="text-[12px] font-bold text-[var(--text-primary)] font-mono tracking-tight uppercase truncate">{z.name}</p>
                                   <p className="text-[9px] font-bold text-[var(--text-secondary)] opacity-40 uppercase tracking-widest mt-0.5">Geographic Cluster</p>
                                </div>
                             </div>
                             <span className="px-2 py-0.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">{z.type}</span>
                          </div>

                          <div className="space-y-4 mb-6">
                             <div className="flex items-center justify-between">
                                <p className="text-[10px] font-bold text-[var(--text-secondary)] opacity-30 uppercase tracking-widest">Topology State</p>
                                <div className="flex items-center gap-2">
                                   <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]" />
                                   <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Active</span>
                                </div>
                             </div>
                             <p className="text-[10px] font-bold text-[var(--text-secondary)] opacity-30 uppercase tracking-[0.2em]">
                                Parent: {z.parent_id?.name || 'ROOT_SYSTEM'}
                             </p>
                          </div>

                          <div className="pt-6 border-t border-[var(--glass-border)]/50 mt-auto">
                             <button className="w-full h-11 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[10px] font-bold tracking-widest uppercase hover:bg-rose-500 hover:text-white transition-all active:scale-95 shadow-sm">
                                Purge Node
                             </button>
                          </div>
                       </div>
                    ))}
                 </div>
              )}
            </div>
         </div>

         {/* Zone Deployment Section */}
         {activeTab === 'Zones' && (
            <div className="max-w-xl mx-auto glass-panel p-6 md:p-10 rounded-[3rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 shadow-2xl relative overflow-hidden group backdrop-blur-2xl">
               <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.1] transition-opacity pointer-events-none">
                  <MapPin className="size-48" />
               </div>
               <div className="relative z-10">
                  <h3 className="text-xs font-bold text-[var(--accent)] tracking-[0.3em] uppercase mb-8 flex items-center gap-3">
                     <div className="h-5 w-1 bg-[var(--accent)] rounded-full" />
                     Deploy New Geographic Node
                  </h3>
                  <form className="space-y-6" onSubmit={async (e) => {
                     e.preventDefault();
                     try {
                        const payload = {
                           name: newZone.name,
                           type: newZone.type,
                           parent_id: newZone.type === 'quartier' ? newZone.parent_id || null : null,
                        };
                        const res = await api.post('/admin/logistics/zones', payload);
                        if (res.data.success) {
                           toast.success("Geographic node deployed.");
                           fetchLogistics();
                           setNewZone({ name: '', type: 'region', parent_id: '' });
                        }
                     } catch { toast.error("Deployment failed."); }
                  }}>
                     <div className="space-y-2">
                        <label className="text-[10px] font-bold tracking-widest text-[var(--text-secondary)] opacity-40 uppercase ml-1">Zone Identifier</label>
                        <input 
                           placeholder="NODE_DESIGNATION (E.G. AKWA)"
                           value={newZone.name}
                           onChange={e => setNewZone({...newZone, name: e.target.value})}
                           className="w-full h-14 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl px-6 text-[13px] font-bold uppercase outline-none focus:border-[var(--accent)] transition-all shadow-inner"
                        />
                     </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                           <label className="text-[10px] font-bold tracking-widest text-[var(--text-secondary)] opacity-40 uppercase ml-1">Topology Type</label>
                           <select 
                              value={newZone.type}
                              onChange={e => setNewZone({...newZone, type: e.target.value, parent_id: ''})}
                              className="w-full h-14 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl px-6 text-[11px] font-bold uppercase outline-none cursor-pointer focus:border-[var(--accent)] shadow-inner appearance-none"
                           >
                              <option value="region">Region / City Cluster</option>
                              <option value="quartier">Quartier (Sub-Node)</option>
                           </select>
                        </div>
                        {newZone.type === 'quartier' && (
                           <div className="space-y-2">
                              <label className="text-[10px] font-bold tracking-widest text-[var(--text-secondary)] opacity-40 uppercase ml-1">Parent Cluster</label>
                              <select 
                                 value={newZone.parent_id}
                                 onChange={e => setNewZone({...newZone, parent_id: e.target.value})}
                                 className="w-full h-14 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl px-6 text-[11px] font-bold uppercase outline-none cursor-pointer focus:border-[var(--accent)] shadow-inner appearance-none"
                              >
                                 <option value="">SELECT ROOT NODE</option>
                                 {zones.filter(z => z.type === 'region').map(z => (
                                    <option key={z._id} value={z._id}>{z.name.toUpperCase()}</option>
                                 ))}
                              </select>
                           </div>
                        )}
                     </div>
                     <button className="w-full h-14 bg-[var(--accent)] text-white rounded-2xl font-bold text-[10px] tracking-[0.3em] uppercase shadow-lg shadow-[var(--accent)]/20 hover:scale-[1.02] active:scale-95 transition-all">
                        Synchronize Node to Matrix
                     </button>
                  </form>
               </div>
            </div>
         )}
      </div>

      {/* Firm Pricing Modal */}
      <AnimatePresence>
         {selectedFirm && (
           <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
             <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setSelectedFirm(null)} />
             <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="relative w-full max-w-4xl bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-[2.5rem] p-6 md:p-10 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                <div className="flex items-start justify-between mb-8 md:mb-12 shrink-0">
                   <div className="flex items-center gap-4 md:gap-6">
                      <div className="size-14 md:size-16 rounded-[1.5rem] bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center font-bold border border-[var(--accent)]/20 text-2xl shadow-inner relative overflow-hidden shrink-0">
                         {selectedFirm.user_id?.branding?.logo ? <img src={selectedFirm.user_id.branding.logo} className="size-full object-cover" /> : selectedFirm.company_name[0].toUpperCase()}
                      </div>
                      <div>
                         <h3 className="text-xl md:text-3xl font-bold tracking-tight text-[var(--text-primary)]">{selectedFirm.company_name}</h3>
                         <p className="text-[10px] md:text-[11px] font-bold text-[var(--accent)] tracking-[0.3em] uppercase opacity-60 mt-0.5">Tariff Calibration Protocol</p>
                      </div>
                   </div>
                   <button onClick={() => setSelectedFirm(null)} className="p-2 rounded-xl hover:bg-[var(--bg-secondary)] transition-all text-[var(--text-secondary)]"><X className="size-6" /></button>
                </div>

                <div className="flex-1 overflow-y-auto no-scrollbar pr-2">
                   <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12">
                      <div className="space-y-6 md:space-y-8">
                         <div className="flex items-center gap-3">
                            <div className="size-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
                            <h4 className="text-[10px] font-bold tracking-[0.3em] uppercase opacity-40">Inject Operational Price Node</h4>
                         </div>
                         <div className="space-y-5">
                            <div className="space-y-2">
                               <label className="text-[10px] font-bold tracking-widest text-[var(--text-secondary)] opacity-40 uppercase ml-1">Target Topology Node</label>
                               <select 
                                  value={priceEditor.quartier}
                                  onChange={e => setPriceEditor({...priceEditor, quartier: e.target.value})}
                                  className="w-full h-14 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl px-6 text-[11px] font-bold uppercase outline-none focus:border-[var(--accent)] shadow-inner appearance-none cursor-pointer"
                               >
                                  <option value="">SELECT QUARTIER NODE</option>
                                  {zones.filter(z => z.type === 'quartier').map(z => (
                                     <option key={z._id} value={z.name}>{z.name.toUpperCase()}</option>
                                  ))}
                               </select>
                            </div>
                            <div className="space-y-2">
                               <label className="text-[10px] font-bold tracking-widest text-[var(--text-secondary)] opacity-40 uppercase ml-1">Operational Tariff (XAF)</label>
                               <div className="relative">
                                  <input 
                                     type="number"
                                     placeholder="0.00"
                                     value={priceEditor.price}
                                     onChange={e => setPriceEditor({...priceEditor, price: e.target.value})}
                                     className="w-full h-14 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl pl-14 pr-6 text-[11px] font-bold font-mono outline-none focus:border-[var(--accent)] shadow-inner"
                                  />
                                  <DollarSign className="absolute left-6 top-1/2 -translate-y-1/2 size-4 text-[var(--accent)] opacity-40" />
                               </div>
                            </div>
                            <button 
                               disabled={!priceEditor.quartier || !priceEditor.price}
                               onClick={async () => {
                                  const updatedPrices = [...(selectedFirm.quartier_prices || [])];
                                  const idx = updatedPrices.findIndex(p => p.quartier === priceEditor.quartier);
                                  if (idx > -1) updatedPrices[idx].price = Number(priceEditor.price);
                                  else updatedPrices.push({ quartier: priceEditor.quartier, price: Number(priceEditor.price) });
                                  
                                  try {
                                     const res = await api.patch(`/admin/logistics/firms/${selectedFirm._id}`, { quartier_prices: updatedPrices });
                                     if (res.data.success) {
                                        toast.success("Pricing node synchronized.");
                                        setSelectedFirm(res.data.data.firm);
                                        fetchLogistics();
                                        setPriceEditor({ quartier: '', price: '' });
                                     }
                                  } catch { toast.error("Sync protocol failure."); }
                               }}
                               className="w-full h-14 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-2xl font-bold text-[10px] tracking-[0.3em] uppercase shadow-xl hover:bg-[var(--accent)] hover:text-white transition-all disabled:opacity-30 active:scale-95"
                            >
                               Commit Tariff Node
                            </button>
                         </div>
                      </div>

                      <div className="space-y-6 md:space-y-8">
                         <div className="flex items-center gap-3">
                            <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <h4 className="text-[10px] font-bold tracking-[0.3em] uppercase opacity-40">Active Network Tariff Grid</h4>
                         </div>
                         <div className="grid grid-cols-1 gap-3 max-h-[400px] overflow-y-auto no-scrollbar pb-10">
                            {(selectedFirm.quartier_prices || []).map(p => (
                               <div key={p.quartier} className="flex justify-between items-center p-5 rounded-2xl bg-[var(--bg-secondary)]/40 border border-[var(--glass-border)]/50 hover:border-[var(--accent)]/40 transition-all group/item shadow-sm backdrop-blur-xl">
                                  <div>
                                     <span className="text-[11px] font-bold uppercase tracking-tight text-[var(--text-primary)]">{p.quartier}</span>
                                     <p className="text-[9px] font-bold text-[var(--text-secondary)] opacity-20 uppercase tracking-widest mt-0.5">Topology Sector</p>
                                  </div>
                                  <div className="text-right">
                                     <span className="text-base font-mono font-bold text-[var(--accent)] group-hover/item:scale-110 transition-transform block">{p.price.toLocaleString()} <span className="text-[10px] opacity-30 ml-1">XAF</span></span>
                                     <p className="text-[9px] font-bold text-[var(--text-secondary)] opacity-20 uppercase tracking-widest mt-0.5">Active Rate</p>
                                  </div>
                               </div>
                            ))}
                            {(!selectedFirm.quartier_prices || selectedFirm.quartier_prices.length === 0) && (
                               <div className="py-20 flex flex-col items-center justify-center gap-4 opacity-10 border-2 border-dashed border-[var(--glass-border)] rounded-[2.5rem]">
                                  <Scale className="size-12" />
                                  <p className="text-[11px] font-bold uppercase tracking-[0.4em]">Grid Data Void</p>
                               </div>
                            )}
                         </div>
                      </div>
                   </div>
                </div>
             </motion.div>
           </div>
         )}
      </AnimatePresence>

      {/* Shipment Editor Modal */}
      <AnimatePresence>
         {selectedShipment && (
           <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
             <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setSelectedShipment(null)} />
             <motion.div initial={{ y: 20, opacity: 0, scale: 0.95 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 20, opacity: 0, scale: 0.95 }} className="relative z-10 w-full max-w-2xl rounded-[2.5rem] border border-[var(--glass-border)] bg-[var(--bg-primary)] p-6 md:p-10 shadow-2xl backdrop-blur-3xl overflow-hidden">
               <div className="mb-8 md:mb-10 flex items-start justify-between">
                  <div>
                     <h3 className="text-xl md:text-2xl font-bold tracking-tight">Fulfillment Override</h3>
                     <p className="text-[10px] md:text-[11px] font-bold text-[var(--text-secondary)] opacity-40 uppercase tracking-[0.3em] mt-1">Manual Package Calibration Protocol</p>
                  </div>
                  <button onClick={() => setSelectedShipment(null)} className="p-2 rounded-xl hover:bg-[var(--bg-secondary)] transition-all text-[var(--text-secondary)]"><X className="size-6" /></button>
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                     <label className="text-[10px] font-bold tracking-widest opacity-30 uppercase ml-1">Transit ID Signal</label>
                     <input value={shipmentEdit.tracking_code} onChange={(e) => setShipmentEdit((s) => ({ ...s, tracking_code: e.target.value }))} className="w-full h-14 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl px-5 text-[11px] font-bold uppercase outline-none focus:border-[var(--accent)] transition-all shadow-inner" />
                  </div>
                  <div className="space-y-2">
                     <label className="text-[10px] font-bold tracking-widest opacity-30 uppercase ml-1">Manifest Tariff (XAF)</label>
                     <input type="number" value={shipmentEdit.price} onChange={(e) => setShipmentEdit((s) => ({ ...s, price: e.target.value }))} className="w-full h-14 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl px-5 text-[11px] font-bold font-mono outline-none focus:border-[var(--accent)] transition-all shadow-inner" />
                  </div>
                  <div className="space-y-2">
                     <label className="text-[10px] font-bold tracking-widest opacity-30 uppercase ml-1">Network Transmission State</label>
                     <select value={shipmentEdit.status} onChange={(e) => setShipmentEdit((s) => ({ ...s, status: e.target.value }))} className="w-full h-14 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl px-5 text-[11px] font-bold uppercase outline-none cursor-pointer focus:border-[var(--accent)] shadow-inner appearance-none">
                       <option value="pending">PENDING_NODE</option>
                       <option value="assigned">ASSIGNED_NODE</option>
                       <option value="picked_up">PICKED_UP</option>
                       <option value="in_transit">IN_TRANSIT</option>
                       <option value="out_for_delivery">OUT_FOR_DELIVERY</option>
                       <option value="delivered">DELIVERED</option>
                       <option value="failed">FAILED_SIGNAL</option>
                     </select>
                  </div>
                  <div className="space-y-2">
                     <label className="text-[10px] font-bold tracking-widest opacity-30 uppercase ml-1">Assigned Network Center</label>
                     <select value={shipmentEdit.logistics_id} onChange={(e) => setShipmentEdit((s) => ({ ...s, logistics_id: e.target.value }))} className="w-full h-14 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl px-5 text-[11px] font-bold uppercase outline-none cursor-pointer focus:border-[var(--accent)] shadow-inner appearance-none">
                       <option value="">MANUAL_OVERRIDE_MODE</option>
                       {firms.map((f) => (
                         <option key={f._id} value={f._id}>{f.company_name.toUpperCase()}</option>
                       ))}
                     </select>
                  </div>
               </div>
               
               <div className="mt-6 space-y-2">
                  <label className="text-[10px] font-bold tracking-widest opacity-30 uppercase ml-1">Internal Calibration Log</label>
                  <textarea rows={3} value={shipmentEdit.note} onChange={(e) => setShipmentEdit((s) => ({ ...s, note: e.target.value }))} className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl px-5 py-4 text-[11px] font-bold outline-none focus:border-[var(--accent)] transition-all shadow-inner" placeholder="Enter override justification..." />
               </div>

               <button onClick={saveShipmentEdit} className="mt-10 w-full h-14 bg-[var(--accent)] text-white rounded-2xl font-bold text-[10px] tracking-[0.3em] uppercase shadow-lg shadow-[var(--accent)]/20 hover:bg-[var(--text-primary)] transition-all active:scale-95">
                  Patch Transit Sequence Protocol
               </button>
             </motion.div>
           </div>
         )}
      </AnimatePresence>
    </div>
  );
}

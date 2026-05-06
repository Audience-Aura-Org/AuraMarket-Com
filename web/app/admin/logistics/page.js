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
      const respShip = await api.get('/admin/logistics/shipments');
      const respFirm = await api.get('/admin/logistics/firms');
      const respZone = await api.get('/logistics/zones');
      if (respShip.data?.success) setShipments(respShip.data.data.shipments || []);
      if (respFirm.data?.success) setFirms(respFirm.data.data.firms || []);
      if (respZone.data?.success) setZones(respZone.data.data.zones || []);
    } catch (err) {
      console.error('Failed to fetch logistics:', err);
      toast.error('Logistics monitoring failed to sync');
    } finally {
      setLoading(false);
    }
  };

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
      <header className="h-24 flex items-center justify-between px-10 border-b border-[var(--glass-border)] bg-[var(--bg-primary)]/80 backdrop-blur-xl sticky top-16 z-40">
        <div className="flex items-center gap-6">
          <div className="size-12 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] shadow-inner border border-[var(--accent)]/20">
             <Truck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[var(--text-primary)] tracking-tight ">Transit <span className="text-[var(--accent)]">Protocol</span> Monitoring</h2>
            <div className="flex items-center gap-2 mt-1">
               <div className="size-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
               <p className="text-[11px] lg:text-[12px] font-bold text-[var(--text-secondary)] tracking-tight opacity-50 capitalize">Operational Pipeline // Node_Transit_Master</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
           <div className="flex bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl p-1 overflow-x-auto no-scrollbar">
              {['Shipments', 'Delivery Partners', 'Zones'].map(tab => (
                <button 
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-1.5 rounded-xl text-[10px] lg:text-[12px] font-bold tracking-tight transition-all capitalize whitespace-nowrap ${activeTab === tab ? 'bg-[var(--accent)] text-white shadow-lg' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                >
                  {tab}
                </button>
              ))}
           </div>

           <button onClick={fetchLogistics} className="size-11 rounded-2xl border border-[var(--glass-border)] hover:bg-[var(--accent)]/10 text-[var(--text-secondary)] flex items-center justify-center transition-all shadow-sm active:scale-95">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
           </button>
        </div>
      </header>

      <div className="p-10 space-y-8 pb-40">
         {/* Live Stats */}
         <div className="grid grid-cols-4 gap-6">
            {[
               { label: 'Active Shipments', value: shipments.filter(s => s.status !== 'delivered' && s.status !== 'failed').length, icon: Package, color: 'var(--accent)', sub: 'TRANSIT_LOAD' },
               { label: 'Delivery Success', value: '98.4%', icon: CheckCircle2, color: '#10b981', sub: 'FLOW_EFFICIENCY' },
               { label: 'Carrier Nodes', value: firms.length, icon: Building2, color: '#6366f1', sub: 'NETWORK_NODES' },
               { label: 'Active Alerts', value: shipments.filter(s => s.status === 'failed').length, icon: AlertTriangle, color: '#f43f5e', sub: 'RISK_DETECTION' }
            ].map(s => (
               <div key={s.label} className="group relative p-8 rounded-[2.5rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 hover:bg-[var(--bg-primary)]/60 transition-all duration-500 overflow-hidden shadow-lg hover:shadow-2xl hover:-translate-y-1 backdrop-blur-2xl">
                  <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 size-32 rounded-full blur-[80px] opacity-10 transition-opacity group-hover:opacity-30" style={{ backgroundColor: s.color }} />
                  <div className="relative flex flex-col justify-between h-full space-y-8">
                     <div className="flex items-center justify-between">
                        <div className="size-12 rounded-[1.25rem] flex items-center justify-center border border-[var(--glass-border)] bg-[var(--bg-secondary)] shadow-inner text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-all duration-500">
                           <s.icon className="w-5 h-5 opacity-40 group-hover:opacity-100" />
                        </div>
                        <span className="text-[10px] lg:text-[12px] font-bold tracking-[0.3em] capitalize opacity-20 group-hover:opacity-40 transition-opacity font-mono">{s.sub}</span>
                     </div>
                     <div>
                        <p className="text-[10px] lg:text-[12px] font-bold text-[var(--text-secondary)] tracking-[0.2em] mb-2 capitalize opacity-40">{s.label}</p>
                        <h3 className="text-2xl font-bold text-[var(--text-primary)] tracking-tighter leading-none">{s.value}</h3>
                     </div>
                  </div>
               </div>
            ))}
         </div>

         {/* Logistics Ledger */}
         <div className="glass-panel rounded-[3rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 overflow-hidden shadow-2xl">
            <div className="p-8 border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/30 flex items-center justify-between">
               <h3 className="text-[11px] lg:text-[12px] font-bold text-[var(--text-primary)] tracking-[0.1em] flex items-center gap-3 capitalize">
                  <Database className="w-4 h-4 text-[var(--accent)]" /> 
                  Platform Transit Ledger // {activeTab.toUpperCase()}
               </h3>
               <p className="text-[10px] lg:text-[12px] font-bold text-[var(--text-secondary)] opacity-40 capitalize tracking-widest">Global Fulfillment Synchronized</p>
            </div>

            <div className="min-h-[400px]">
              {loading ? (
                 <LoadingSpinner text="Synchronizing Transit Matrix" />
              ) : (
                 <div className="overflow-x-auto">
                    <table className="w-full text-left font-sm">
                       <thead>
                          <tr className="text-[10px] lg:text-[12px] font-bold tracking-[0.3em] text-[var(--text-secondary)] border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/10 capitalize">
                             {activeTab === 'Shipments' ? (
                               <>
                                 <th className="px-10 py-5">Transit Node</th>
                                 <th className="px-6 py-5">Carrier Path</th>
                                 <th className="px-6 py-5">Tariff (XAF)</th>
                                 <th className="px-6 py-5">Network State</th>
                                 <th className="px-10 py-5 text-right">Actions</th>
                               </>
                             ) : activeTab === 'Delivery Partners' ? (
                               <>
                                 <th className="px-10 py-5">Logistics Center</th>
                                 <th className="px-6 py-5">Service Coverage</th>
                                 <th className="px-6 py-5">Vehicle Fleet</th>
                                 <th className="px-6 py-5">Admin State</th>
                                 <th className="px-10 py-5 text-right">Manage</th>
                               </>
                             ) : (
                               <>
                                 <th className="px-10 py-5">Geographic Node</th>
                                 <th className="px-6 py-5">Topology</th>
                                 <th className="px-6 py-5">Parent Cluster</th>
                                 <th className="px-6 py-5">Activity</th>
                                 <th className="px-10 py-5 text-right">Actions</th>
                               </>
                             )}
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-[var(--glass-border)]/50">
                          {activeTab === 'Shipments' ? shipments.map(s => (
                             <tr key={s._id} className="group hover:bg-[var(--accent)]/5 transition-all">
                                <td className="px-10 py-6">
                                   <div className="flex items-center gap-4">
                                      <div className="size-11 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--accent)] shadow-sm group-hover:scale-110 transition-transform">
                                         <Truck className="w-5 h-5" />
                                      </div>
                                      <div className="min-w-0">
                                         <p className="text-[11px] lg:text-[12px] font-bold text-[var(--text-primary)] font-mono tracking-tight capitalize">#{s.tracking_code || s._id.slice(-8).toUpperCase()}</p>
                                         <p className="text-[10px] lg:text-[12px] font-bold text-[var(--text-secondary)] opacity-40 mt-1 flex items-center gap-1.5 capitalize">
                                            <MapPin className="w-3 h-3 text-[var(--accent)]" /> {s.delivery_address?.quartier || 'UNMAPPED'}
                                         </p>
                                      </div>
                                   </div>
                                </td>
                                <td className="px-6 py-6">
                                   <p className="text-[11px] lg:text-[12px] font-bold text-[var(--text-primary)] capitalize">{s.logistics_id?.company_name || 'PENDING_CARRIER'}</p>
                                   <p className="text-[10px] lg:text-[12px] font-bold text-[var(--text-secondary)] opacity-30 mt-1 capitalize">From: {s.vendor_id?.store_name || 'MERCHANT'}</p>
                                </td>
                                <td className="px-6 py-6 font-mono text-[11px] lg:text-[12px] font-bold text-[var(--text-primary)]">
                                   {(s.price || 0).toLocaleString()} <span className="opacity-30">XAF</span>
                                </td>
                                <td className="px-6 py-6">
                                   <span className={`px-3 py-1 rounded-full text-[10px] lg:text-[12px] font-bold tracking-widest border capitalize ${
                                      s.status === 'delivered' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 
                                      s.status === 'failed' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' :
                                      'bg-indigo-500/10 text-indigo-500 border-indigo-500/20'
                                   }`}>
                                      {s.status.replace(/_/g, ' ')}
                                   </span>
                                </td>
                                <td className="px-10 py-6 text-right">
                                   <button onClick={() => openShipmentEditor(s)} className="size-9 rounded-xl border border-[var(--glass-border)] hover:bg-[var(--accent)]/10 text-[var(--text-secondary)] hover:text-[var(--accent)] transition-all flex items-center justify-center shadow-sm">
                                      <Eye className="w-4 h-4" />
                                   </button>
                                </td>
                             </tr>
                          )) : activeTab === 'Delivery Partners' ? firms.map(f => (
                             <tr key={f._id} className="group hover:bg-[var(--accent)]/5 transition-all">
                                <td className="px-10 py-6">
                                   <div className="flex items-center gap-4">
                                      <div className="size-11 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-bold border border-indigo-500/10 overflow-hidden shadow-sm">
                                         {f.user_id?.branding?.logo ? <img src={f.user_id.branding.logo} className="size-full object-cover" /> : f.company_name[0].toUpperCase()}
                                      </div>
                                      <div className="min-w-0">
                                         <p className="text-[11px] lg:text-[12px] font-bold text-[var(--text-primary)] capitalize tracking-tight">{f.company_name}</p>
                                         <p className="text-[10px] lg:text-[12px] font-bold text-[var(--text-secondary)] opacity-30 mt-1 capitalize truncate max-w-[200px]">{f.user_id?.email}</p>
                                      </div>
                                   </div>
                                </td>
                                <td className="px-6 py-6">
                                   <div className="flex flex-wrap gap-1.5 max-w-[200px]">
                                      {f.service_regions?.map(r => (
                                         <span key={r} className="px-2 py-0.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[10px] lg:text-[12px] font-bold text-[var(--text-secondary)] capitalize tracking-tighter">{r}</span>
                                      ))}
                                   </div>
                                </td>
                                <td className="px-6 py-6">
                                   <p className="text-[10px] lg:text-[12px] font-bold text-[var(--text-secondary)] opacity-40 capitalize tracking-widest">
                                      {f.vehicle_types?.join(' // ')}
                                   </p>
                                </td>
                                <td className="px-6 py-6">
                                   <span className={`px-3 py-1 rounded-full text-[10px] lg:text-[12px] font-bold tracking-widest border capitalize ${f.is_verified ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}>
                                      {f.is_verified ? 'Verified' : 'Pending'}
                                   </span>
                                </td>
                                <td className="px-10 py-6 text-right">
                                   <div className="flex items-center justify-end gap-2">
                                      <button onClick={() => setSelectedFirm(f)} className="size-9 rounded-xl border border-[var(--glass-border)] hover:bg-[var(--accent)]/10 text-[var(--accent)] transition-all flex items-center justify-center shadow-sm">
                                         <Scale className="w-4 h-4" />
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
                                         className={`px-4 py-2 rounded-xl text-[10px] lg:text-[12px] font-bold tracking-widest capitalize transition-all shadow-sm ${f.is_verified ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500 hover:text-white' : 'bg-[var(--accent)] text-white hover:opacity-90'}`}
                                      >
                                         {f.is_verified ? 'REVOKE' : 'VERIFY'}
                                      </button>
                                   </div>
                                </td>
                             </tr>
                          )) : zones.map(z => (
                             <tr key={z._id} className="group hover:bg-[var(--accent)]/5 transition-all">
                                <td className="px-10 py-6 text-[11px] lg:text-[12px] font-bold text-[var(--text-primary)] font-mono capitalize tracking-tight">{z.name}</td>
                                <td className="px-6 py-6">
                                   <span className="px-3 py-1 rounded-lg bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[10px] lg:text-[12px] font-bold text-[var(--text-secondary)] capitalize tracking-widest">{z.type}</span>
                                </td>
                                <td className="px-6 py-6 text-[10px] lg:text-[12px] font-bold text-[var(--text-secondary)] opacity-30 capitalize tracking-widest">{z.parent_id?.name || 'ROOT_CLUSTER'}</td>
                                <td className="px-6 py-6">
                                   <div className="flex items-center gap-2">
                                      <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]" />
                                      <span className="text-[10px] lg:text-[12px] font-bold text-emerald-500 capitalize tracking-widest">Active Node</span>
                                   </div>
                                </td>
                                <td className="px-10 py-6 text-right">
                                   <button className="px-4 py-2 rounded-xl border border-rose-500/20 text-rose-500 text-[10px] lg:text-[12px] font-bold tracking-widest capitalize hover:bg-rose-500 hover:text-white transition-all">Purge</button>
                                </td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
              )}
            </div>
         </div>

         {/* Zone Deployment Section */}
         {activeTab === 'Zones' && (
            <div className="max-w-xl mx-auto glass-panel p-10 rounded-[3rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 shadow-2xl relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.1] transition-opacity pointer-events-none">
                  <MapPin className="size-48" />
               </div>
               <div className="relative z-10">
                  <h3 className="text-xs font-bold text-[var(--accent)] tracking-[0.3em] capitalize mb-8 flex items-center gap-3">
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
                        <label className="text-[10px] lg:text-[12px] font-bold tracking-widest text-[var(--text-secondary)] opacity-40 capitalize ml-1">Zone Identifier</label>
                        <input 
                           placeholder="NODE_NAME (E.G. AKWA)"
                           value={newZone.name}
                           onChange={e => setNewZone({...newZone, name: e.target.value})}
                           className="w-full h-14 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl px-5 text-[11px] lg:text-[12px] font-bold capitalize outline-none focus:border-[var(--accent)] transition-all shadow-inner"
                        />
                     </div>
                     <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                           <label className="text-[10px] lg:text-[12px] font-bold tracking-widest text-[var(--text-secondary)] opacity-40 capitalize ml-1">Topology Type</label>
                           <select 
                              value={newZone.type}
                              onChange={e => setNewZone({...newZone, type: e.target.value, parent_id: ''})}
                              className="w-full h-14 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl px-5 text-[11px] lg:text-[12px] font-bold capitalize outline-none cursor-pointer focus:border-[var(--accent)]"
                           >
                              <option value="region">Region / City</option>
                              <option value="quartier">Quartier (Sub)</option>
                           </select>
                        </div>
                        {newZone.type === 'quartier' && (
                           <div className="space-y-2">
                              <label className="text-[10px] lg:text-[12px] font-bold tracking-widest text-[var(--text-secondary)] opacity-40 capitalize ml-1">Parent Cluster</label>
                              <select 
                                 value={newZone.parent_id}
                                 onChange={e => setNewZone({...newZone, parent_id: e.target.value})}
                                 className="w-full h-14 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl px-5 text-[11px] lg:text-[12px] font-bold capitalize outline-none cursor-pointer focus:border-[var(--accent)]"
                              >
                                 <option value="">SELECT ROOT</option>
                                 {zones.filter(z => z.type === 'region').map(z => (
                                    <option key={z._id} value={z._id}>{z.name.toUpperCase()}</option>
                                 ))}
                              </select>
                           </div>
                        )}
                     </div>
                     <button className="w-full h-14 bg-[var(--accent)] text-white rounded-2xl font-bold text-[10px] lg:text-[12px] tracking-[0.3em] capitalize shadow-lg shadow-[var(--accent)]/20 hover:scale-[1.02] active:scale-95 transition-all">
                        Sync Node to Matrix
                     </button>
                  </form>
               </div>
            </div>
         )}
      </div>

      {/* Firm Pricing Modal */}
      {selectedFirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={() => setSelectedFirm(null)} />
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="max-w-5xl w-full glass-panel rounded-[3rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/90 backdrop-blur-3xl p-12 relative z-10 flex flex-col max-h-[90vh] shadow-2xl">
             <div className="flex items-start justify-between mb-12 shrink-0">
                <div className="flex items-center gap-6">
                   <div className="size-16 rounded-[1.5rem] bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center font-bold border border-[var(--accent)]/20 text-2xl shadow-lg relative overflow-hidden">
                      {selectedFirm.user_id?.branding?.logo ? <img src={selectedFirm.user_id.branding.logo} className="size-full object-cover" /> : selectedFirm.company_name[0].toUpperCase()}
                   </div>
                   <div>
                      <h3 className="text-3xl font-bold tracking-tighter">{selectedFirm.company_name}</h3>
                      <p className="text-[10px] lg:text-[12px] font-bold text-[var(--accent)] tracking-[0.4em] capitalize opacity-60">Tariff Calibration Matrix</p>
                   </div>
                </div>
                <button onClick={() => setSelectedFirm(null)} className="size-12 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all text-[11px] lg:text-[12px] font-bold tracking-widest shadow-sm">
                   ESC
                </button>
             </div>

             <div className="flex-1 overflow-y-auto no-scrollbar pr-4">
                <div className="grid lg:grid-cols-2 gap-12">
                   <div className="space-y-8">
                      <h4 className="text-[10px] lg:text-[12px] font-bold tracking-[0.3em] capitalize opacity-40 border-l-2 border-[var(--accent)] pl-4">Inject Price Node</h4>
                      <div className="space-y-5">
                         <div className="space-y-2">
                            <label className="text-[10px] lg:text-[12px] font-bold tracking-widest text-[var(--text-secondary)] opacity-40 capitalize ml-1">Topology Node</label>
                            <select 
                               value={priceEditor.quartier}
                               onChange={e => setPriceEditor({...priceEditor, quartier: e.target.value})}
                               className="w-full h-14 bg-[var(--bg-secondary)]/50 border border-[var(--glass-border)] rounded-2xl px-5 text-[11px] lg:text-[12px] font-bold capitalize outline-none focus:border-[var(--accent)]"
                            >
                               <option value="">SELECT QUARTIER</option>
                               {zones.filter(z => z.type === 'quartier').map(z => (
                                  <option key={z._id} value={z.name}>{z.name.toUpperCase()}</option>
                               ))}
                            </select>
                         </div>
                         <div className="space-y-2">
                            <label className="text-[10px] lg:text-[12px] font-bold tracking-widest text-[var(--text-secondary)] opacity-40 capitalize ml-1">Operational Tariff (XAF)</label>
                            <div className="relative">
                               <input 
                                  type="number"
                                  placeholder="0.00"
                                  value={priceEditor.price}
                                  onChange={e => setPriceEditor({...priceEditor, price: e.target.value})}
                                  className="w-full h-14 bg-[var(--bg-secondary)]/50 border border-[var(--glass-border)] rounded-2xl px-14 text-[11px] lg:text-[12px] font-bold font-mono outline-none focus:border-[var(--accent)]"
                               />
                               <DollarSign className="absolute left-5 top-1/2 -translate-y-1/2 size-4 text-[var(--accent)] opacity-40" />
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
                            className="w-full h-14 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-2xl font-bold text-[10px] lg:text-[12px] tracking-[0.3em] capitalize shadow-xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-30"
                         >
                            Commit Tariff Node
                         </button>
                      </div>
                   </div>

                   <div className="space-y-8">
                      <h4 className="text-[10px] lg:text-[12px] font-bold tracking-[0.3em] capitalize opacity-40 border-l-2 border-emerald-500 pl-4">Active Tariff Grid</h4>
                      <div className="grid grid-cols-1 gap-3 max-h-[400px] overflow-y-auto no-scrollbar pb-10">
                         {(selectedFirm.quartier_prices || []).map(p => (
                            <div key={p.quartier} className="flex justify-between items-center p-5 rounded-2xl bg-[var(--bg-secondary)]/30 border border-[var(--glass-border)]/50 hover:border-[var(--accent)]/40 transition-all group/item shadow-sm">
                               <span className="text-[11px] lg:text-[12px] font-bold capitalize tracking-tight text-[var(--text-primary)]">{p.quartier}</span>
                               <span className="text-sm font-mono font-bold text-[var(--accent)] group-hover/item:scale-110 transition-transform">{p.price.toLocaleString()} <span className="text-[10px] lg:text-[12px] opacity-30 ml-1">XAF</span></span>
                            </div>
                         ))}
                         {(!selectedFirm.quartier_prices || selectedFirm.quartier_prices.length === 0) && (
                            <div className="py-20 flex flex-col items-center justify-center gap-4 opacity-10 border-2 border-dashed border-[var(--glass-border)] rounded-[3rem]">
                               <Scale className="size-12" />
                               <p className="text-[11px] lg:text-[12px] font-bold capitalize tracking-[0.3em]">Grid Void</p>
                            </div>
                         )}
                      </div>
                   </div>
                </div>
             </div>
          </motion.div>
        </div>
      )}

      {/* Shipment Editor Modal */}
      {selectedShipment && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSelectedShipment(null)} />
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="relative z-10 w-full max-w-2xl rounded-[3rem] border border-[var(--glass-border)] bg-[var(--bg-primary)] p-10 shadow-2xl">
            <div className="mb-8 flex items-center justify-between">
               <div>
                  <h3 className="text-xl font-bold tracking-tighter">Fulfillment Override</h3>
                  <p className="text-[10px] lg:text-[12px] font-bold text-[var(--text-secondary)] opacity-40 capitalize tracking-widest mt-1">Manual Package Calibration</p>
               </div>
               <button onClick={() => setSelectedShipment(null)} className="size-10 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all text-[11px] lg:text-[12px] font-bold tracking-tight">ESC</button>
            </div>
            
            <div className="grid grid-cols-2 gap-6">
               <div className="space-y-2">
                  <label className="text-[10px] lg:text-[12px] font-bold tracking-widest opacity-30 capitalize ml-1">Transit ID</label>
                  <input value={shipmentEdit.tracking_code} onChange={(e) => setShipmentEdit((s) => ({ ...s, tracking_code: e.target.value }))} className="w-full h-12 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl px-4 text-[11px] lg:text-[12px] font-bold capitalize outline-none focus:border-[var(--accent)]" />
               </div>
               <div className="space-y-2">
                  <label className="text-[10px] lg:text-[12px] font-bold tracking-widest opacity-30 capitalize ml-1">Manifest Tariff</label>
                  <input type="number" value={shipmentEdit.price} onChange={(e) => setShipmentEdit((s) => ({ ...s, price: e.target.value }))} className="w-full h-12 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl px-4 text-[11px] lg:text-[12px] font-bold font-mono outline-none focus:border-[var(--accent)]" />
               </div>
               <div className="space-y-2">
                  <label className="text-[10px] lg:text-[12px] font-bold tracking-widest opacity-30 capitalize ml-1">Network State</label>
                  <select value={shipmentEdit.status} onChange={(e) => setShipmentEdit((s) => ({ ...s, status: e.target.value }))} className="w-full h-12 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl px-4 text-[11px] lg:text-[12px] font-bold capitalize outline-none cursor-pointer">
                    <option value="pending">PENDING</option>
                    <option value="assigned">ASSIGNED</option>
                    <option value="picked_up">PICKED_UP</option>
                    <option value="in_transit">IN_TRANSIT</option>
                    <option value="out_for_delivery">OUT_FOR_DELIVERY</option>
                    <option value="delivered">DELIVERED</option>
                    <option value="failed">FAILED</option>
                  </select>
               </div>
               <div className="space-y-2">
                  <label className="text-[10px] lg:text-[12px] font-bold tracking-widest opacity-30 capitalize ml-1">Assigned Carrier</label>
                  <select value={shipmentEdit.logistics_id} onChange={(e) => setShipmentEdit((s) => ({ ...s, logistics_id: e.target.value }))} className="w-full h-12 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl px-4 text-[11px] lg:text-[12px] font-bold capitalize outline-none cursor-pointer">
                    <option value="">MANUAL_FULFILLMENT</option>
                    {firms.map((f) => (
                      <option key={f._id} value={f._id}>{f.company_name.toUpperCase()}</option>
                    ))}
                  </select>
               </div>
            </div>
            
            <div className="mt-6 space-y-2">
               <label className="text-[10px] lg:text-[12px] font-bold tracking-widest opacity-30 capitalize ml-1">Internal Log</label>
               <textarea rows={3} value={shipmentEdit.note} onChange={(e) => setShipmentEdit((s) => ({ ...s, note: e.target.value }))} className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl px-4 py-3 text-[11px] lg:text-[12px] font-bold outline-none focus:border-[var(--accent)]" />
            </div>

            <button onClick={saveShipmentEdit} className="mt-8 w-full h-14 bg-[var(--accent)] text-white rounded-2xl font-bold text-[10px] lg:text-[12px] tracking-[0.3em] capitalize shadow-lg shadow-[var(--accent)]/20 hover:scale-[1.02] active:scale-95 transition-all">
               Patch Transit Sequence
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
}

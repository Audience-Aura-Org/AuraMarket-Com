"use client";

import { useState, useEffect } from 'react';
import { 
  Truck, Building2, MapPin, Package, 
  CheckCircle2, AlertTriangle, RefreshCw, Eye, Search, ChevronDown, DollarSign, Scale
} from 'lucide-react';
import RoleSidebar from '@/components/layout/RoleSidebar';
import api from '@/services/api';
import { toast } from 'react-hot-toast';

export const dynamic = 'force-dynamic';

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
    <>
      <header className="h-20 lg:h-24 flex flex-col lg:flex-row lg:items-center justify-between px-6 lg:px-10 border-b border-[var(--glass-border)] bg-[var(--bg-primary)]/50 shrink-0 z-10 py-4 lg:py-0 gap-4 lg:gap-0">
        <div className="flex items-center gap-4 lg:gap-6">
          <h2 className="text-lg lg:text-xl font-black text-[var(--text-primary)] tracking-tight uppercase">Platform <span className="text-[var(--accent)]">Transit</span></h2>
          <div className="hidden sm:block h-6 w-px bg-[var(--glass-border)] opacity-30" />
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
             {['Shipments', 'Delivery Partners', 'Zones'].map(tab => (
               <button 
                 key={tab}
                 onClick={() => setActiveTab(tab)} 
                 className={`px-3 lg:px-4 py-1.5 lg:py-2 rounded-lg text-[8px] lg:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === tab ? 'bg-[var(--accent)] text-white shadow-lg' : 'hover:bg-[var(--accent)]/10 text-[var(--text-secondary)]'}`}
               >
                 {tab}
               </button>
             ))}
          </div>
        </div>
        <button onClick={fetchLogistics} className="self-end lg:self-auto p-2 lg:p-2.5 rounded-lg border border-[var(--glass-border)] hover:bg-[var(--accent)]/10 transition-all text-[var(--text-secondary)]">
           <RefreshCw className={`w-3.5 h-3.5 lg:w-4 lg:h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      <div className="p-4 lg:p-10 space-y-6 lg:space-y-10 pb-32">
         {/* Transit Overview */}
         <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
            {[
              { label: 'Active Shipments', value: shipments.filter(s => s.status !== 'delivered' && s.status !== 'failed').length, icon: Package, color: 'text-indigo-500' },
              { label: 'Registered Partners', value: firms.length, icon: Building2, color: 'text-[var(--accent)]' },
              { label: 'Delivery Success Rate', value: '98.4%', icon: CheckCircle2, color: 'text-emerald-500' },
              { label: 'On-Route Issues', value: shipments.filter(s => s.status === 'failed').length + ' Alerts', icon: AlertTriangle, color: 'text-rose-500' }
            ].map(s => (
              <div key={s.label} className="glass-panel p-4 lg:p-5 rounded-2xl lg:rounded-[2rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 shadow-sm transition-all">
                 <p className="text-[7px] lg:text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em] mb-1 opacity-50">{s.label}</p>
                 <h3 className={`text-base lg:text-xl font-black ${s.color} tracking-tight`}>{s.value}</h3>
              </div>
            ))}
         </div>

         {/* Data Display */}
         <div className="glass-panel rounded-[24px] lg:rounded-[32px] overflow-hidden border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 shadow-xl">
            <div className="overflow-x-auto scroll-smooth">
               <table className="w-full text-left min-w-[800px] lg:min-w-0 font-sm">
                  <thead>
                     <tr className="text-[8px] lg:text-[10px] font-black tracking-[0.3em] uppercase text-[var(--text-secondary)] border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/30">
                        {activeTab === 'Shipments' ? (
                          <>
                            <th className="px-6 lg:px-8 py-4 lg:py-5">Transit Node</th>
                            <th className="px-4 lg:px-6 py-4 lg:py-5">Carrier Path</th>
                            <th className="px-4 lg:px-6 py-4 lg:py-5">Amount (XAF)</th>
                            <th className="px-4 lg:px-6 py-4 lg:py-5">Network State</th>
                            <th className="px-6 lg:px-8 py-4 lg:py-5 text-right">Actions</th>
                          </>
                        ) : activeTab === 'Delivery Partners' ? (
                          <>
                            <th className="px-6 lg:px-8 py-4 lg:py-5">Logistics Center</th>
                            <th className="px-4 lg:px-6 py-4 lg:py-5">Service Coverage</th>
                            <th className="px-4 lg:px-6 py-4 lg:py-5">Vehicle Fleet</th>
                            <th className="px-4 lg:px-6 py-4 lg:py-5">Admin State</th>
                            <th className="px-6 lg:px-8 py-4 lg:py-5 text-right">Manage</th>
                          </>
                        ) : (
                          <>
                            <th className="px-6 lg:px-8 py-4 lg:py-5">Geographic Node</th>
                            <th className="px-4 lg:px-6 py-4 lg:py-5">Type</th>
                            <th className="px-4 lg:px-6 py-4 lg:py-5">Parent Cluster</th>
                            <th className="px-4 lg:px-6 py-4 lg:py-5">Activity</th>
                            <th className="px-6 lg:px-8 py-4 lg:py-5 text-right">Actions</th>
                          </>
                        )}
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--glass-border)]/50">
                     {activeTab === 'Shipments' ? shipments.map(s => (
                       <tr key={s._id} className="hover:bg-[var(--accent)]/5 transition-colors group">
                          <td className="px-6 lg:px-8 py-4 lg:py-5">
                             <div className="flex items-center gap-3">
                                <div className="p-2 lg:p-2.5 rounded-lg bg-[var(--bg-secondary)] text-[var(--accent)] shadow-sm border border-[var(--glass-border)]/20">
                                   <Truck className="size-3.5 lg:size-4" />
                                </div>
                                <div className="min-w-0">
                                   <p className="text-xs lg:text-sm font-black text-[var(--text-primary)] uppercase tracking-tight font-mono truncate">{s.tracking_code}</p>
                                   <p className="text-[8px] lg:text-[9px] font-bold text-[var(--text-secondary)] opacity-50 flex items-center gap-1 truncate"><MapPin className="size-2 text-[var(--accent)]" /> {s.delivery_address?.quartier || s.delivery_address?.city || 'Unspecified'}</p>
                                </div>
                             </div>
                          </td>
                          <td className="px-4 lg:px-6 py-4 lg:py-5 min-w-0">
                             <p className="text-[10px] lg:text-xs font-bold text-[var(--text-primary)] truncate max-w-[120px] lg:max-w-[150px] uppercase">{s.logistics_id?.company_name || s.logistics_company_id?.company_name || 'Carrier Pending'}</p>
                             <p className="text-[7px] lg:text-[8px] text-[var(--text-secondary)] font-black uppercase tracking-widest opacity-30 truncate">From: {s.vendor_id?.store_name || s.vendor_id?.name}</p>
                          </td>
                          <td className="px-4 lg:px-6 py-4 lg:py-5">
                             <p className="text-xs lg:text-sm font-black text-[var(--text-primary)] font-mono whitespace-nowrap">{(s.price || 0).toLocaleString()} <span className="text-[8px] opacity-40">XAF</span></p>
                          </td>
                          <td className="px-4 lg:px-6 py-4 lg:py-5">
                             <span className={`px-2.5 lg:px-3 py-1 rounded-full text-[7px] lg:text-[8px] font-black uppercase tracking-[0.2em] border shadow-sm shrink-0 inline-block transition-all ${
                               s.status === 'delivered' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-emerald-500/10' : 
                               s.status === 'failed' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20 shadow-rose-500/10' :
                               ['in_transit', 'out_for_delivery'].includes(s.status) ? 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20 shadow-indigo-500/10' :
                               'bg-amber-500/10 text-amber-500 border-amber-500/20 shadow-amber-500/10'
                             }`}>
                                {s.status.replace(/_/g, ' ')}
                             </span>
                          </td>
                          <td className="px-6 lg:px-8 py-4 lg:py-5 text-right whitespace-nowrap">
                             <button onClick={() => openShipmentEditor(s)} className="p-2 lg:p-2.5 rounded-lg border border-[var(--glass-border)] hover:bg-[var(--accent)]/10 transition-all opacity-40 hover:opacity-100 shadow-sm active:scale-95">
                                <Eye className="size-3.5 lg:size-4" />
                             </button>
                          </td>
                       </tr>
                     )) : activeTab === 'Delivery Partners' ? firms.map(f => (
                       <tr key={f._id} className="hover:bg-[var(--accent)]/5 transition-colors group">
                          <td className="px-6 lg:px-8 py-4 lg:py-5">
                             <div className="flex items-center gap-3 lg:gap-4">
                                <div className="size-9 lg:size-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-black border border-indigo-500/10 overflow-hidden shadow-sm flex-shrink-0">
                                   {f.user_id?.branding?.logo ? <img src={f.user_id.branding.logo} className="size-full object-cover" /> : f.company_name[0].toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                   <p className="text-xs lg:text-sm font-black text-[var(--text-primary)] uppercase tracking-tight truncate">{f.company_name}</p>
                                   <p className="text-[8px] lg:text-[9px] font-bold text-[var(--text-secondary)] opacity-50 lowercase truncate">{f.user_id?.email}</p>
                                </div>
                             </div>
                          </td>
                          <td className="px-4 lg:px-6 py-4 lg:py-5">
                             <div className="flex flex-wrap gap-1 max-w-[150px] lg:max-w-none">
                                {f.service_regions?.map(r => (
                                  <span key={r} className="px-2 py-0.5 rounded bg-[var(--bg-secondary)] text-[var(--text-secondary)] text-[7px] lg:text-[8px] font-bold uppercase tracking-tighter lg:tracking-normal border border-[var(--glass-border)]/20 shadow-sm">{r}</span>
                                ))}
                             </div>
                          </td>
                          <td className="px-4 lg:px-6 py-4 lg:py-5">
                             <p className="text-[9px] lg:text-xs font-bold text-[var(--text-primary)] opacity-50 font-mono italic flex items-center gap-2 uppercase tracking-tight">
                                {f.vehicle_types?.map(v => v.charAt(0).toUpperCase()).join(', ')}
                             </p>
                          </td>
                          <td className="px-4 lg:px-6 py-4 lg:py-5">
                              <span className={`px-2.5 lg:px-3 py-1 rounded-full text-[7px] lg:text-[8px] font-black uppercase tracking-[0.2em] border shadow-sm shrink-0 inline-block transition-all ${f.is_verified ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-emerald-500/10' : 'bg-amber-500/10 text-amber-500 border-amber-500/20 shadow-amber-500/10'}`}>
                                 {f.is_verified ? 'Verified' : 'Pending'}
                              </span>
                           </td>
                           <td className="px-6 lg:px-8 py-4 lg:py-5 text-right">
                              <div className="flex items-center justify-end gap-2 shrink-0">
                                <button 
                                   onClick={() => setSelectedFirm(f)}
                                   className="p-2 lg:p-2.5 rounded-lg border border-[var(--glass-border)] hover:bg-[var(--accent)]/10 transition-all text-[var(--accent)] shadow-sm active:scale-95"
                                 >
                                    <Eye className="size-3.5 lg:size-4" />
                                 </button>
                                <button 
                                  onClick={async () => {
                                    try {
                                      const res = await api.patch(`/admin/logistics/firms/${f._id}/verify`);
                                      if (res.data.success) {
                                        toast.success(res.data.message);
                                        fetchLogistics();
                                      }
                                    } catch (err) {
                                      toast.error("Handshake failed.");
                                    }
                                  }}
                                  className={`px-3 lg:px-4 py-1.5 lg:py-2 rounded-xl text-[8px] lg:text-[9px] font-black uppercase tracking-widest transition-all shadow-sm active:scale-95 ${f.is_verified ? 'bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white' : 'bg-[var(--accent)] text-white hover:opacity-90'}`}
                                >
                                   {f.is_verified ? 'De-verify' : 'Verify'}
                                </button>
                              </div>
                           </td>
                       </tr>
                     )) : zones.map(z => (
                        <tr key={z._id} className="hover:bg-[var(--accent)]/5 transition-colors group">
                           <td className="px-6 lg:px-8 py-4 lg:py-5 text-xs lg:text-sm font-black uppercase tracking-tight font-mono">{z.name}</td>
                           <td className="px-4 lg:px-6 py-4 lg:py-5"><span className="px-2 py-0.5 rounded bg-[var(--bg-secondary)] text-[var(--text-secondary)] text-[7px] lg:text-[8px] font-bold uppercase border border-[var(--glass-border)]/20">{z.type}</span></td>
                           <td className="px-4 lg:px-6 py-4 lg:py-5 text-[10px] lg:text-xs font-bold text-[var(--text-secondary)] uppercase tracking-tight">{z.parent_id?.name || 'ROOT'}</td>
                           <td className="px-4 lg:px-6 py-4 lg:py-5 text-[8px] lg:text-[10px] font-black uppercase text-emerald-500 tracking-widest flex items-center gap-1.5">
                              <div className="size-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)] animate-pulse" />
                              Active Node
                           </td>
                           <td className="px-6 lg:px-8 py-4 lg:py-5 text-right whitespace-nowrap">
                              <button className="px-3 lg:px-4 py-1.5 lg:py-2 rounded-lg border border-[var(--glass-border)] hover:bg-rose-500 hover:text-white transition-all text-[8px] lg:text-[10px] font-black uppercase tracking-widest shadow-sm active:scale-95 text-rose-500">Delete</button>
                           </td>
                        </tr>
                     ))}
                     {((activeTab === 'Shipments' && shipments.length === 0) || (activeTab === 'Delivery Partners' && firms.length === 0) || (activeTab === 'Zones' && zones.length === 0)) && !loading && (
                       <tr>
                          <td colSpan={5} className="px-8 py-20 lg:py-32 text-center">
                             <div className="flex flex-col items-center gap-4 lg:gap-6 opacity-20">
                                <Truck className="size-10 lg:size-16" />
                                <p className="text-[9px] lg:text-[11px] font-black uppercase tracking-widest leading-relaxed">System scan complete.<br/>Transit records clear.</p>
                             </div>
                          </td>
                       </tr>
                     )}
                  </tbody>
               </table>
            </div>
         </div>

          {activeTab === 'Zones' && (
             <div className="glass-panel p-6 lg:p-10 rounded-[28px] lg:rounded-[40px] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 max-w-xl mx-auto shadow-2xl relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
                  <MapPin className="size-32 lg:size-48" />
               </div>
               <h3 className="text-xs lg:text-sm font-black uppercase tracking-[0.2em] mb-6 lg:mb-8 text-[var(--accent)] flex items-center gap-3">
                  <div className="h-4 lg:h-5 w-1 bg-[var(--accent)] rounded-full" />
                  Provision New Zone
               </h3>
               <form className="space-y-4 lg:space-y-5 relative z-10" onSubmit={async (e) => {
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
                     <label className="text-[8px] lg:text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] ml-1">Zone Identifier</label>
                     <input 
                        placeholder="e.g. Akwa, Douala V"
                        value={newZone.name}
                        onChange={e => setNewZone({...newZone, name: e.target.value})}
                        className="w-full p-3.5 lg:p-4 rounded-xl bg-[var(--bg-secondary)]/50 border border-[var(--glass-border)] text-xs font-bold outline-none focus:border-[var(--accent)] transition-all shadow-inner uppercase tracking-tight"
                     />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <label className="text-[8px] lg:text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] ml-1">Topology Type</label>
                        <select 
                           value={newZone.type}
                           onChange={e => setNewZone({...newZone, type: e.target.value, parent_id: ''})}
                           className="w-full p-3.5 lg:p-4 rounded-xl bg-[var(--bg-secondary)]/50 border border-[var(--glass-border)] text-xs font-bold outline-none cursor-pointer focus:border-[var(--accent)] transition-all uppercase tracking-tight"
                        >
                           <option value="region">Region / City</option>
                           <option value="quartier">Quartier (Sub)</option>
                        </select>
                     </div>
                     {newZone.type === 'quartier' && (
                        <div className="space-y-2">
                           <label className="text-[8px] lg:text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] ml-1">Parent Cluster</label>
                           <select 
                              value={newZone.parent_id}
                              onChange={e => setNewZone({...newZone, parent_id: e.target.value})}
                              className="w-full p-3.5 lg:p-4 rounded-xl bg-[var(--bg-secondary)]/50 border border-[var(--glass-border)] text-xs font-bold outline-none cursor-pointer focus:border-[var(--accent)] transition-all uppercase tracking-tight"
                           >
                              <option value="">Select Region</option>
                              {zones.filter(z => z.type === 'region').map(z => (
                                 <option key={z._id} value={z._id}>{z.name}</option>
                              ))}
                           </select>
                        </div>
                     )}
                  </div>
                  <button className="w-full py-4 lg:py-5 bg-[var(--accent)] text-white rounded-xl lg:rounded-2xl font-black text-[9px] lg:text-[10px] tracking-widest uppercase shadow-lg shadow-[var(--accent)]/30 hover:shadow-[var(--accent)]/50 hover:-translate-y-0.5 transition-all active:scale-95 disabled:opacity-30 mt-2">
                     Sync Repository
                  </button>
               </form>
             </div>
          )}
      </div>

      {/* Firm Detail / Pricing Modal */}
      {selectedFirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 lg:p-6">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={() => setSelectedFirm(null)} />
          <div className="max-w-4xl w-full glass-panel rounded-[32px] lg:rounded-[48px] border border-[var(--glass-border)] bg-[var(--bg-primary)]/90 backdrop-blur-3xl p-6 lg:p-12 relative z-10 animate-in fade-in zoom-in-95 duration-500 flex flex-col max-h-[90vh] shadow-[0_0_80px_rgba(0,0,0,0.5)]">
             <div className="flex items-start justify-between mb-8 lg:mb-10 shrink-0">
                <div className="flex items-center gap-4 lg:gap-6">
                   <div className="size-14 lg:size-16 rounded-[20px] lg:rounded-[24px] bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center font-black border border-[var(--accent)]/20 text-xl lg:text-2xl shadow-lg relative overflow-hidden">
                      {selectedFirm.user_id?.branding?.logo ? <img src={selectedFirm.user_id.branding.logo} className="size-full object-cover" /> : selectedFirm.company_name[0].toUpperCase()}
                      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent" />
                   </div>
                   <div>
                      <h3 className="text-xl lg:text-3xl font-black tracking-tight uppercase leading-tight">{selectedFirm.company_name}</h3>
                      <p className="text-[9px] lg:text-[11px] font-black text-[var(--accent)] tracking-[0.3em] uppercase opacity-70">Grid Pricing Matrix</p>
                   </div>
                </div>
                <button onClick={() => setSelectedFirm(null)} className="size-10 lg:size-12 rounded-xl lg:rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all text-[8px] font-black tracking-widest uppercase shadow-sm active:scale-90">
                   ESC
                </button>
             </div>

             <div className="flex-1 overflow-y-auto no-scrollbar pr-1 lg:pr-2">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
                   <div className="space-y-6 lg:space-y-8">
                      <h4 className="text-[10px] lg:text-xs font-black uppercase tracking-[0.25em] opacity-40 ml-1 border-l-2 border-[var(--accent)] pl-3">Update Price Point</h4>
                      <div className="space-y-4 lg:space-y-5">
                         <div className="space-y-2">
                            <label className="text-[8px] font-black uppercase tracking-widest text-[var(--text-secondary)] ml-1">Quartier Descriptor</label>
                            <select 
                              value={priceEditor.quartier}
                              onChange={e => setPriceEditor({...priceEditor, quartier: e.target.value})}
                              className="w-full p-3.5 lg:p-4 rounded-xl lg:rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--glass-border)] text-xs font-bold outline-none cursor-pointer focus:border-[var(--accent)] transition-all uppercase tracking-tight shadow-sm"
                            >
                               <option value="">Select Node</option>
                               {zones.filter(z => z.type === 'quartier').map(z => (
                                  <option key={z._id} value={z.name}>{z.name}</option>
                               ))}
                            </select>
                         </div>
                         <div className="space-y-2">
                            <label className="text-[8px] font-black uppercase tracking-widest text-[var(--text-secondary)] ml-1">Tariff (XAF)</label>
                            <div className="relative">
                               <input 
                                  type="number"
                                  placeholder="0.00"
                                  value={priceEditor.price}
                                  onChange={e => setPriceEditor({...priceEditor, price: e.target.value})}
                                  className="w-full p-3.5 lg:p-4 rounded-xl lg:rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--glass-border)] text-xs lg:text-sm font-black outline-none focus:border-[var(--accent)] transition-all shadow-inner font-mono pl-12"
                               />
                               <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-[var(--accent)] opacity-50" />
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
                           className="w-full py-4 lg:py-5 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-xl lg:rounded-2xl font-black text-[9px] lg:text-[10px] tracking-[0.2em] uppercase disabled:opacity-30 shadow-xl hover:-translate-y-0.5 transition-all active:scale-95"
                         >
                            Commute Update
                         </button>
                      </div>
                   </div>

                   <div className="space-y-6 lg:space-y-8 pt-6 lg:pt-0 border-t lg:border-t-0 border-[var(--glass-border)]/20">
                      <h4 className="text-[10px] lg:text-xs font-black uppercase tracking-[0.25em] opacity-40 ml-1 border-l-2 border-emerald-500 pl-3">Active Pricing Matrix</h4>
                      <div className="space-y-2 lg:space-y-3 max-h-[300px] lg:max-h-[400px] overflow-y-auto no-scrollbar pb-10">
                         {(selectedFirm.quartier_prices || []).map(p => (
                            <div key={p.quartier} className="flex justify-between items-center p-3.5 lg:p-4 rounded-xl lg:rounded-2xl bg-[var(--bg-secondary)]/30 border border-[var(--glass-border)]/50 hover:bg-[var(--accent)]/5 hover:border-[var(--accent)]/30 transition-all group/item shadow-sm">
                               <span className="text-[10px] lg:text-xs font-black uppercase truncate mr-4 tracking-tight text-[var(--text-primary)]">{p.quartier}</span>
                               <span className="text-xs lg:text-sm font-mono font-black text-[var(--accent)] group-hover/item:scale-110 transition-transform">{p.price.toLocaleString()} <span className="text-[8px] opacity-40">XAF</span></span>
                            </div>
                         ))}
                         {(!selectedFirm.quartier_prices || selectedFirm.quartier_prices.length === 0) && (
                            <div className="py-16 flex flex-col items-center gap-4 opacity-20 border-2 border-dashed border-[var(--glass-border)] rounded-[32px]">
                               <Scale className="size-10" />
                               <p className="text-[9px] font-black italic uppercase tracking-widest text-center px-6">Matrix void.<br/>System ready for provisioning.</p>
                            </div>
                         )}
                      </div>
                   </div>
                </div>
             </div>
          </div>
        </div>
      )}

      {selectedShipment && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSelectedShipment(null)} />
          <div className="relative z-10 w-full max-w-2xl rounded-[28px] border border-[var(--glass-border)] bg-[var(--bg-primary)] p-6 lg:p-8">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-sm lg:text-base font-black uppercase tracking-widest">Edit Shipment Package</h3>
              <button onClick={() => setSelectedShipment(null)} className="px-3 py-1 rounded-lg border border-[var(--glass-border)] text-[10px] font-black uppercase">Close</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input value={shipmentEdit.tracking_code} onChange={(e) => setShipmentEdit((s) => ({ ...s, tracking_code: e.target.value }))} placeholder="Tracking code" className="rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] px-3 py-2 text-xs font-black" />
              <input type="number" value={shipmentEdit.price} onChange={(e) => setShipmentEdit((s) => ({ ...s, price: e.target.value }))} placeholder="Shipping price" className="rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] px-3 py-2 text-xs font-black" />
              <select value={shipmentEdit.status} onChange={(e) => setShipmentEdit((s) => ({ ...s, status: e.target.value }))} className="rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] px-3 py-2 text-xs font-black uppercase">
                <option value="pending">Pending</option>
                <option value="assigned">Assigned</option>
                <option value="picked_up">Picked Up</option>
                <option value="in_transit">In Transit</option>
                <option value="out_for_delivery">Out For Delivery</option>
                <option value="delivered">Delivered</option>
                <option value="failed">Failed</option>
              </select>
              <select value={shipmentEdit.logistics_id} onChange={(e) => setShipmentEdit((s) => ({ ...s, logistics_id: e.target.value }))} className="rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] px-3 py-2 text-xs font-black">
                <option value="">Select logistics firm</option>
                {firms.map((f) => (
                  <option key={f._id} value={f._id}>{f.company_name}</option>
                ))}
              </select>
            </div>
            <textarea rows={3} value={shipmentEdit.note} onChange={(e) => setShipmentEdit((s) => ({ ...s, note: e.target.value }))} placeholder="Admin note" className="mt-3 w-full rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] px-3 py-2 text-xs font-black" />
            <button onClick={saveShipmentEdit} className="mt-4 w-full rounded-xl bg-[var(--accent)] text-white px-4 py-3 text-[10px] font-black uppercase tracking-widest">Save Shipment</button>
          </div>
        </div>
      )}
    </>
  );
}


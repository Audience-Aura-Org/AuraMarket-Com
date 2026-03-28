"use client";

import { useState, useEffect, Suspense } from 'react';
import { Truck, Package, CheckCircle, AlertCircle, Bell, Building, Globe, MapPin, Smartphone, Mail, Loader2, ArrowUpRight } from 'lucide-react';
import { useAuthStore } from '@/hooks/useAuth';
import api from '@/services/api';
import { toast } from 'react-hot-toast';
import { useRouter, useSearchParams } from 'next/navigation';

export const dynamic = 'force-dynamic';

function LogisticsDashboardContent() {
  const { user } = useAuthStore();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [shipments, setShipments] = useState([]);
  const [stats, setStats] = useState([]);
  const [selectedShipment, setSelectedShipment] = useState(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [updateData, setUpdateData] = useState({
    status: '',
    note: '',
    proof_image: '',
    failure_reason: '',
    receiver_name: ''
  });
  const [updating, setUpdating] = useState(false);
  
  // Onboarding Form State
  const [onboarding, setOnboarding] = useState({
    company_name: '',
    contact_email: '',
    contact_phone: '',
    service_regions: '',
    vehicle_types: ['motorcycle', 'car']
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { 
    setMounted(true); 
    fetchProfile();
  }, []);

    const fetchProfile = async () => {
    try {
       const res = await api.get('/logistics/shipments/firm');
       if (res.data.success) {
          const fetchedShipments = res.data.data.shipments;
          setShipments(fetchedShipments);
          setProfile({ verified: true });
          
          // Calculate stats
          const active = fetchedShipments.filter(s => ['assigned', 'picked_up', 'in_transit', 'out_for_delivery'].includes(s.status)).length;
          const pending = fetchedShipments.filter(s => s.status === 'pending').length;
          const delivered24h = fetchedShipments.filter(s => s.status === 'delivered').length; 
          
          setStats([
            { label: 'Active Shipments', value: active.toString(), icon: Truck, color: 'text-indigo-600', bg: 'bg-indigo-500/10' },
            { label: 'Pending Pickups', value: pending.toString(), icon: Package, color: 'text-[var(--accent)]', bg: 'bg-[var(--accent)]/10' },
            { label: 'Delivered Total', value: delivered24h.toString(), icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-500/10' },
            { label: 'Failed Deliveries', value: fetchedShipments.filter(s => s.status === 'failed').length.toString(), icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-500/10' },
          ]);

          // 🚀 DEEP LINK: Auto-open specific shipment if ID provided in URL (for notifications)
          const deepLinkId = searchParams.get('shipmentId');
          if (deepLinkId) {
            const target = fetchedShipments.find(s => s._id === deepLinkId);
            if (target) {
              openUpdateModal(target);
              // Clean up URL to prevent ghost modals on refresh
              router.replace('/logistics/dashboard');
            }
          }
       }
    } catch (err) {
       if (err.response?.status === 403) setProfile(null);
    } finally {
       setLoading(false);
    }
  };

  const handleStatusUpdate = async (e) => {
    e.preventDefault();
    if (!selectedShipment) return;
    setUpdating(true);
    try {
      const res = await api.patch(`/logistics/shipments/${selectedShipment._id}/status`, updateData);
      if (res.data.success) {
        toast.success("Shipment status synchronized.");
        setIsUpdateModalOpen(false);
        fetchProfile();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Status update failed.");
    } finally {
      setUpdating(false);
    }
  };

  const openUpdateModal = (shipment) => {
    setSelectedShipment(shipment);
    setUpdateData({
      status: shipment.status,
      note: '',
      proof_image: '',
      failure_reason: '',
      receiver_name: ''
    });
    setIsUpdateModalOpen(true);
  };

  const handleOnboard = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await api.post('/logistics/onboard', {
        ...onboarding,
        service_regions: onboarding.service_regions.split(',').map(r => r.trim())
      });
      if (res.data.success) {
        toast.success("Onboarding data submitted for review.");
        setProfile({ verified: false });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Onboarding failed.");
    } finally {
      setSubmitting(false);
    }
  };



  if (!mounted) return null;

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-[var(--bg-secondary)]">
       <Loader2 className="size-10 animate-spin text-[var(--accent)]" />
    </div>
  );

  // If no profile, show onboarding
  if (!profile) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4 lg:p-10">
         <div className="max-w-xl w-full space-y-8 lg:space-y-10 animate-in fade-in slide-in-from-bottom-5 duration-700">
            <div className="flex flex-col items-center text-center gap-4">
               <div className="size-16 lg:size-20 rounded-[28px] lg:rounded-[32px] bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center border border-[var(--accent)]/20 shadow-xl">
                  <Truck className="size-8 lg:size-10" />
               </div>
               <h1 className="text-2xl lg:text-4xl font-black tracking-tighter uppercase leading-tight">Initialize <br className="lg:hidden" /> <span className="text-[var(--accent)]">Transit Center</span></h1>
               <p className="text-[var(--text-secondary)] text-[10px] lg:text-sm font-medium leading-relaxed opacity-60 px-4">Complete your logistics profile to begin accepting merchant shipping tickets.</p>
            </div>

            <form onSubmit={handleOnboard} className="glass-panel p-6 lg:p-10 rounded-[32px] lg:rounded-[40px] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
                  <div className="space-y-2">
                     <label className="text-[8px] lg:text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] ml-1">Company Name</label>
                     <div className="relative">
                        <Building className="absolute left-4 top-1/2 -translate-y-1/2 size-3.5 lg:size-4 opacity-20" />
                        <input 
                          required
                          placeholder="Aura Express Ltd"
                          value={onboarding.company_name}
                          onChange={e => setOnboarding({...onboarding, company_name: e.target.value})}
                          className="w-full pl-11 lg:pl-12 pr-6 py-3.5 lg:py-4 rounded-xl lg:rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] focus:border-[var(--accent)] outline-none text-[10px] lg:text-xs font-bold transition-all"
                        />
                     </div>
                  </div>
                  <div className="space-y-2">
                     <label className="text-[8px] lg:text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] ml-1">HQ Region</label>
                     <div className="relative">
                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 size-3.5 lg:size-4 opacity-20" />
                        <input 
                          required
                          placeholder="Douala, Yaoundé..."
                          value={onboarding.service_regions}
                          onChange={e => setOnboarding({...onboarding, service_regions: e.target.value})}
                          className="w-full pl-11 lg:pl-12 pr-6 py-3.5 lg:py-4 rounded-xl lg:rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] focus:border-[var(--accent)] outline-none text-[10px] lg:text-xs font-bold transition-all"
                        />
                     </div>
                  </div>
                  <div className="space-y-2">
                     <label className="text-[8px] lg:text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] ml-1">Contact Phone</label>
                     <div className="relative">
                        <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 size-3.5 lg:size-4 opacity-20" />
                        <input 
                          required
                          placeholder="+237 ..."
                          value={onboarding.contact_phone}
                          onChange={e => setOnboarding({...onboarding, contact_phone: e.target.value})}
                          className="w-full pl-11 lg:pl-12 pr-6 py-3.5 lg:py-4 rounded-xl lg:rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] focus:border-[var(--accent)] outline-none text-[10px] lg:text-xs font-bold transition-all"
                        />
                     </div>
                  </div>
                  <div className="space-y-2">
                     <label className="text-[8px] lg:text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] ml-1">Public Email</label>
                     <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 size-3.5 lg:size-4 opacity-20" />
                        <input 
                          required
                          type="email"
                          placeholder="ops@auraexpress.com"
                          value={onboarding.contact_email}
                          onChange={e => setOnboarding({...onboarding, contact_email: e.target.value})}
                          className="w-full pl-11 lg:pl-12 pr-6 py-3.5 lg:py-4 rounded-xl lg:rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] focus:border-[var(--accent)] outline-none text-[10px] lg:text-xs font-bold transition-all"
                        />
                     </div>
                  </div>
               </div>

               <button 
                disabled={submitting}
                className="w-full py-4 lg:py-5 bg-[var(--accent)] text-white rounded-xl lg:rounded-2xl font-black text-[9px] lg:text-[10px] tracking-[0.3em] uppercase shadow-xl shadow-[var(--accent)]/30 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3"
               >
                 {submitting ? <Loader2 className="size-4 animate-spin" /> : <>Register Logistics Node <Globe className="size-4" /></>}
               </button>
            </form>
         </div>
      </div>
    );
  }

  return (
    <>
      <header className="h-20 lg:h-24 flex flex-col lg:flex-row lg:items-center justify-between px-6 lg:px-10 border-b border-[var(--nav-border)] bg-[var(--nav-bg)] backdrop-blur-2xl shrink-0 z-10 py-4 lg:py-0 gap-4 lg:gap-0 text-[var(--nav-text)]">
        <div className="flex items-center gap-4 lg:gap-6">
          <h2 className="text-lg lg:text-2xl font-black text-[var(--text-primary)] tracking-tighter uppercase">Transit <span className="text-[var(--accent)]">Control</span></h2>
          <div className="hidden sm:block h-6 w-px bg-[var(--glass-border)] opacity-30" />
          <p className="text-[var(--text-secondary)] text-[8px] lg:text-[10px] font-black tracking-[0.3em] uppercase opacity-60">Ops Window: <span className="text-[var(--text-primary)]">{user?.name || 'Logistics Prime'}</span></p>
        </div>
        <div className="flex items-center gap-4 lg:gap-6 self-end lg:self-auto">
          <button className="size-10 lg:size-12 rounded-xl lg:rounded-2xl glass-panel flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent)] transition-all relative border border-[var(--glass-border)] group">
            <Bell className="size-4 lg:size-5 group-hover:scale-110 transition-transform" />
            <span className="absolute top-3 right-3 size-2 bg-indigo-600 rounded-full border border-[var(--bg-primary)] shadow-[0_0_8px_rgba(79,70,229,0.5)]" />
          </button>
          <div className="flex items-center gap-3 lg:gap-5 lg:pl-6 lg:border-l border-[var(--glass-border)]/30">
            <div className="size-10 lg:size-12 rounded-xl lg:rounded-2xl border border-indigo-600/30 bg-gradient-to-tr from-indigo-600/20 to-purple-500/10 flex items-center justify-center font-black text-indigo-600 shadow-sm hover:rotate-6 transition-transform text-xs lg:text-base">
              {user?.name?.[0]?.toUpperCase() || 'L'}
            </div>
          </div>
        </div>
      </header>

        <div className="p-4 lg:p-10 space-y-6 lg:space-y-10 pb-32">
          {/* Stats Grid Matrix */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6">
            {stats.map((stat) => (
              <div key={stat.label} className="glass-panel p-4 lg:p-6 rounded-[24px] lg:rounded-[32px] hover:-translate-y-1 transition-all duration-500 border border-[var(--glass-border)] bg-[var(--bg-primary)]/50 group shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <div className={`size-8 lg:size-12 rounded-xl flex items-center justify-center ${stat.bg} ${stat.color} shadow-inner`}>
                    <stat.icon className="size-4 lg:size-6 group-hover:scale-110 transition-transform" />
                  </div>
                </div>
                <p className="text-[var(--text-secondary)] text-[7px] lg:text-[9px] font-black tracking-widest uppercase opacity-40 mb-1 leading-none">{stat.label}</p>
                <h3 className="text-sm lg:text-2xl font-black text-[var(--text-primary)] tracking-tight font-mono">{stat.value}</h3>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            {/* Manifest List */}
            <div className="lg:col-span-2 glass-panel rounded-[24px] p-6 border border-[var(--glass-border)] bg-[var(--bg-primary)]/50 overflow-hidden shadow-sm relative group">
              <div className="absolute top-0 right-0 size-64 bg-indigo-600/5 rounded-full blur-[100px] pointer-events-none" />
              <div className="flex justify-between items-center mb-6 relative z-10">
                <h3 className="text-sm font-black text-[var(--text-primary)] tracking-tight uppercase">Active Transmissions</h3>
                <button className="text-indigo-600 text-[8px] font-black tracking-widest hover:underline uppercase">Full Grid Scan</button>
              </div>
              <div className="space-y-6 relative z-10">
                {shipments.length === 0 ? (
                  <div className="p-10 text-center opacity-30">
                     <p className="text-[10px] font-black uppercase tracking-widest">No active transmissions detected</p>
                  </div>
                ) : shipments.map(s => (
                  <div key={s._id} onClick={() => openUpdateModal(s)} className="flex items-center justify-between p-4 rounded-[20px] bg-[var(--bg-secondary)]/30 border border-[var(--glass-border)] group/item hover:border-indigo-500/30 transition-all cursor-pointer hover:bg-[var(--bg-secondary)]/50">
                    <div className="flex items-center gap-4">
                      <div className={`size-10 rounded-xl flex items-center justify-center bg-[var(--bg-primary)]/80 shadow-inner border border-[var(--glass-border)] shadow-sm group-hover/item:scale-110 transition-transform ${
                        ['in_transit', 'out_for_delivery'].includes(s.status) ? 'text-indigo-600' : s.status === 'pending' ? 'text-[var(--accent)]' : 'text-emerald-600'
                      }`}>
                        <Truck className="size-5" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-[var(--text-primary)] tracking-tight">{s.tracking_code}</p>
                        <p className="text-[8px] font-black text-[var(--accent)] uppercase tracking-widest opacity-80">
                          Order #{(s.order_id?._id || s.order_id || '').toString().slice(-8).toUpperCase()}
                        </p>
                        <p className="text-[9px] text-[var(--text-secondary)] mt-1 flex items-center gap-2 font-bold uppercase tracking-widest opacity-60">
                          {s.pickup_address?.quartier || s.pickup_address?.city || 'Pickup'} <span className="material-symbols-outlined text-xs text-indigo-500">trending_flat</span> {s.delivery_address?.quartier || s.delivery_address?.city || 'Delivery'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right hidden sm:block">
                        <p className="text-[8px] text-[var(--text-secondary)] font-black tracking-widest uppercase opacity-40 mb-0.5">Fee</p>
                        <p className="text-[9px] font-black tracking-widest uppercase">{s.price?.toLocaleString()} XAF</p>
                      </div>
                      <span className={`px-4 py-1.5 rounded-full text-[8px] font-black tracking-widest uppercase border shadow-sm ${
                        ['in_transit', 'out_for_delivery'].includes(s.status) ? 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20' :
                        s.status === 'pending' || s.status === 'assigned' ? 'bg-purple-500/10 text-purple-600 border-purple-500/20' :
                        s.status === 'failed' ? 'bg-rose-500/10 text-rose-600 border-rose-500/20' :
                        'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                      }`}>{s.status.replace(/_/g, ' ')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="glass-panel rounded-[48px] p-8 border border-[var(--glass-border)] bg-[var(--bg-primary)]/60 flex flex-col justify-between overflow-hidden shadow-xl relative">
              <div className="absolute bottom-0 right-0 size-48 bg-purple-600/5 rounded-full blur-[80px] pointer-events-none" />
              <div className="relative z-10">
                <h3 className="text-xl font-black text-[var(--text-primary)] mb-10 tracking-tight uppercase">Control Hub</h3>
                <div className="space-y-4">
                  {[
                    { label: 'Shipment Manifests', href: '/logistics/manifests', icon: 'qr_code_scanner', color: 'text-indigo-600', bg: 'bg-indigo-500/10' },
                    { label: 'Live Tracking', href: '/logistics/tracking', icon: 'add_road', color: 'text-purple-600', bg: 'bg-purple-500/10' },
                    { label: 'Relay Nodes', href: '/logistics/nodes', icon: 'travel_explore', color: 'text-emerald-600', bg: 'bg-emerald-500/10' },
                  ].map((action) => (
                    <Link key={action.label} href={action.href} className="w-full p-5 rounded-3xl bg-[var(--bg-primary)]/50 border border-[var(--glass-border)] text-left flex items-center gap-5 hover:bg-[var(--accent)]/5 hover:border-[var(--accent)]/30 transition-all group shadow-sm">
                      <div className={`size-12 rounded-2xl ${action.bg} ${action.color} flex items-center justify-center shadow-inner group-hover:rotate-6 transition-transform`}>
                        <span className="material-symbols-outlined text-2xl">{action.icon}</span>
                      </div>
                      <span className="font-black text-[10px] tracking-[0.2em] text-[var(--text-primary)] uppercase">{action.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
              <div className="mt-12 p-8 rounded-[40px] bg-gradient-to-br from-indigo-600 to-purple-700 shadow-2xl shadow-indigo-500/30 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-125 transition-transform duration-700">
                   <Truck className="size-24 -rotate-12" />
                </div>
                <h4 className="text-white font-black text-[10px] tracking-[0.3em] mb-2 uppercase opacity-80">Network Entropy</h4>
                <div className="flex items-baseline gap-2 mb-6 relative z-10">
                  <span className="text-4xl font-black text-white tracking-tighter">82%</span>
                  <span className="text-indigo-100 text-[10px] font-black uppercase tracking-widest">Saturation</span>
                </div>
                <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden shadow-inner relative z-10">
                  <div className="h-full bg-white w-[82%] shadow-[0_0_15px_rgba(255,255,255,0.5)] transition-all duration-1000" />
                </div>
              </div>
            </div>
          </div>
        </div>
      {/* Status Synchronization Matrix */}
      {isUpdateModalOpen && selectedShipment && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 lg:p-10">
          <div className="absolute inset-0 bg-[var(--bg-secondary)]/80 backdrop-blur-xl" onClick={() => setIsUpdateModalOpen(false)} />
          <div className="max-w-xl w-full glass-panel rounded-[32px] lg:rounded-[56px] border border-[var(--glass-border)] bg-[var(--bg-primary)]/90 backdrop-blur-3xl p-6 lg:p-12 relative z-10 animate-in zoom-in-95 duration-300 shadow-3xl">
             <div className="flex justify-between items-start mb-8 lg:mb-10">
                <div className="space-y-1">
                   <h3 className="text-lg lg:text-3xl font-black tracking-tighter uppercase leading-none">Status <span className="text-[var(--accent)]">Sync</span></h3>
                   <div className="flex items-center gap-3">
                      <span className="text-[8px] lg:text-[10px] font-black text-[var(--accent)] tracking-widest uppercase">{selectedShipment.tracking_code}</span>
                      <span className="size-1 rounded-full bg-[var(--glass-border)]" />
                      <span className="text-[8px] lg:text-[10px] font-black text-[var(--text-secondary)] opacity-40 uppercase">Manifest v2.4</span>
                   </div>
                </div>
                <button onClick={() => setIsUpdateModalOpen(false)} className="size-8 lg:size-12 rounded-xl lg:rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all group">
                   <span className="material-symbols-outlined text-sm lg:text-base group-hover:rotate-90 transition-transform">close</span>
                </button>
             </div>

             <form onSubmit={handleStatusUpdate} className="space-y-4 lg:space-y-6">
                <div className="space-y-2">
                   <label className="text-[8px] lg:text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] ml-1 opacity-50">Transmission State</label>
                   <div className="relative">
                      <select 
                         value={updateData.status}
                         onChange={e => setUpdateData({...updateData, status: e.target.value})}
                         className="w-full px-6 py-4 rounded-xl lg:rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] focus:border-[var(--accent)] outline-none text-[10px] lg:text-xs font-black transition-all appearance-none cursor-pointer uppercase tracking-widest"
                      >
                         <option value="pending">Pending Scan</option>
                         <option value="assigned">Assigned Courier</option>
                         <option value="picked_up">Inbound Success</option>
                         <option value="in_transit">Core Transit</option>
                         <option value="out_for_delivery">Final Leg</option>
                         <option value="delivered">Success (Terminal)</option>
                         <option value="failed">Fault / Returns</option>
                      </select>
                      <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                         <Truck className="size-4" />
                      </div>
                   </div>
                </div>

                {updateData.status === 'delivered' && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-500">
                     <div className="space-y-2">
                        <label className="text-[8px] lg:text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] ml-1 opacity-50">Receiver ID</label>
                        <input 
                           placeholder="Full Name"
                           value={updateData.receiver_name}
                           onChange={e => setUpdateData({...updateData, receiver_name: e.target.value})}
                           className="w-full px-6 py-4 rounded-xl lg:rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] focus:border-[var(--accent)] outline-none text-[10px] lg:text-xs font-black transition-all uppercase tracking-tighter"
                        />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[8px] lg:text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] ml-1 opacity-50">Visual Crypt (URL)</label>
                        <input 
                           placeholder="Proof Image URL"
                           value={updateData.proof_image}
                           onChange={e => setUpdateData({...updateData, proof_image: e.target.value})}
                           className="w-full px-6 py-4 rounded-xl lg:rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] focus:border-[var(--accent)] outline-none text-[10px] lg:text-xs font-black transition-all"
                        />
                     </div>
                  </div>
                )}

                {updateData.status === 'failed' && (
                  <div className="space-y-2 animate-in slide-in-from-top-2 duration-500">
                     <label className="text-[8px] lg:text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] ml-1 opacity-50">Decline Vector</label>
                     <select 
                        value={updateData.failure_reason}
                        onChange={e => setUpdateData({...updateData, failure_reason: e.target.value})}
                        className="w-full px-6 py-4 rounded-xl lg:rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] focus:border-[var(--accent)] outline-none text-[10px] lg:text-xs font-black transition-all appearance-none cursor-pointer uppercase tracking-widest"
                     >
                        <option value="">Select Protocol Error</option>
                        <option value="customer_unreachable">Client Offline</option>
                        <option value="address_incorrect">Node Unknown</option>
                        <option value="rejected_by_customer">Manual Rejection</option>
                        <option value="hazardous_conditions">Signal Interference</option>
                        <option value="other">General Fault</option>
                     </select>
                  </div>
                )}

                <div className="space-y-2">
                   <label className="text-[8px] lg:text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] ml-1 opacity-50">Operational Notes</label>
                   <textarea 
                      rows={3}
                      placeholder="Enter status telemetry..."
                      value={updateData.note}
                      onChange={e => setUpdateData({...updateData, note: e.target.value})}
                      className="w-full px-6 py-4 rounded-xl lg:rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] focus:border-[var(--accent)] outline-none text-[10px] lg:text-xs font-black transition-all resize-none shadow-inner"
                   />
                </div>

                <button 
                  disabled={updating}
                  className="w-full py-4 lg:py-6 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-xl lg:rounded-[24px] font-black text-[10px] lg:text-xs tracking-[0.4em] uppercase shadow-2xl hover:bg-[var(--accent)] hover:text-white hover:-translate-y-1 active:translate-y-0 transition-all flex items-center justify-center gap-4 disabled:opacity-50"
                >
                  {updating ? <Loader2 className="size-5 animate-spin" /> : <>Commit Manifest Update <ArrowUpRight className="size-5" /></>}
                </button>
             </form>
          </div>
        </div>
      )}
    </>
  );
}

export default function LogisticsDashboard() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-[var(--bg-secondary)]">
        <Loader2 className="size-10 animate-spin text-[var(--accent)]" />
      </div>
    }>
      <LogisticsDashboardContent />
    </Suspense>
  );
}


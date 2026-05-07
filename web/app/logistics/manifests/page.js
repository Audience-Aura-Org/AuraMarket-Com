"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { 
  Loader2, Truck, Search, RefreshCw, 
  CheckCircle2, AlertCircle, Clock, Package,
  MapPin, User
} from "lucide-react";
import api from "@/services/api";
import ShipmentStatusModal from "@/components/logistics/ShipmentStatusModal";
import Pagination from '@/components/common/Pagination';

const STATUS_ICONS = {
  pending:          { icon: Clock,        bg: 'bg-amber-500/10',   color: 'text-amber-500',   label: 'PENDING' },
  assigned:         { icon: Package,      bg: 'bg-purple-500/10',  color: 'text-purple-500',  label: 'ASSIGNED' },
  picked_up:        { icon: Package,      bg: 'bg-blue-500/10',    color: 'text-blue-500',    label: 'PICKED UP' },
  in_transit:       { icon: Truck,        bg: 'bg-indigo-500/10',  color: 'text-indigo-400',  label: 'IN TRANSIT' },
  out_for_delivery: { icon: Truck,        bg: 'bg-cyan-500/10',    color: 'text-cyan-400',    label: 'OUT FOR DELIVERY' },
  delivered:        { icon: CheckCircle2, bg: 'bg-emerald-500/10', color: 'text-emerald-500', label: 'DELIVERED' },
  failed:           { icon: AlertCircle,  bg: 'bg-red-500/10',     color: 'text-red-500',     label: 'FAILED' }
};

export default function LogisticsManifestsPage() {
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [shipments, setShipments] = useState([]);
  const [total, setTotal] = useState(0);
  
  const [selectedShipment, setSelectedShipment] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [updateData, setUpdateData] = useState({
    status: "pending",
    note: "",
    proof_image: "",
    failure_reason: "",
    receiver_name: "",
  });

  const fetchShipments = async () => {
    setLoading(true);
    try {
      const params = {
        page: currentPage,
        limit: 20,
        status: statusFilter,
        search
      };
      const res = await api.get("/logistics/shipments/firm", { params });
      if (res.data.success) {
        setShipments(res.data.data.shipments || []);
        setTotalPages(res.data.pages || 1);
        setTotal(res.data.total || 0);
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to load shipments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShipments();
  }, [currentPage, statusFilter]);

  const handleSearch = (e) => {
    if (e.key === 'Enter') {
      setCurrentPage(1);
      fetchShipments();
    }
  };

  const openModal = (shipment) => {
    setSelectedShipment(shipment);
    setUpdateData({
      status: shipment.status || "pending",
      note: shipment.proof_of_delivery?.note || "",
      proof_image: shipment.proof_of_delivery?.image_url || "",
      failure_reason: shipment.failure_reason || "",
      receiver_name: shipment.proof_of_delivery?.receiver_name || "",
    });
    setIsModalOpen(true);
  };

  const handleStatusUpdate = async (e) => {
    e.preventDefault();
    if (!selectedShipment?._id) return;
    setUpdating(true);
    try {
      const res = await api.patch(`/logistics/shipments/${selectedShipment._id}/status`, updateData);
      if (res.data.success) {
        toast.success("Shipment status updated");
        setIsModalOpen(false);
        setSelectedShipment(null);
        fetchShipments();
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "Could not update shipment");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Premium Header matching Admin Transactions */}
      <header className="min-h-20 py-4 flex flex-col md:flex-row md:h-24 items-center justify-between px-4 md:px-10 border-b border-[var(--glass-border)] bg-[var(--bg-primary)]/80 backdrop-blur-xl sticky top-0 md:top-16 z-40 gap-4 md:gap-0">
        <div className="flex items-center gap-4 md:gap-6 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-4">
            <div className="size-10 md:size-12 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] shadow-inner border border-[var(--accent)]/20 shrink-0">
               <Truck className="w-5 h-5 md:w-6 md:h-6" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-bold text-[var(--text-primary)] tracking-tight">Active <span className="text-[var(--accent)]">Manifests</span></h2>
              <div className="flex items-center gap-2 mt-0.5">
                 <div className="size-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
                 <p className="text-[10px] md:text-[11px] lg:text-[12px] font-semibold text-[var(--text-secondary)] tracking-tight opacity-50 capitalize">Live Routing Feed</p>
              </div>
            </div>
          </div>
          <button onClick={fetchShipments} className="md:hidden size-10 rounded-xl border border-[var(--glass-border)] text-[var(--text-secondary)] flex items-center justify-center active:scale-95">
             <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
           <div className="relative flex-1 md:w-64 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-[var(--text-secondary)] opacity-20 group-focus-within:opacity-100 group-focus-within:text-[var(--accent)] transition-all" />
              <input 
                type="text"
                placeholder="Search tracking code..."
                className="w-full h-11 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl pl-11 pr-4 text-[11px] lg:text-[12px]  font-semibold tracking-tight text-[var(--text-primary)] outline-none focus:border-[var(--accent)]/50 transition-all"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={handleSearch}
              />
           </div>

           <div className="flex items-center gap-2 overflow-x-auto no-scrollbar md:hidden">
              {['all', 'pending', 'in_transit', 'delivered', 'failed'].map(s => (
                <button
                  key={s}
                  onClick={() => { setStatusFilter(s); setCurrentPage(1); }}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-semibold tracking-tight transition-all capitalize whitespace-nowrap ${statusFilter === s ? 'bg-[var(--accent)] text-white shadow-lg' : 'bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[var(--text-secondary)]'}`}
                >
                  {s.replace('_', ' ')}
                </button>
              ))}
           </div>
           
           <div className="hidden lg:flex bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl p-1">
              {['all', 'pending', 'assigned', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed'].map(s => (
                <button 
                  key={s}
                  onClick={() => { setStatusFilter(s); setCurrentPage(1); }}
                  className={`px-4 py-1.5 rounded-xl text-[10px] lg:text-[12px]  font-semibold tracking-tight transition-all capitalize ${statusFilter === s ? 'bg-[var(--accent)] text-white shadow-lg' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                >
                  {s.replace('_', ' ')}
                </button>
              ))}
           </div>
           
           <button onClick={fetchShipments} className="hidden md:flex size-11 md:size-12 rounded-2xl border border-[var(--glass-border)] hover:bg-[var(--accent)]/10 text-[var(--text-secondary)] items-center justify-center transition-all shadow-sm active:scale-95">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
           </button>
        </div>
      </header>

      <div className="p-4 md:p-10 space-y-6 md:space-y-8 pb-40">
         {/* Ledger */}
         <div className="glass-panel rounded-[3rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 overflow-hidden shadow-2xl">
            <div className="p-8 border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/30 flex items-center justify-between">
               <h3 className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-primary)] tracking-[0.1em] flex items-center gap-3 capitalize">
                  <MapPin className="w-4 h-4 text-[var(--accent)]" /> 
                  Global Route Assignments
               </h3>
               <p className="text-[10px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] opacity-40 capitalize tracking-widest">{total} Total Tickets</p>
            </div>

            <div className="space-y-4">
               {loading ? (
                  <div className="flex items-center justify-center py-40">
                     <Loader2 className="size-8 animate-spin text-[var(--accent)] opacity-50" />
                  </div>
               ) : shipments.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4 p-3 md:p-6 lg:p-10">
                    {shipments.map(shipment => {
                      const status = STATUS_ICONS[shipment.status] || STATUS_ICONS.pending;
                      const Icon = status.icon;
                      
                      return (
                        <div 
                          key={shipment._id} 
                          onClick={() => openModal(shipment)}
                          className={`group relative rounded-[2.5rem] bg-[var(--bg-primary)]/40 border border-[var(--glass-border)] shadow-sm hover:shadow-2xl transition-all duration-500 overflow-hidden hover:-translate-y-1 backdrop-blur-xl flex flex-col cursor-pointer`}
                        >
                          <div className="p-4 md:p-6 lg:p-8 flex items-center gap-4 md:gap-6 lg:gap-8">
                              <div className={`size-12 md:size-14 rounded-[1.5rem] ${status.bg} ${status.color} flex items-center justify-center shrink-0 border ${status.color.replace('text-', 'border-')}/10 shadow-inner`}>
                                 <Icon className="w-6 h-6 md:w-7 md:h-7" />
                              </div>

                              <div className="flex-1 min-w-0">
                                 {/* Route + status row */}
                                 <div className="flex flex-wrap items-start justify-between gap-y-2 gap-x-3 mb-2">
                                    <span className="text-[12px] md:text-[13px] font-semibold text-[var(--text-primary)] tracking-tight capitalize leading-tight">
                                       {(shipment.pickup_address?.quartier || shipment.pickup_address?.city || "Pickup")}
                                       <span className="mx-2 text-[var(--accent)] opacity-50">→</span>
                                       {(shipment.delivery_address?.quartier || shipment.delivery_address?.city || "Delivery")}
                                    </span>
                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wider border shrink-0 ${status.bg} ${status.color} ${status.color.replace('text-', 'border-')}/20 capitalize`}>
                                       {status.label}
                                    </span>
                                 </div>
                                 {/* Tracking + date */}
                                 <div className="flex items-center gap-3 flex-wrap">
                                    <span className="font-mono text-[var(--accent)] font-bold text-[11px]">#{shipment.tracking_code}</span>
                                    <span className="text-[var(--text-secondary)] opacity-30 text-[10px]">•</span>
                                    <time className="text-[10px] font-semibold text-[var(--text-secondary)] opacity-40 flex items-center gap-1">
                                       <Clock className="w-3 h-3" /> {new Date(shipment.createdAt).toLocaleDateString()}
                                    </time>
                                    <span className="hidden md:block truncate max-w-[200px] lg:max-w-md text-[10px] font-medium text-[var(--text-secondary)] opacity-50">{shipment.delivery_address?.street || shipment.delivery_address?.description}</span>
                                 </div>
                              </div>

                              <div className="text-right shrink-0">
                                 <p className="text-xl md:text-2xl  font-bold tabular-nums text-[var(--text-primary)] tracking-tighter">{(shipment.price || 0).toLocaleString()} <span className="text-[10px] lg:text-[12px] md:text-[12px] opacity-30 ml-1">XAF</span></p>
                                 <div className="flex items-center justify-end gap-3 mt-2">
                                    <span className="text-[10px] lg:text-[12px] md:text-[10px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] opacity-40 capitalize tracking-widest">{shipment.vendor_id?.store_name || 'Vendor'}</span>
                                    <div className="size-6 rounded-lg overflow-hidden bg-[var(--bg-secondary)] border border-[var(--glass-border)] shadow-sm">
                                       {shipment.vendor_id?.branding?.logo ? <img src={shipment.vendor_id.branding.logo} className="size-full object-cover" /> : <User className="size-full p-1 opacity-20" />}
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
                     <Truck className="w-16 h-16 mb-8 text-[var(--text-secondary)]" />
                     <p className="text-sm  font-bold tracking-[0.2em] capitalize leading-relaxed max-w-sm">No logistics manifests matching criteria.</p>
                  </div>
               )}
            </div>

            {totalPages > 1 && (
              <div className="p-8 border-t border-[var(--glass-border)] bg-[var(--bg-secondary)]/10">
                 <Pagination 
                     currentPage={currentPage}
                     totalPages={totalPages}
                     onPageChange={setCurrentPage}
                 />
              </div>
            )}
         </div>
      </div>

      <ShipmentStatusModal
        open={isModalOpen}
        shipment={selectedShipment}
        updateData={updateData}
        setUpdateData={setUpdateData}
        updating={updating}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleStatusUpdate}
      />
    </div>
  );
}

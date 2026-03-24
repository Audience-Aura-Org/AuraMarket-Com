"use client";

import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Loader2 } from "lucide-react";
import api from "@/services/api";
import ShipmentList from "@/components/logistics/ShipmentList";
import ShipmentStatusModal from "@/components/logistics/ShipmentStatusModal";

export const dynamic = "force-dynamic";

export default function LogisticsManifestsPage() {
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [shipments, setShipments] = useState([]);
  const [selectedShipment, setSelectedShipment] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
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
      const res = await api.get("/logistics/shipments/firm");
      if (res.data.success) {
        setShipments(res.data.data.shipments || []);
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to load shipments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShipments();
  }, []);

  const openModal = (shipment) => {
    setSelectedShipment(shipment);
    setUpdateData({
      status: shipment.status || "pending",
      note: "",
      proof_image: "",
      failure_reason: "",
      receiver_name: "",
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
    <div className="p-4 lg:p-10 space-y-6">
      <div>
        <h1 className="text-lg lg:text-2xl font-black uppercase tracking-tight">Shipment Manifests</h1>
        <p className="text-[10px] lg:text-xs font-bold uppercase tracking-wider opacity-60">
          Assigned tickets for your logistics company
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 animate-spin text-[var(--accent)]" />
        </div>
      ) : (
        <ShipmentList shipments={shipments} onSelectShipment={openModal} />
      )}

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

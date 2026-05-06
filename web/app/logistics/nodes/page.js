"use client";

export const dynamic = 'force-dynamic';

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import api from "@/services/api";
import { toast } from "react-hot-toast";
import Link from "next/link";

import Pagination from '@/components/common/Pagination';

export default function LogisticsNodesPage() {
  const [loading, setLoading] = useState(true);
  const [firm, setFirm] = useState(null);
  const [zones, setZones] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [profileRes, zonesRes] = await Promise.all([
          api.get("/logistics/profile"),
          api.get("/logistics/zones"),
        ]);
        if (profileRes.data.success) setFirm(profileRes.data.data.firm);
        if (zonesRes.data.success) setZones(zonesRes.data.data.zones || []);
      } catch (err) {
        toast.error("Failed to load relay nodes");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const totalPages = Math.ceil(zones.length / itemsPerPage);
  const currentZones = zones.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-[var(--accent)]" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-10 space-y-6">
      <div>
        <h1 className="text-lg lg:text-2xl  font-bold tracking-tight">Relay Nodes</h1>
        <p className="text-[10px] lg:text-[12px] lg:text-xs  font-semibold tracking-tight opacity-60">
          Company profile, zone coverage and pricing status
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 p-4 lg:col-span-2">
          <p className="text-[11px] lg:text-[12px]  font-semibold tracking-tight opacity-50">Logistics Company</p>
          <p className="text-lg  font-bold">{firm?.company_name || "Not onboarded"}</p>
          <p className="text-xs  font-bold opacity-70">{firm?.contact_email || "-"}</p>
          <p className="text-xs  font-bold opacity-70">{firm?.contact_phone || "-"}</p>
          <p className="mt-2 text-[11px] lg:text-[12px]  font-semibold ">
            Verification: {firm?.is_verified ? "Verified" : "Pending"}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 p-4">
          <p className="text-[11px] lg:text-[12px]  font-semibold tracking-tight opacity-50">Pricing Coverage</p>
          <p className="text-2xl  font-bold">{firm?.quartier_prices?.length || 0}</p>
          <p className="text-[11px] lg:text-[12px]  font-semibold  opacity-60">Configured quartiers</p>
          <Link href="/logistics/pricing" className="mt-4 inline-block rounded-lg bg-[var(--text-primary)] px-3 py-2 text-[11px] lg:text-[12px]  font-semibold  text-[var(--bg-primary)]">
            Manage pricing
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 p-4 lg:p-6">
        <div className="flex items-center justify-between mb-6">
           <p className="text-[11px] lg:text-[12px]  font-semibold tracking-tight opacity-60">Available towns and quartiers</p>
           <p className="text-[11px] lg:text-[12px]  font-semibold opacity-40 tracking-tight">{zones.length} Total Signals</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 min-h-[200px]">
          {currentZones.map((z) => (
            <div key={z._id} className="rounded-lg border border-[var(--glass-border)] px-3 py-2 hover:bg-[var(--accent)]/5 transition-colors">
              <p className="text-xs  font-bold ">{z.name}</p>
              <p className="text-[11px] lg:text-[12px]  font-semibold opacity-60 ">{z.type}</p>
            </div>
          ))}
          {!zones.length && <p className="text-[11px] lg:text-[12px]  font-semibold  opacity-40">No zones found</p>}
        </div>

        <div className="mt-8 pt-6 border-t border-[var(--glass-border)]/50">
           <Pagination 
             currentPage={currentPage}
             totalPages={totalPages}
             onPageChange={setCurrentPage}
           />
        </div>
      </div>
    </div>
  );
}

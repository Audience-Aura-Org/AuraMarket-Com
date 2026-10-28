"use client";
/**
 * "Share tracking link" for an agency's shipment: creates a fresh secure link
 * (the previous one stops working) and offers WhatsApp share + copy.
 */
import { useState } from "react";
import { Copy, Link2, Loader2, MessageCircle } from "lucide-react";
import { toast } from "react-hot-toast";
import api from "@/services/api";
import { useFeatureFlag } from "@/lib/featureFlags";

const FINISHED = ["delivered", "failed", "cancelled"];

export default function ShareTrackingLink({ shipment }) {
  const enabled = useFeatureFlag("tracking_links");
  const [share, setShare] = useState(null);
  const [busy, setBusy] = useState(false);
  if (!enabled || !shipment?._id) return null;

  const create = async () => {
    setBusy(true);
    try {
      const res = await api.post(`/logistics/shipments/${shipment._id}/tracking-link`);
      setShare(res.data.data);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Could not create a tracking link.");
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(share.tracking_link); toast.success("Link copied."); } catch { toast.error("Copy failed — select the link instead."); }
  };

  if (!share) {
    return (
      <button type="button" onClick={create} disabled={busy || FINISHED.includes(shipment.status)} className="mx-4 mt-3 inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)] px-4 text-[12px] font-semibold text-[var(--text-primary)] hover:border-[#128C7E]/50 disabled:opacity-50 md:mx-8">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4 text-[#128C7E]" />} Share tracking link
      </button>
    );
  }
  return (
    <div className="mx-4 mt-3 space-y-2 rounded-2xl border border-[#128C7E]/30 bg-[#128C7E]/5 p-3 md:mx-8">
      <div className="flex gap-2">
        <input readOnly value={share.tracking_link} aria-label="Tracking link" onFocus={(e) => e.target.select()} className="min-h-10 min-w-0 flex-1 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] px-3 text-[12px] text-[var(--text-primary)] outline-none" />
        <button type="button" onClick={copy} aria-label="Copy link" className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)]"><Copy className="size-4" /></button>
        <a href={share.whatsapp_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl bg-[#128C7E] px-3 text-[12px] font-semibold text-white"><MessageCircle className="size-4" /> WhatsApp</a>
      </div>
      <p className="text-[10px] text-[var(--text-secondary)]">Older links for this delivery no longer work. This one stops 3 days after delivery.</p>
    </div>
  );
}

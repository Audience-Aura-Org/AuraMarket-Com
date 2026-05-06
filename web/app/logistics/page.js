"use client";

import { useEffect, useState } from 'react';
import { 
  Truck, Globe, Package, Target, 
  MapPin, RefreshCw, Zap, TrendingUp, Activity, ArrowRight, Loader2
} from 'lucide-react';
import Link from 'next/link';

export default function GlobalLogisticsPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)] py-12 px-6 md:px-12 transition-all duration-300">
      <div className="max-w-4xl mx-auto space-y-12">
        
        {/* Header Section (Slim) */}
        <div className="flex flex-col md:flex-row md:items-end justify-between items-start gap-4">
           <div className="space-y-4">
              <div className="flex items-center gap-2 text-[var(--accent)] bg-white/5 px-3 py-1 rounded-full border border-white/10 w-fit">
                 <Activity className="size-3 animate-pulse" />
                 <span className="text-[11px] lg:text-[12px]  font-semibold  tracking-[0.4em]">Fulfillment Sync</span>
              </div>
              <h1 className="text-4xl  font-bold text-[var(--text-primary)] tracking-tighter  leading-[0.85]">
                 Unified <span className="text-[var(--accent)]">Transit</span>
              </h1>
              <p className="text-xs font-medium text-[var(--text-secondary)] max-w-sm opacity-40 leading-relaxed">
                 Real-time operational telemetry for global fulfillment and cross-border settlement.
              </p>
           </div>
           <div className="flex gap-2">
              <Link href="/logistics/tracking" className="h-10 px-6 bg-[var(--accent)] text-white rounded-xl text-[11px] lg:text-[12px]  font-semibold tracking-tight flex items-center gap-3 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-[var(--accent)]/10">
                 Track Signal <RefreshCw className="size-3" />
              </Link>
              <Link href="/logistics/dashboard" className="h-10 px-6 bg-white/5 border border-white/10 rounded-xl text-[11px] lg:text-[12px]  font-semibold tracking-tight flex items-center gap-2 hover:bg-white/10 transition-all text-[var(--text-primary)]">
                 Dashboard
              </Link>
           </div>
        </div>

        {/* Global Operational Snapshot (Slim) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
           {[
              { label: 'Latency', value: '3.4d', icon: Zap },
              { label: 'Active Flows', value: '1,240', icon: TrendingUp },
              { label: 'Node Uptime', value: '99.9%', icon: Activity },
              { label: 'Regions', value: '184', icon: Globe }
           ].map(stat => (
              <div key={stat.label} className="p-5 rounded-2xl bg-[var(--bg-primary)]/40 border border-[var(--glass-border)] flex flex-col gap-4 group">
                 <div className="size-8 rounded-lg bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--accent)] group-hover:scale-110 transition-transform">
                    <stat.icon className="size-4" />
                 </div>
                 <div>
                    <h4 className="text-[11px] lg:text-[12px]  font-semibold tracking-tight text-[var(--text-secondary)] opacity-40 ">{stat.label}</h4>
                    <p className="text-xl  font-bold text-[var(--text-primary)] tracking-tight">{stat.value}</p>
                 </div>
              </div>
           ))}
        </div>

        {/* Unified Supply Chain (Slim Segment) */}
        <div className="p-8 rounded-[2.5rem] bg-[var(--bg-primary)] border border-[var(--glass-border)] relative overflow-hidden group">
           <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--accent)]/5 blur-2xl rounded-full translate-x-12 -translate-y-12" />
           <div className="space-y-8 relative z-10">
              <div className="space-y-2">
                 <h2 className="text-xl  font-bold text-[var(--text-primary)] tracking-tight">Active Transmit Nodes</h2>
                 <p className="text-[10px] lg:text-[12px] font-medium text-[var(--text-secondary)] opacity-40 tracking-tight">Real-time settlement mapping</p>
              </div>
              
              <div className="space-y-2">
                 {[
                    { node: 'Node_AF-7', status: 'In Transit', progress: 84 },
                    { node: 'Node_EU-4', status: 'Processing', progress: 12 },
                    { node: 'Node_US-9', status: 'Delivered', progress: 100 }
                 ].map(item => (
                    <div key={item.node} className="p-4 rounded-xl bg-[var(--bg-secondary)]/50 border border-[var(--glass-border)] flex items-center justify-between gap-6 hover:bg-[var(--bg-secondary)] transition-all">
                       <p className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-primary)] opacity-60 ">{item.node}</p>
                       <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-[var(--accent)] transition-all duration-1000" style={{ width: `${item.progress}%` }} />
                       </div>
                       <p className="text-[11px] lg:text-[12px]  font-semibold text-[var(--accent)] tracking-tight w-20 text-right">{item.status}</p>
                    </div>
                 ))}
              </div>
           </div>
        </div>

        {/* Global Registry Footer */}
        <div className="pt-12 text-center opacity-30">
           <p className="text-[11px] lg:text-[12px]  font-semibold tracking-[0.5em] text-[var(--text-secondary)] ">
              Aura Logistics Dispatch // Unified Fulfillment Systems v4.0
           </p>
        </div>

      </div>
    </div>
  );
}

"use client";

import { Activity, ShieldCheck, Zap, Globe, Package, Database, Server, RefreshCw, CheckCircle, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

const NODES = [
  { name: 'Core API Gateway', status: 'operational', region: 'Global-Alpha', latency: '24ms' },
  { name: 'Database Clusters', status: 'operational', region: 'Global-Beta', latency: '12ms' },
  { name: 'Image Compression Node', status: 'operational', region: 'Global-Gamma', latency: '142ms' },
  { name: 'Push Delivery System', status: 'operational', region: 'Global-Delta', latency: '48ms' },
  { name: 'Payment Settlement Hub', status: 'operational', region: 'Global-Epsilon', latency: '310ms' },
  { name: 'Logistics Tracking Mesh', status: 'operational', region: 'Global-Zeta', latency: '18ms' }
];

export default function NetworkStatusPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => setMounted(true), []);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 2000);
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)] py-20 px-6 md:px-12 lg:px-20 transition-colors duration-500 overflow-hidden relative pt-20 md:pt-20">
      
      {/* Background Matrix/Grid */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(var(--accent) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[var(--accent)]/10 blur-[150px] rounded-full -translate-y-1/2 translate-x-1/2 animate-pulse" />

      <div className="max-w-4xl mx-auto relative z-10 space-y-16">
        
        {/* Navigation & Header */}
        <div className="flex flex-col gap-10">
           <button 
             onClick={() => router.back()}
             className="size-14 rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent)] hover:shadow-xl transition-all group"
           >
             <ArrowLeft className="size-6 group-hover:-translate-x-1 transition-transform" />
           </button>
           
           <div className="flex flex-col lg:flex-row items-end justify-between gap-8">
              <div className="space-y-4">
                 <div className="flex items-center gap-3 text-emerald-500 bg-emerald-500/10 w-fit px-4 py-1.5 rounded-full border border-emerald-500/20">
                    <Activity className="size-4 animate-pulse" />
                    <span className="text-[11px] lg:text-[12px]  font-semibold  tracking-[0.4em]">All Systems Nominal</span>
                 </div>
                 <h1 className="text-6xl lg:text-8xl  font-bold text-[var(--text-primary)] tracking-tighter  leading-[0.85]">
                    Network <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--accent)] to-indigo-600">Status</span>
                 </h1>
                 <p className="text-[var(--text-secondary)] font-medium text-lg opacity-60 leading-relaxed max-w-lg">
                    Real-time monitoring of the Auradime global infrastructure. Visualizing live node connectivity and transactional health.
                 </p>
              </div>

              <button 
                onClick={handleRefresh}
                className="h-16 px-10 rounded-[2rem] bg-[var(--bg-primary)] border border-[var(--glass-border)] text-[var(--text-primary)]  font-bold text-xs  tracking-[0.3em] flex items-center gap-4 transition-all hover:bg-white/5 disabled:opacity-50"
                disabled={refreshing}
              >
                {refreshing ? <RefreshCw className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                {refreshing ? 'Synchronizing...' : 'Manual Sync'}
              </button>
           </div>
        </div>

        {/* System Cards */}
        <div className="grid grid-cols-1 gap-6">
           {NODES.map((node, i) => (
              <div 
                key={node.name} 
                className="glass-panel p-8 rounded-[2.5rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 hover:bg-[var(--bg-primary)]/80 hover:border-[var(--accent)]/30 transition-all duration-500 flex flex-col md:flex-row md:items-center justify-between gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                 <div className="flex items-center gap-6">
                    <div className="size-16 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--accent)] shadow-inner">
                       {i === 0 && <Server className="size-8" />}
                       {i === 1 && <Database className="size-8" />}
                       {i === 2 && <Zap className="size-8" />}
                       {i === 3 && <Package className="size-8" />}
                       {i === 4 && <ShieldCheck className="size-8" />}
                       {i === 5 && <Globe className="size-8" />}
                    </div>
                    <div className="space-y-1">
                       <h3 className="text-lg  font-bold text-[var(--text-primary)] tracking-tight">{node.name}</h3>
                       <p className="text-[11px] lg:text-[12px]  font-semibold tracking-tight text-[var(--text-secondary)] opacity-40">{node.region}</p>
                    </div>
                 </div>

                 <div className="flex flex-col md:flex-row items-start md:items-center gap-6 md:gap-10">
                    <div className="space-y-2">
                       <p className="text-[11px] lg:text-[12px]  font-semibold  tracking-[0.4em] text-[var(--text-secondary)] opacity-40">Operational Status</p>
                       <div className="flex items-center gap-2 text-emerald-500">
                          <CheckCircle className="size-4" />
                          <span className="text-[11px] lg:text-[12px]  font-semibold tracking-tight leading-none">Operational</span>
                       </div>
                    </div>
                    <div className="h-10 w-px bg-[var(--glass-border)] hidden md:block" />
                    <div className="space-y-2">
                       <p className="text-[11px] lg:text-[12px]  font-semibold  tracking-[0.4em] text-[var(--text-secondary)] opacity-40">System Latency</p>
                       <div className="flex items-end gap-1.5 h-4">
                          {[1,2,3,4,5].map(j => (
                             <div key={j} className={`w-1 rounded-full ${j <= 4 ? 'bg-emerald-500' : 'bg-emerald-500/20'}`} style={{ height: `${Math.random() * 100}%` }} />
                          ))}
                          <span className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-primary)] leading-none ml-2">{node.latency}</span>
                       </div>
                    </div>
                 </div>
              </div>
           ))}
        </div>

        {/* Historical Insight */}
        <div className="glass-panel p-10 rounded-[3rem] border border-[var(--glass-border)] bg-gradient-to-br from-[var(--bg-primary)]/60 to-transparent">
           <div className="flex items-center justify-between mb-8">
              <h3 className="text-[11px] lg:text-[12px]  font-semibold  tracking-[0.3em] text-[var(--text-secondary)]">Historical Availability (Last 90 Days)</h3>
              <span className="text-[11px] lg:text-[12px]  font-semibold text-emerald-500 tracking-tight">99.98% Uptime</span>
           </div>
           <div className="flex gap-[2px] h-12 overflow-hidden items-end">
              {[...Array(90)].map((_, i) => (
                 <div key={i} className="flex-1 bg-emerald-500/20 rounded-full h-full hover:bg-[var(--accent)] transition-all cursor-crosshair group relative" title={`Day ${90-i} Status: Operational`}>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 bg-black text-white text-[11px] lg:text-[12px]  font-semibold rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-all">Status: Nominal (100%)</div>
                    <div className="w-full bg-emerald-500/40 h-full rounded-full" />
                 </div>
              ))}
           </div>
           <div className="flex justify-between items-center mt-4">
              <p className="text-[11px] lg:text-[12px]  font-semibold tracking-tight text-[var(--text-secondary)] opacity-40">90 Days Ago</p>
              <div className="flex-1 h-px bg-[var(--glass-border)] mx-10 opacity-30" />
              <p className="text-[11px] lg:text-[12px]  font-semibold tracking-tight text-[var(--text-secondary)] opacity-40">Today</p>
           </div>
        </div>

        <div className="text-center pb-20">
           <p className="text-[11px] lg:text-[12px]  font-semibold tracking-[0.5em] text-[var(--text-secondary)]  opacity-30">
              Auradime Global Infrastructure Node Status Protocol v4.2.0
           </p>
        </div>

      </div>
    </div>
  );
}

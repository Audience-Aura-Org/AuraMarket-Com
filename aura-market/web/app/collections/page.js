"use client";

import { useState } from 'react';
import { LayoutGrid, Sparkles, ArrowRight, Zap, Target, Box, Filter } from 'lucide-react';
import Link from 'next/link';

const COLLECTIONS = [
  { id: 'cyber-elite', title: 'Cyber Elite', count: 124, accent: '#06b6d4', image: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&q=80&w=400' },
  { id: 'minimalist-nodes', title: 'Minimalist Nodes', count: 84, accent: '#6366f1', image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=400' },
  { id: 'liquid-luxury', title: 'Liquid Luxury', count: 56, accent: '#f43f5e', image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=400' },
  { id: 'future-archive', title: 'Future Archive', count: 210, accent: '#a855f7', image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=400' }
];

export default function CollectionsPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-secondary)] py-12 px-6 md:px-12 transition-all duration-300">
      <div className="max-w-4xl mx-auto space-y-12">
        
        {/* Header Section (Slim) */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-6 border-b border-[var(--glass-border)]">
           <div className="flex items-center gap-4">
              <div className="size-12 rounded-xl bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center">
                 <Sparkles className="size-6" />
              </div>
              <div className="space-y-0.5">
                 <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">Curated Sectors</h1>
                 <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)] opacity-40">Definitive Inventory Calibration</p>
              </div>
           </div>

           <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative group w-full md:w-64">
                 <Filter className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-[var(--text-secondary)] opacity-20" />
                 <input 
                   type="text" 
                   placeholder="Search sectors..." 
                   className="w-full h-10 bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-xl pl-10 pr-4 text-xs focus:border-[var(--accent)]/50 focus:ring-4 focus:ring-[var(--accent)]/5 transition-all outline-none"
                 />
              </div>
           </div>
        </div>

        {/* Dense Collection Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           {COLLECTIONS.map((col, i) => (
              <Link 
                key={col.id} 
                href={`/shop?collection=${col.id}`}
                className="group p-4 rounded-3xl bg-[var(--bg-primary)]/50 border-2 border-[var(--glass-border)] hover:border-[var(--accent)]/30 transition-all duration-500 flex items-center gap-6 relative overflow-hidden"
              >
                 <div 
                   className="size-20 rounded-2xl border-2 border-[var(--glass-border)] overflow-hidden shrink-0 group-hover:scale-105 transition-transform duration-500"
                   style={{ borderColor: `${col.accent}15` }}
                 >
                    <img src={col.image} className="size-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" alt={col.title} />
                 </div>
                 
                 <div className="flex-1 space-y-1 pr-6">
                    <div className="flex items-center gap-4 text-white">
                       <h3 className="text-lg font-bold uppercase tracking-tight text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">{col.title}</h3>
                    </div>
                    <div className="flex items-center gap-10">
                       <span className="text-[9px] font-black text-[var(--text-secondary)] opacity-30 uppercase tracking-[0.2em] whitespace-nowrap">{col.count} nodes</span>
                    </div>
                 </div>

                 <div className="opacity-0 group-hover:opacity-100 transition-all absolute right-5">
                    <ArrowRight className="size-5 text-[var(--accent)]" />
                 </div>
              </Link>
           ))}
        </div>

        {/* Global Registry Footer */}
        <div className="pt-12 text-center opacity-30">
           <p className="text-[8px] font-black tracking-[0.5em] text-[var(--text-secondary)] uppercase">
              Aura Market Operational Sectors // Unified Hub v4.2
           </p>
        </div>

      </div>
    </div>
  );
}

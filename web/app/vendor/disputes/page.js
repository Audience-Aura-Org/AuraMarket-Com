"use client";

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  AlertTriangle, Shield, CheckCircle2, Search,
  RefreshCw, User, MessageSquare
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import api from '@/services/api';
import { useAuthStore } from '@/hooks/useAuth';
import Pagination from '@/components/common/Pagination';
import { motion, AnimatePresence } from 'framer-motion';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import StatCard from '@/components/layout/StatCard';

export default function VendorDisputesPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const fetchDisputes = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/vendor/disputes');
      if (res.data.success) {
        setDisputes(res.data.data?.disputes || res.data.disputes || []);
      }
    } catch (err) {
      console.error('Failed to fetch disputes:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { 
    if (!user || user.role !== 'vendor') return;
    fetchDisputes(); 
  }, [fetchDisputes, user]);

  const filtered = disputes.filter(d => {
    const orderStr = (d.order_id?._id || '').toLowerCase();
    const reasonStr = (d.reason || '').toLowerCase();
    return orderStr.includes(search.toLowerCase()) || reasonStr.includes(search.toLowerCase());
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const currentDisputes = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const activeCount = disputes.filter(d => d.status !== 'resolved').length;

  if (user?.role !== 'vendor') return null;

  return (
    <div className="w-full min-h-screen max-w-[1600px] mx-auto">
        
      <header className="min-h-20 py-4 flex flex-col md:flex-row md:h-24 items-center justify-between px-4 md:px-10 border-b border-[var(--glass-border)] bg-[var(--bg-primary)]/80 backdrop-blur-xl sticky top-0 md:top-16 z-40 gap-4 md:gap-0">
        <div className="flex items-center gap-4 md:gap-6 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-4">
            <div className="size-10 md:size-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500 shadow-inner border border-rose-500/20 shrink-0">
               <AlertTriangle className="w-5 h-5 md:w-6 md:h-6" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-bold text-[var(--text-primary)] tracking-tight">Resolution <span className="text-[var(--accent)]">Center</span></h2>
              <div className="flex items-center gap-2 mt-0.5">
                 <div className="size-1.5 rounded-full bg-rose-500 animate-pulse" />
                 <p className="text-[10px] md:text-[11px] lg:text-[12px] font-semibold text-[var(--text-secondary)] tracking-tight opacity-50 uppercase">Conflict Center</p>
              </div>
            </div>
          </div>
          <button onClick={fetchDisputes} className="md:hidden size-10 rounded-xl border border-[var(--glass-border)] text-[var(--text-secondary)] flex items-center justify-center active:scale-95">
             <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
           <div className="relative group flex-1 md:flex-none md:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-[var(--text-secondary)] opacity-20" />
              <input 
                type="text" 
                placeholder="Scan disputes..." 
                value={search}
                onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                className="w-full h-11 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl pl-10 pr-4 text-[11px] lg:text-[12px] font-semibold outline-none focus:border-[var(--accent)] transition-all"
              />
           </div>
           <button onClick={fetchDisputes} className="hidden md:flex size-11 md:size-12 rounded-2xl border border-[var(--glass-border)] hover:bg-[var(--accent)]/10 text-[var(--text-secondary)] items-center justify-center transition-all shadow-sm active:scale-95">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
           </button>
        </div>
      </header>

        <div className="px-4 md:px-8 py-8">
          
          {/* Stats Grid */}
          {(() => {
            const resolvedCount = disputes.length - activeCount;
            const resolveRate   = disputes.length > 0 ? Math.round((resolvedCount / disputes.length) * 100) : 100;
            const activeRate    = disputes.length > 0 ? Math.round((activeCount / disputes.length) * 100) : 0;
            return (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
                <StatCard label="Active"   value={String(activeCount)}    sub="Attention" icon="warning"      color="rose"   progress={activeRate}                     footer={`${activeCount} need attention`} />
                <StatCard label="Resolved" value={String(resolvedCount)}  sub="Closed"    icon="verified_user" color="emerald" progress={resolveRate}                  footer={`${resolvedCount} cases closed`} />
                <StatCard label="Rate"     value={`${resolveRate}%`}      sub="Yield"     icon="security"     color="indigo" progress={resolveRate}                    footer={`${resolveRate}% resolution rate`} />
                <StatCard label="Total"    value={String(disputes.length)} sub="Cases"    icon="database"     color="blue"   progress={Math.min(disputes.length, 100)} footer={`${disputes.length} total cases`} />
              </div>
            );
          })()}


          {/* Disputes List */}
          {loading ? (
            <LoadingSpinner fullScreen />
          ) : filtered.length === 0 ? (
            <div className="py-20 flex flex-col items-center text-center">
              <div className="size-20 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center mb-4">
                <Shield className="w-8 h-8 text-[var(--text-secondary)]/30" />
              </div>
              <h3 className="text-xl  font-bold text-[var(--text-primary)]">No Disputes</h3>
              <p className="text-xs text-[var(--text-secondary)] opacity-60 mt-2">No active disputes found.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {currentDisputes.map(d => (
                <div key={d._id} className="p-5 rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] hover:border-[var(--accent)]/20 transition-all">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      d.status === 'resolved' ? 'bg-emerald-500/10' : 'bg-amber-500/10'
                    }`}>
                      {d.status === 'resolved' ? (
                        <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                      ) : (
                        <AlertTriangle className="w-6 h-6 text-amber-500" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-3 py-1 rounded-full text-[11px] lg:text-[12px]  font-semibold  ${
                          d.status === 'resolved' 
                            ? 'bg-emerald-500/10 text-emerald-500' 
                            : 'bg-amber-500/10 text-amber-500'
                        }`}>
                          {d.status === 'resolved' ? 'Resolved' : 'Pending'}
                        </span>
                      </div>
                      <p className=" font-bold text-sm text-[var(--text-primary)] mb-1">
                        {d.reason?.replace(/_/g, ' ') || 'Dispute'}
                      </p>
                      <p className="text-xs text-[var(--text-secondary)] opacity-60">
                        Case ID: {d._id?.slice(-8).toUpperCase()}
                      </p>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-sm  font-bold text-[var(--text-primary)]">
                        {(d.order_id?.total_amount || 0).toLocaleString()}
                      </p>
                      <p className="text-[10px] lg:text-[12px] text-[var(--text-secondary)] opacity-60">XAF</p>
                    </div>
                  </div>
                  
                  {d.description && (
                    <div className="mt-4 p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)]">
                      <p className="text-xs text-[var(--text-secondary)]">"{d.description}"</p>
                    </div>
                  )}
                  
                  <div className="mt-4 flex items-center gap-3">
                    <div className="size-8 h-8 rounded-lg bg-[var(--bg-secondary)] flex items-center justify-center">
                      <User className="w-4 h-4 text-[var(--accent)] opacity-60" />
                    </div>
                    <span className="text-xs  font-bold text-[var(--text-secondary)]">
                      {d.initiator_id?.name || 'Customer'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="pt-6 flex justify-center">
              <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
            </div>
          )}
        </div>
      </div>
  );
}

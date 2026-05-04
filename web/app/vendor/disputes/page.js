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
        
        {/* Page Header */}
        <div className="hidden md:block px-4 md:px-8 py-6 border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/30 backdrop-blur-xl sticky top-0 z-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center border border-rose-500/20">
                <AlertTriangle className="w-6 h-6 text-rose-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Resolution Center</h1>
                <p className="text-xs text-[var(--text-secondary)] font-bold tracking-tight opacity-40">Conflict Management</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={fetchDisputes} 
                className="p-2.5 rounded-xl border border-[var(--glass-border)] hover:bg-white/5 text-[var(--text-secondary)] transition-all"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        <div className="px-4 md:px-8 py-8">
          
          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {[
              { label: 'Active Disputes', value: activeCount, sub: 'Needs attention', icon: AlertTriangle, color: 'rose' },
              { label: 'Resolved', value: (disputes.length - activeCount), sub: 'Session closed', icon: CheckCircle2, color: 'emerald' },
              { label: 'Success Rate', value: `${disputes.length > 0 ? Math.round(((disputes.length - activeCount)/disputes.length)*100) : 100}%`, sub: 'Resolution yield', icon: Shield, color: 'indigo' }
            ].map((stat, i) => (
              <div
                key={i}
                className="p-6 rounded-3xl bg-[var(--bg-secondary)]/30 border border-[var(--glass-border)] group hover:border-rose-500/30 transition-all cursor-default"
              >
                <div className={`p-3 rounded-2xl bg-${stat.color}-500/10 w-fit mb-4 group-hover:rotate-12 transition-transform`}>
                  <stat.icon className={`w-5 h-5 text-${stat.color}-500`} />
                </div>
                <p className="text-[10px] font-bold text-[var(--text-secondary)] tracking-tight mb-1">{stat.label}</p>
                <h4 className="text-3xl font-bold tracking-tighter mb-1">{stat.value}</h4>
                <p className="text-[9px] font-bold opacity-40 ">{stat.sub}</p>
              </div>
            ))}
          </div>

          {/* Search */}
          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-[var(--text-secondary)] opacity-40" />
            <input 
              type="text" 
              placeholder="Search disputes..." 
              value={search}
              onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
              className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl pl-11 pr-4 py-3 text-xs font-bold focus:outline-none focus:border-[var(--accent)] transition-all"
            />
          </div>

          {/* Disputes List */}
          {loading ? (
            <LoadingSpinner fullScreen />
          ) : filtered.length === 0 ? (
            <div className="py-20 flex flex-col items-center text-center">
              <div className="size-20 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center mb-4">
                <Shield className="w-8 h-8 text-[var(--text-secondary)]/30" />
              </div>
              <h3 className="text-xl font-bold text-[var(--text-primary)]">No Disputes</h3>
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
                        <span className={`px-3 py-1 rounded-full text-[9px] font-bold  ${
                          d.status === 'resolved' 
                            ? 'bg-emerald-500/10 text-emerald-500' 
                            : 'bg-amber-500/10 text-amber-500'
                        }`}>
                          {d.status === 'resolved' ? 'Resolved' : 'Pending'}
                        </span>
                      </div>
                      <p className="font-bold text-sm text-[var(--text-primary)] mb-1">
                        {d.reason?.replace(/_/g, ' ') || 'Dispute'}
                      </p>
                      <p className="text-xs text-[var(--text-secondary)] opacity-60">
                        Case ID: {d._id?.slice(-8).toUpperCase()}
                      </p>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-sm font-bold text-[var(--text-primary)]">
                        {(d.order_id?.total_amount || 0).toLocaleString()}
                      </p>
                      <p className="text-[9px] text-[var(--text-secondary)] opacity-60">XAF</p>
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
                    <span className="text-xs font-bold text-[var(--text-secondary)]">
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

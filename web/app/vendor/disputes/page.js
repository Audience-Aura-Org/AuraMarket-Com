"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { 
  AlertTriangle, Shield, CheckCircle2, Search,
  RefreshCw, User, MessageSquare
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import api from '@/services/api';
import { useAuthStore } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Pagination from '@/components/common/Pagination';

export const dynamic = 'force-dynamic';

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
    <DashboardLayout role="vendor">
      <div className="w-full min-h-screen">
        
        {/* Page Header */}
        <div className="px-4 md:px-8 py-6 border-b border-[var(--glass-border)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-rose-500" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-[var(--text-primary)]">Disputes</h1>
                <p className="text-sm text-[var(--text-secondary)] opacity-60">Resolution center</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={fetchDisputes} className="p-2 rounded-xl border border-[var(--glass-border)] hover:bg-white/5 text-[var(--text-secondary)]">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        <div className="px-4 md:px-8 py-8">
          
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <div className="p-5 rounded-2xl bg-amber-500/5 border border-amber-500/20">
              <div className="flex items-center gap-3 mb-3">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Pending</span>
              </div>
              <p className="text-3xl font-black text-amber-500">{activeCount}</p>
            </div>
            
            <div className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20">
              <div className="flex items-center gap-3 mb-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Resolved</span>
              </div>
              <p className="text-3xl font-black text-emerald-500">{disputes.length - activeCount}</p>
            </div>
            
            <div className="p-5 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 hidden lg:block">
              <div className="flex items-center gap-3 mb-3">
                <Shield className="w-5 h-5 text-indigo-500" />
                <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Total</span>
              </div>
              <p className="text-3xl font-black text-indigo-500">{disputes.length}</p>
            </div>
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
            <div className="py-20 flex justify-center">
              <div className="animate-spin size-10 border-2 border-[var(--accent)] border-t-transparent rounded-full" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 flex flex-col items-center text-center">
              <div className="size-20 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center mb-4">
                <Shield className="w-8 h-8 text-[var(--text-secondary)]/30" />
              </div>
              <h3 className="text-xl font-black text-[var(--text-primary)]">No Disputes</h3>
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
                        <span className={`px-3 py-1 rounded-full text-[9px] font-bold uppercase ${
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
                      <p className="text-sm font-black text-[var(--text-primary)]">
                        {(d.order_id?.total_amount || 0).toLocaleString()}
                      </p>
                      <p className="text-[9px] text-[var(--text-secondary)] opacity-60">XAF</p>
                    </div>
                  </div>
                  
                  {d.description && (
                    <div className="mt-4 p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)]">
                      <p className="text-xs text-[var(--text-secondary)] italic">"{d.description}"</p>
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
    </DashboardLayout>
  );
}

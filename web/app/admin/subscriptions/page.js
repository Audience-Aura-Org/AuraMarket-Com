"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { 
  CreditCard, TrendingUp, TrendingDown, Clock, Users,
  MoreVertical, Plus, Filter, ChevronLeft, ChevronRight,
  RefreshCw, Search
} from 'lucide-react';
import api from '@/services/api';
import Pagination from '@/components/common/Pagination';
import StatCard from '@/components/layout/StatCard';

const mockSubs = [
  { vendor: 'Nova Boutique', id: '#VND-8821', plan: 'Premium', renewal: 'Oct 24, 2027', billing: 'Yearly Billing', payment: 'paid', createdAt: '2023-10-24' },
  { vendor: 'Luxe Interior', id: '#VND-4102', plan: 'Pro', renewal: 'Nov 02, 2027', billing: 'Monthly Billing', payment: 'pending', createdAt: '2023-11-02' },
  { vendor: 'Base Apparel', id: '#VND-1055', plan: 'Basic', renewal: 'Oct 20, 2027', billing: 'Monthly Billing', payment: 'overdue', createdAt: '2023-10-20' },
  { vendor: 'Glow Cosmetics', id: '#VND-9922', plan: 'Premium', renewal: 'Dec 15, 2027', billing: 'Yearly Billing', payment: 'paid', createdAt: '2023-12-15' },
  { vendor: 'Zenith Tech', id: '#VND-3341', plan: 'Pro', renewal: 'Oct 30, 2027', billing: 'Monthly Billing', payment: 'paid', createdAt: '2023-10-30' },
];

const PLAN_BADGE = {
  Premium: 'bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)]/20',
  Pro: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  Basic: 'bg-slate-500/10 text-[var(--text-secondary)] border-slate-500/20',
};

const PAYMENT_DOT = {
  paid: 'bg-emerald-500',
  pending: 'bg-amber-500',
  overdue: 'bg-red-500',
};

export default function AdminSubscriptionsPage() {
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get('/subscriptions');
        if (res.data.success) setSubs(res.data.data.subscriptions || []);
        else setSubs(mockSubs);
      } catch {
        setSubs(mockSubs);
      } finally { setLoading(false); }
    };
    load();
  }, []);

  const totalPages = Math.ceil(subs.length / itemsPerPage);
  const currentSubs = subs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg-secondary)] text-[var(--text-primary)] relative transition-colors duration-500">
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-[var(--accent)]/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[20%] w-[400px] h-[400px] bg-purple-600/10 rounded-full blur-[100px] pointer-events-none" />

      <main className="flex-1 flex flex-col overflow-hidden relative z-10 w-full">
        <header className="min-h-20 py-4 flex flex-col md:flex-row md:h-24 items-center justify-between px-4 md:px-10 border-b border-[var(--glass-border)] bg-[var(--bg-primary)]/80 backdrop-blur-xl sticky top-0 md:top-16 z-40 gap-4 md:gap-0">
          <div className="flex items-center gap-4 md:gap-6 w-full md:w-auto justify-between md:justify-start">
            <div className="flex items-center gap-4">
              <div className="size-10 md:size-12 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] shadow-inner border border-[var(--accent)]/20 shrink-0">
                 <CreditCard className="w-5 h-5 md:w-6 md:h-6" />
              </div>
              <div>
                <h2 className="text-lg md:text-xl font-bold text-[var(--text-primary)] tracking-tight">Recurrent <span className="text-[var(--accent)]">Revenue</span></h2>
                <div className="flex items-center gap-2 mt-0.5">
                   <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                   <p className="text-[10px] md:text-[11px] lg:text-[12px] font-semibold text-[var(--text-secondary)] tracking-tight opacity-50 uppercase">System Live</p>
                </div>
              </div>
            </div>
            <button className="md:hidden size-10 rounded-xl border border-[var(--glass-border)] text-[var(--text-secondary)] flex items-center justify-center active:scale-95">
               <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
             <div className="relative group flex-1 md:flex-none md:w-80">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-[var(--text-secondary)] opacity-20" />
                <input 
                  type="text" 
                  placeholder="Search vendors, plans..." 
                  className="w-full h-11 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl pl-10 pr-4 !text-base placeholder:!text-base font-semibold outline-none focus:border-[var(--accent)] transition-all"
                />
             </div>
             <button className="hidden md:flex size-11 md:size-12 rounded-2xl border border-[var(--glass-border)] hover:bg-[var(--accent)]/10 text-[var(--text-secondary)] items-center justify-center transition-all shadow-sm active:scale-95">
                <RefreshCw className="w-4 h-4" />
             </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto w-full">
          <div className="p-10 space-y-8 w-full">
            <div>
              <h2 className="text-3xl  font-bold text-[var(--text-primary)] tracking-tight">Subscription Management</h2>
              <p className="text-[var(--text-secondary)] mt-1  font-bold">Real-time overview of your vendor ecosystem and recurring revenue.</p>
            </div>

            {/* Stats matrix */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              <StatCard label="Active" value="1,284" sub="vs. 1,141 last month" pct="+12.5%" icon={Users} color="fuchsia" />
              <StatCard label="MRR" value="$45,200" sub="vs. $41,750 last month" pct="+8.2%" icon={CreditCard} color="blue" />
              <StatCard label="Churn Risk" value="48" sub="Next 7 days" pct="Due" icon={Clock} color="amber" />
            </div>

            {/* Table */}
            <div className="bg-[var(--bg-primary)]/40 border border-[var(--glass-border)] rounded-3xl overflow-hidden glass-panel shadow-sm">
              <div className="p-6 border-b border-[var(--glass-border)] flex flex-wrap items-center justify-between gap-4 bg-[var(--bg-primary)]/50">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl  font-bold text-[var(--text-primary)]">Vendor Subscription Overview</h2>
                  <span className="bg-[var(--accent)]/10 text-[var(--accent)] text-[11px] lg:text-[12px]  font-semibold tracking-tight px-2.5 py-0.5 rounded-full border border-[var(--accent)]/20 ">Live Data</span>
                </div>
                <div className="flex items-center gap-3">
                  <button className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-secondary)]/50 rounded-xl border border-[var(--glass-border)] text-[11px] lg:text-[12px]  font-semibold tracking-tight text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all ">
                    <Filter className="w-4 h-4" /> Filter
                  </button>
                  <button className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] rounded-xl text-[11px] lg:text-[12px]  font-semibold tracking-tight shadow-lg shadow-[var(--accent)]/20 hover:opacity-90 transition-all text-white ">
                    Add Subscription
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
                {loading ? [...Array(6)].map((_, i) => (
                  <div key={i} className="h-48 bg-white/5 rounded-3xl animate-pulse border border-[var(--glass-border)]" />
                )) : currentSubs.map((s, i) => (
                  <div key={i} className="group glass-panel rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 p-6 flex flex-col space-y-4 hover:border-[var(--accent)]/30 transition-all shadow-sm hover:shadow-xl">
                    <div className="flex items-start justify-between">
                       <div className="flex items-center gap-3">
                          <div className="size-11 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center font-bold text-[var(--accent)] text-lg shrink-0">
                             {s.vendor[0]}
                          </div>
                          <div className="min-w-0">
                             <p className="text-sm font-bold text-[var(--text-primary)] truncate">{s.vendor}</p>
                             <p className="text-[10px] font-semibold text-[var(--text-secondary)] opacity-40 uppercase tracking-tight">{s.id}</p>
                          </div>
                       </div>
                       <button className="size-8 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--accent)]/10 transition-all border border-transparent hover:border-[var(--glass-border)]">
                          <MoreVertical className="size-4" />
                       </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                       <div className="p-3 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--glass-border)]">
                          <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.1em] mb-1 opacity-30">Plan Tier</p>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold tracking-tight border ${PLAN_BADGE[s.plan]}`}>
                             {s.plan}
                          </span>
                       </div>
                       <div className="p-3 rounded-2xl bg-[var(--bg-secondary)]/50 border border-[var(--glass-border)]">
                          <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.1em] mb-1 opacity-30">Status</p>
                          <div className="flex items-center gap-1.5">
                             <span className={`w-1.5 h-1.5 rounded-full ${PAYMENT_DOT[s.payment]} shadow-sm`} />
                             <span className="text-[10px] font-bold text-[var(--text-primary)] uppercase">{s.payment}</span>
                          </div>
                       </div>
                    </div>

                    <div className="pt-4 border-t border-[var(--glass-border)]/50 flex items-center justify-between">
                       <div>
                          <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.1em] opacity-30">Renewal Cycle</p>
                          <p className="text-xs font-bold text-[var(--text-primary)]">{s.renewal}</p>
                       </div>
                       <div className="text-right">
                          <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.1em] opacity-30">Billing</p>
                          <p className="text-[10px] font-semibold text-[var(--text-secondary)] opacity-60">{s.billing}</p>
                       </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-6 border-t border-[var(--glass-border)] bg-[var(--bg-primary)]/50">
                <Pagination 
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                />
              </div>
            </div>

            {/* Plan Distribution + Churn */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-20">
              <div className="bg-[var(--bg-primary)]/40 border border-[var(--glass-border)] rounded-3xl p-8 glass-panel">
                <h3 className="text-lg  font-bold tracking-tight text-[var(--text-primary)] mb-6 ">Plan Tier Distribution</h3>
                <div className="space-y-5">
                  <TierBar label="Premium" pct="42%" color="fuchsia" />
                  <TierBar label="Pro" pct="35%" color="blue" />
                  <TierBar label="Basic" pct="23%" color="slate" />
                </div>
              </div>
              <div className="bg-[var(--bg-primary)]/40 border border-[var(--glass-border)] rounded-3xl p-8 flex items-center gap-6 glass-panel">
                <div className="flex-1">
                   <h3 className="text-lg  font-bold tracking-tight text-[var(--text-primary)] mb-2 ">Churn Prediction</h3>
                   <p className="text-sm text-[var(--text-secondary)] mb-6  font-bold">Based on payment delays and account activity in the last 30 days.</p>
                   <div className="flex items-end gap-2">
                      <span className="text-4xl  font-bold text-[var(--text-primary)] tracking-tighter">2.4%</span>
                      <span className="text-emerald-600 text-[11px] lg:text-[12px]  font-semibold mb-2 flex items-center gap-1 tracking-tight">
                         <TrendingDown className="w-3 h-3" /> 0.8%
                      </span>
                   </div>
                   <p className="text-[10px] lg:text-[12px] text-[var(--text-secondary)] tracking-[0.2em]  font-semibold mt-1  opacity-60">Stable Outlook</p>
                </div>
                <div className="w-24 h-24 rounded-full border-4 border-[var(--accent)]/10 flex items-center justify-center relative flex-shrink-0">
                  <div className="absolute inset-0 rounded-full border-4 border-[var(--accent)] border-t-transparent border-r-transparent -rotate-45 shadow-[0_0_15px_rgba(242,13,242,0.1)]" />
                  <TrendingUp className="w-8 h-8 text-[var(--accent)] relative z-10" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}



function TierBar({ label, pct, color }) {
  const bar = { fuchsia: 'bg-[var(--accent)]', blue: 'bg-blue-600', slate: 'bg-slate-500' };
  const txt = { fuchsia: 'text-[var(--accent)]', blue: 'text-blue-600', slate: 'text-[var(--text-secondary)]' };
  return (
    <div>
      <div className="flex justify-between text-[11px] lg:text-[12px]  font-semibold tracking-tight mb-2 ">
        <span className="text-[var(--text-secondary)]">{label}</span>
        <span className={txt[color]}>{pct}</span>
      </div>
      <div className="h-2 w-full bg-[var(--bg-secondary)] rounded-full overflow-hidden border border-[var(--glass-border)]">
        <div className={`h-full ${bar[color]} rounded-full shadow-[0_0_10px_rgba(0,0,0,0.1)]`} style={{ width: pct }} />
      </div>
    </div>
  );
}

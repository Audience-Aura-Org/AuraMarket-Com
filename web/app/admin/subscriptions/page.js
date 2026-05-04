"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { 
  CreditCard, TrendingUp, TrendingDown, Clock, Users,
  MoreVertical, Plus, Filter, ChevronLeft, ChevronRight
} from 'lucide-react';
import api from '@/services/api';
import Pagination from '@/components/common/Pagination';

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
        <header className="h-20 flex items-center justify-between px-10 glass-panel border-b border-[var(--glass-border)] relative z-10 bg-[var(--bg-primary)] text-[var(--text-primary)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/20 flex items-center justify-center text-[var(--accent)] shadow-lg shadow-[var(--accent)]/5">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">Subscription Management</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-[11px] font-bold tracking-tight text-emerald-600 ">System Live</p>
              </div>
            </div>
          </div>
          <div className="hidden md:flex items-center bg-[var(--bg-secondary)] rounded-full px-4 py-2 border border-[var(--glass-border)] w-80">
            <svg className="w-4 h-4 text-[var(--text-secondary)] mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input className="bg-transparent border-none focus:ring-0 text-sm w-full placeholder:text-[var(--text-secondary)]/50 font-bold text-[var(--text-primary)]" placeholder="Search vendors, plans, or invoices..." />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto w-full">
          <div className="p-10 space-y-8 w-full">
            <div>
              <h2 className="text-3xl font-bold text-[var(--text-primary)] tracking-tight">Subscription Management</h2>
              <p className="text-[var(--text-secondary)] mt-1 font-bold">Real-time overview of your vendor ecosystem and recurring revenue.</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard label="Active Subscriptions" value="1,284" sub="vs. 1,141 last month" trend="+12.5%" positive Icon={Users} color="fuchsia" />
              <StatCard label="Monthly Revenue" value="$45,200" sub="vs. $41,750 last month" trend="+8.2%" positive Icon={CreditCard} color="blue" />
              <StatCard label="Expiring Soon" value="48" sub="Next 7 days" trend="Due" warn Icon={Clock} color="amber" />
            </div>

            {/* Table */}
            <div className="bg-[var(--bg-primary)]/40 border border-[var(--glass-border)] rounded-3xl overflow-hidden glass-panel shadow-sm">
              <div className="p-6 border-b border-[var(--glass-border)] flex flex-wrap items-center justify-between gap-4 bg-[var(--bg-primary)]/50">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-[var(--text-primary)]">Vendor Subscription Overview</h2>
                  <span className="bg-[var(--accent)]/10 text-[var(--accent)] text-[11px] font-bold tracking-tight px-2.5 py-0.5 rounded-full border border-[var(--accent)]/20 ">Live Data</span>
                </div>
                <div className="flex items-center gap-3">
                  <button className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-secondary)]/50 rounded-xl border border-[var(--glass-border)] text-[11px] font-bold tracking-tight text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all ">
                    <Filter className="w-4 h-4" /> Filter
                  </button>
                  <button className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] rounded-xl text-[11px] font-bold tracking-tight shadow-lg shadow-[var(--accent)]/20 hover:opacity-90 transition-all text-white ">
                    <Plus className="w-4 h-4" /> Add Subscription
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-[var(--bg-secondary)]/30 text-[var(--text-secondary)] text-[11px] font-bold tracking-tight border-b border-[var(--glass-border)] ">
                      <th className="px-6 py-4">Vendor Name</th>
                      <th className="px-6 py-4">Plan Type</th>
                      <th className="px-6 py-4">Renewal Date</th>
                      <th className="px-6 py-4">Payment Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--glass-border)]">
                    {loading ? [...Array(5)].map((_, i) => (
                      <tr key={i}><td colSpan={5} className="px-6 py-5"><div className="h-8 bg-white/5 rounded-xl animate-pulse" /></td></tr>
                    )) : currentSubs.map((s, i) => (
                      <tr key={i} className="group hover:bg-[var(--accent)]/5 transition-colors">
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[var(--bg-primary)] border border-[var(--glass-border)] flex items-center justify-center font-bold text-[var(--accent)] text-lg shadow-sm">
                              {s.vendor[0]}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-[var(--text-primary)]">{s.vendor}</p>
                              <p className="text-[10px] text-[var(--text-secondary)] font-bold tracking-tight ">{s.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <span className={`inline-flex items-center px-3 py-0.5 rounded-full text-xs font-bold  tracking-tight border ${PLAN_BADGE[s.plan]}`}>
                            {s.plan}
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          <p className="text-sm font-bold text-[var(--text-primary)]">{s.renewal}</p>
                          <p className="text-[10px] text-[var(--text-secondary)] font-bold tracking-tight mt-0.5 ">{s.billing}</p>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full ${PAYMENT_DOT[s.payment]} ${s.payment === 'overdue' ? 'animate-pulse' : ''} shadow-sm`} />
                            <span className="text-sm font-bold capitalize text-[var(--text-primary)]">{s.payment}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <button className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors opacity-0 group-hover:opacity-100">
                            <MoreVertical className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                <h3 className="text-lg font-bold tracking-tight text-[var(--text-primary)] mb-6 ">Plan Tier Distribution</h3>
                <div className="space-y-5">
                  <TierBar label="Premium" pct="42%" color="fuchsia" />
                  <TierBar label="Pro" pct="35%" color="blue" />
                  <TierBar label="Basic" pct="23%" color="slate" />
                </div>
              </div>
              <div className="bg-[var(--bg-primary)]/40 border border-[var(--glass-border)] rounded-3xl p-8 flex items-center gap-6 glass-panel">
                <div className="flex-1">
                   <h3 className="text-lg font-bold tracking-tight text-[var(--text-primary)] mb-2 ">Churn Prediction</h3>
                   <p className="text-sm text-[var(--text-secondary)] mb-6 font-bold">Based on payment delays and account activity in the last 30 days.</p>
                   <div className="flex items-end gap-2">
                      <span className="text-4xl font-bold text-[var(--text-primary)] tracking-tighter">2.4%</span>
                      <span className="text-emerald-600 text-[11px] font-bold mb-2 flex items-center gap-1 tracking-tight">
                         <TrendingDown className="w-3 h-3" /> 0.8%
                      </span>
                   </div>
                   <p className="text-[10px] text-[var(--text-secondary)] tracking-[0.2em] font-bold mt-1  opacity-60">Stable Outlook</p>
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

function StatCard({ label, value, sub, trend, positive, warn, Icon, color }) {
  const colors = { 
    fuchsia: 'bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)]/20', 
    blue: 'bg-blue-500/10 text-blue-600 border-blue-500/20', 
    amber: 'bg-amber-500/10 text-amber-600 border-amber-500/20' 
  };
  const glows = { fuchsia: 'bg-[var(--accent)]', blue: 'bg-blue-500', amber: 'bg-amber-500' };
  return (
    <div className="bg-[var(--bg-primary)]/40 border border-[var(--glass-border)] rounded-3xl p-6 relative overflow-hidden group hover:translate-y-[-4px] transition-all glass-panel">
      <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full blur-3xl opacity-10 transition-opacity group-hover:opacity-20 ${glows[color]}`} />
      <div className="flex items-center justify-between mb-4 relative z-10">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${colors[color]}`}><Icon className="w-5 h-5" /></div>
        <span className={`text-[11px] font-bold tracking-tight flex items-center gap-1  ${warn ? 'text-amber-600' : positive ? 'text-emerald-600' : 'text-red-600'}`}>
          {!warn && (positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />)}
          {trend}
        </span>
      </div>
      <p className="text-[var(--text-secondary)] text-[11px] font-bold tracking-tight  relative z-10">{label}</p>
      <h3 className="text-3xl font-bold text-[var(--text-primary)] mt-1 relative z-10">{value}</h3>
      {sub && <p className="text-[10px] text-[var(--text-secondary)] mt-2 font-bold tracking-tight  opacity-60">{sub}</p>}
    </div>
  );
}

function TierBar({ label, pct, color }) {
  const bar = { fuchsia: 'bg-[var(--accent)]', blue: 'bg-blue-600', slate: 'bg-slate-500' };
  const txt = { fuchsia: 'text-[var(--accent)]', blue: 'text-blue-600', slate: 'text-[var(--text-secondary)]' };
  return (
    <div>
      <div className="flex justify-between text-[11px] font-bold tracking-tight mb-2 ">
        <span className="text-[var(--text-secondary)]">{label}</span>
        <span className={txt[color]}>{pct}</span>
      </div>
      <div className="h-2 w-full bg-[var(--bg-secondary)] rounded-full overflow-hidden border border-[var(--glass-border)]">
        <div className={`h-full ${bar[color]} rounded-full shadow-[0_0_10px_rgba(0,0,0,0.1)]`} style={{ width: pct }} />
      </div>
    </div>
  );
}

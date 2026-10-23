"use client";
export const dynamic = 'force-dynamic';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Radio, CheckCheck, Check, Trash2, Search, RefreshCw, ArrowUpRight, Bell, Clock, Inbox } from 'lucide-react';
import { useRouter } from 'next/navigation';
import api from '@/services/api';
import { useAuthStore } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { notificationService } from '@/services/notifications';
import { normalizeAppRoute } from '@/lib/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import StatCard from '@/components/layout/StatCard';
import Pagination from '@/components/common/Pagination';
import styles from '@/components/layout/Workspace.module.css';

const FILTERS = [['all', 'All signals'], ['orders', 'Orders'], ['payments', 'Payments'], ['messages', 'Messages'], ['logistics', 'Delivery'], ['system', 'Account & updates']];
const roleDescription = {
  customer: 'Your orders, payments and updates, together in one place.',
  vendor: 'Keep up with orders, payouts and updates for your business.',
  logistics: 'Stay on top of assignments, deliveries and payout updates.',
  manager: 'Follow the updates and account activity sent to you.',
  admin: 'Review the operational and account updates sent to you.',
};
const dateLabel = value => { const date = new Date(value); return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); };

export default function NotificationsPage() {
  const router = useRouter();
  const { user, hasHydrated } = useAuthStore();
  const { unreadCount, markAllRead, refresh } = useNotifications();
  const [notifications, setNotifications] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState('all');
  const [unread, setUnread] = useState(false);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const requestVersion = useRef(0);
  const owner = useRef(user?._id);
  owner.current = user?._id;

  useEffect(() => { if (hasHydrated && !user) router.replace('/login'); }, [hasHydrated, user, router]);
  useEffect(() => { const timer = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 250); return () => clearTimeout(timer); }, [search]);
  useEffect(() => { setNotifications([]); setPage(1); }, [user?._id]);
  const load = useCallback(async () => {
    if (!user?._id) return;
    const version = ++requestVersion.current;
    setLoading(true); setError('');
    try {
      const res = await api.get('/notifications', { params: { page, limit: 20, category, unread: String(unread), search: query }, skipClientCache: true, __noActAs: true });
      if (version !== requestVersion.current || owner.current !== user._id) return;
      const data = res.data.data;
      setNotifications(data.notifications || []); setTotal(data.total || 0); setPages(data.pages || 1);
      if (page > (data.pages || 1)) setPage(data.pages || 1);
    } catch { if (version === requestVersion.current) setError('Signals could not be loaded. Please try again.'); }
    finally { if (version === requestVersion.current) setLoading(false); }
  }, [user?._id, page, category, unread, query]);
  useEffect(() => { load(); return () => { requestVersion.current += 1; }; }, [load]);
  useEffect(() => { window.addEventListener('aura:push-received', load); return () => window.removeEventListener('aura:push-received', load); }, [load]);
  useEffect(() => notificationService.onPush(() => { load(); }), [load]);

  const act = async (action, id) => {
    if (busy) return;
    setBusy(id || 'all'); setError('');
    try {
      if (action === 'all') await markAllRead();
      else if (action === 'delete') await api.delete(`/notifications/${id}`, { __noActAs: true });
      else await api.patch(`/notifications/${id}/read`, undefined, { __noActAs: true });
      await Promise.all([load(), refresh()]);
      return true;
    } catch { setError('The change could not be saved. Please try again.'); return false; }
    finally { setBusy(null); }
  };
  const open = async notification => {
    const link = normalizeAppRoute(notification.metadata?.link, null);
    if (!link) return;
    if (!notification.is_read && !await act('read', notification._id)) return;
    router.push(link);
  };

  return <DashboardLayout role={user?.role || 'customer'} hideFooter>
    <div className={styles.page}><div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.heading}><div className={styles.icon}><Radio size={22} /></div><div><h1 className={styles.title}>Signals</h1><p className={styles.subtitle}>{roleDescription[user?.role] || roleDescription.customer}</p></div></div>
        <div className={styles.actions}>
          <button type="button" className={styles.button} onClick={load} disabled={loading} aria-label="Refresh signals"><RefreshCw /> Refresh</button>
          <button type="button" className={styles.button} onClick={() => act('all')} disabled={Boolean(busy) || unreadCount === 0}><CheckCheck /> Mark all read</button>
        </div>
      </header>
      <div className={styles.stats}>
        <StatCard label="Unread signals" value={unreadCount} icon={Bell} color="primary" sub="Waiting for your attention" progress={unreadCount > 0 ? 100 : 0} footer={unreadCount ? 'You have new updates' : 'All caught up'} />
        <StatCard label="Matching signals" value={total} icon={Inbox} color="blue" sub="Across the selected filters" footer="20 records per page" />
        <StatCard label="Current page" value={page + ' / ' + pages} icon={Clock} color="emerald" sub="Your personal activity feed" footer="Newest updates first" />
      </div>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <section className={styles.panel} aria-label="Your signals" aria-busy={loading}>
        <div className={styles.toolbar}>
          <div className={styles.tabs}>{FILTERS.map(([id, label]) => <button key={id} type="button" className={styles.tab} aria-pressed={category === id} onClick={() => { setCategory(id); setPage(1); }}>{label}</button>)}</div>
          <label className={styles.search}><Search /><input aria-label="Search signals" placeholder="Search signals" value={search} onChange={event => setSearch(event.target.value)} /></label>
          <button type="button" className={styles.tab} aria-pressed={unread} onClick={() => { setUnread(!unread); setPage(1); }}>Unread only</button>
        </div>
        {loading ? <div className={styles.empty} role="status">Loading signals...</div> : !notifications.length ? <div className={styles.empty}><Radio size={30} /><h2>{error ? 'Signals unavailable' : 'You are up to date'}</h2><p>{error ? 'Use Refresh to try again.' : 'New updates will appear here. Try another filter to see more activity.'}</p></div> : <div>
          {notifications.map(notification => <article key={notification._id} className={styles.signal} data-unread={!notification.is_read}>
            <div className={styles.icon}><Bell size={19} /></div>
            <div className={styles.signalBody}><div className={styles.signalTop}><h2 className={styles.signalTitle}>{notification.title}</h2><time className={styles.time} dateTime={notification.createdAt}>{dateLabel(notification.createdAt)}</time></div>
              <p className={styles.message}>{notification.message}</p>
              <div className={styles.actions}><span className={styles.category}>{!notification.is_read && <span className={styles.dot} aria-label="Unread" />}{String(notification.type || 'Update').replace(/_/g, ' ')}</span>
                {normalizeAppRoute(notification.metadata?.link, null) && <button type="button" className={styles.button} onClick={() => open(notification)} disabled={Boolean(busy)}>View update <ArrowUpRight /></button>}
              </div>
            </div>
            <div className={styles.signalActions}>{!notification.is_read && <button type="button" className={styles.iconButton} onClick={() => act('read', notification._id)} disabled={Boolean(busy)} aria-label={'Mark ' + notification.title + ' as read'}><Check /></button>}<button type="button" className={styles.iconButton} onClick={() => act('delete', notification._id)} disabled={Boolean(busy)} aria-label={'Delete ' + notification.title}><Trash2 /></button></div>
          </article>)}
        </div>}
        <Pagination compact currentPage={page} totalPages={pages} onPageChange={setPage} loading={loading} />
      </section>
    </div></div>
  </DashboardLayout>;
}

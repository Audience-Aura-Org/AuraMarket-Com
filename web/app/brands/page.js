"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { Store, ShieldCheck, Search, ArrowUpRight, Star, Users, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import api from '@/services/api';
import Pagination from '@/components/common/Pagination';
import styles from '@/components/layout/Workspace.module.css';

export default function BrandsPage() {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [verified, setVerified] = useState(false);
  const [sort, setSort] = useState('-createdAt');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const version = useRef(0);
  useEffect(() => { const timer = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 250); return () => clearTimeout(timer); }, [search]);
  const load = useCallback(async () => {
    const request = ++version.current;
    setLoading(true); setError('');
    try {
      const res = await api.get('/vendors', { params: { page, limit: 20, search: query, sort, ...(verified ? { verified: 'true' } : {}) } });
      if (request !== version.current) return;
      setStores(res.data.data?.stores || []); setPages(Math.max(1, res.data.pagination?.pages || 1)); setTotal(res.data.pagination?.total || 0);
    } catch { if (request === version.current) setError('Brands could not be loaded. Please try again.'); }
    finally { if (request === version.current) setLoading(false); }
  }, [page, query, verified, sort]);
  useEffect(() => { load(); return () => { version.current += 1; }; }, [load]);

  return <div className={styles.page}><main className={styles.container}>
    <header className={styles.header}>
      <div className={styles.heading}><div className={styles.icon}><Store size={23} /></div><div><h1 className={styles.title}>Discover brands</h1><p className={styles.subtitle}>Find your next favourite store, from everyday essentials to something special.</p></div></div>
      <Link href="/shop" className={styles.button}>Explore marketplace <ArrowUpRight /></Link>
    </header>
    <section className={styles.panel} aria-label="Find brands"><div className={styles.toolbar}>
      <label className={styles.search}><Search /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search by brand name" aria-label="Search brands" /></label>
      <div className={styles.tabs}><button type="button" className={styles.tab} aria-pressed={!verified} onClick={() => { setVerified(false); setPage(1); }}>All brands</button><button type="button" className={styles.tab} aria-pressed={verified} onClick={() => { setVerified(true); setPage(1); }}>Verified brands</button></div>
      <select aria-label="Sort brands" className={styles.button} value={sort} onChange={event => { setSort(event.target.value); setPage(1); }}><option value="-createdAt">Recently joined</option><option value="-rating">Highest rated</option><option value="store_name">Name A-Z</option></select>
      <span className={styles.category} aria-live="polite">{loading ? 'Finding brands...' : total + (total === 1 ? ' brand' : ' brands')}</span>
    </div></section>
    {error && <div role="alert" className={styles.error}>{error} <button type="button" className={styles.button} onClick={load}><RefreshCw /> Try again</button></div>}
    {loading ? <div className={styles.empty} role="status">Loading brands...</div> : !error && !stores.length ? <div className={styles.empty}><Store size={32} /><h2>No brands found</h2><p>Try another name or browse all brands.</p></div> : <div className={styles.brandGrid}>
      {stores.map(store => {
        const logo = store.store?.logo || store.user_id?.branding?.logo || store.user_id?.avatar;
        const name = store.store_name || 'Store';
        return <Link key={store._id} href={'/stores/' + encodeURIComponent(store._id)} className={styles.brand}>
          <div className={styles.brandTop}><div className={styles.logo}>{name[0].toUpperCase()}{logo && <img src={logo} alt="" loading="lazy" onError={event => { event.currentTarget.style.display = 'none'; }} />}</div><div><h2 className={styles.brandName}>{name}</h2>{store.verified && <span className={styles.badge}><ShieldCheck size={13} /> Verified brand</span>}</div></div>
          <p className={styles.brandDescription}>{store.description || 'Explore this brand\u2019s products and latest arrivals.'}</p>
          <div className={styles.brandFooter}><span><Star />{Number(store.rating) > 0 ? Number(store.rating).toFixed(1) + ' rating' : 'New brand'}</span><span><Users />{Number(store.follower_count || 0).toLocaleString()} followers</span><ArrowUpRight size={17} aria-label="Visit store" /></div>
        </Link>;
      })}
    </div>}
    {!error && <Pagination compact currentPage={page} totalPages={pages} onPageChange={setPage} loading={loading} />}
  </main></div>;
}

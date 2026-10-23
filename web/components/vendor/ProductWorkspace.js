'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, Package } from 'lucide-react';
import styles from './Products.module.css';

export function useProductPaths() {
  const pathname = usePathname() || '';
  const workspace = pathname.match(/^\/manager\/as\/[^/]+/);
  const base = workspace ? workspace[0] : '/vendor';
  return { list: `${base}/products`, add: `${base}/products/add`, edit: (id) => `${base}/products/edit?id=${encodeURIComponent(id)}` };
}

export function ProductPageHeader({ title, description, back, onBack, backDisabled, children }) {
  return (
    <header className={`${styles.header} sticky top-14 lg:top-0 z-30`}>
      <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-3 px-4 py-4 sm:px-6 md:px-8">
        <div className="flex min-w-0 items-center gap-3">
          {onBack ? <button type="button" onClick={onBack} disabled={backDisabled} aria-label="Back to products" className={styles.iconButton}><ArrowLeft className="size-5" /></button>
            : back ? <Link href={back} aria-label="Back to products" className={styles.iconButton}><ArrowLeft className="size-5" /></Link>
            : <span className={styles.headerIcon}><Package className="size-5" /></span>}
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold tracking-tight md:text-xl">{title}</h1>
            <p className="mt-0.5 truncate text-[11px] text-[var(--text-secondary)]">{description}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">{children}</div>
      </div>
    </header>
  );
}

export function ProductSection({ icon: Icon, title, description, children, id, className = '' }) {
  return (
    <section id={id} className={`${styles.panel} ${className}`}>
      <div className="mb-5 flex items-start gap-3">
        {Icon && <span className={styles.sectionIcon}><Icon className="size-4" /></span>}
        <div><h2 className="text-sm font-semibold tracking-tight">{title}</h2>{description && <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-secondary)]">{description}</p>}</div>
      </div>
      {children}
    </section>
  );
}

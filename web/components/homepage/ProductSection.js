"use client";
import React from 'react';
import ProductCard from '@/components/ProductCard';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

export default function ProductSection({ title, subtitle, data, config }) {
  const { t, label } = useLanguage();
  if (!data?.length) return null;

  const products = data
    .map((item) => item.product_id)
    .filter((p) => p && typeof p === 'object' && (p._id || p.id));
  if (!products.length) return null;

  return (
    <section className="relative w-full overflow-hidden py-3 sm:py-4 lg:py-5">
      {/* Section header */}
      <div className="mb-3 flex items-end justify-between gap-3 px-3 sm:px-4 md:mb-4 md:px-1">
        <div className="min-w-0 space-y-1.5 text-left">
          <div className="flex items-center gap-2.5">
            <span className="w-4 h-[3px] bg-[var(--accent)] rounded-full shrink-0" />
            <h2 className="truncate font-[var(--font-poppins)] text-[18px] font-semibold leading-tight tracking-tight text-[var(--text-primary)] sm:text-xl md:text-2xl">
              {label(title)}
            </h2>
          </div>
          {subtitle && (
            <p className="pl-6 line-clamp-2 max-w-[560px] font-[var(--font-poppins)] text-[11px] font-medium leading-relaxed tracking-normal text-[var(--text-secondary)] sm:text-[12px]">
              {label(subtitle)}
            </p>
          )}
        </div>
        <Link
          href="/shop"
          className="group inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full border border-[var(--accent)]/25 bg-[var(--accent)]/10 px-3 font-[var(--font-poppins)] text-[11px] font-semibold text-[var(--accent)] transition hover:border-[var(--accent)]/45 hover:bg-[var(--accent)] hover:text-white active:scale-[0.98] sm:h-10 sm:px-4 sm:text-[12px]"
          aria-label={`${t('overtime.explore', 'Explore')} ${label(title || 'products')}`}
        >
          <span>{t('overtime.explore', 'Explore')}</span>
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5 sm:size-4" />
        </Link>
      </div>

      <div className="w-full px-0 md:px-1">
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-5 snap-x snap-mandatory md:gap-4 md:pb-6">
          {/* Leading space on mobile */}
          <div className="w-1 shrink-0 md:hidden" aria-hidden="true" />
          {products.map((product, i) => (
            <div
              key={product._id || product.id || i}
              className="w-[calc(50%-0.75rem)] shrink-0 snap-start sm:w-[calc(33.333%-0.75rem)] lg:w-[calc(16.666%-0.875rem)]"
            >
              <ProductCard product={product} layout="grid" />
            </div>
          ))}
          <div className="w-1 shrink-0 md:hidden" aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}

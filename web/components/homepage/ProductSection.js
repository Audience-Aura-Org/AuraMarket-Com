"use client";
import React from 'react';
import ProductCard from '@/components/ProductCard';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

export default function ProductSection({ title, subtitle, data, config }) {
  const { t, label } = useLanguage();
  if (!data?.length) return null;

  const products = data.map((item) => item.product_id).filter(Boolean);
  if (!products.length) return null;

  return (
    <section className="relative w-full overflow-hidden py-3 sm:py-4 lg:py-5">
      <div className="mb-3 flex items-end justify-between gap-3 px-3 sm:px-4 md:mb-4 md:px-1">
        <div className="min-w-0 space-y-1 text-left">
          <h2 className="truncate font-[var(--font-poppins)] text-[18px] font-semibold leading-tight tracking-normal text-[var(--text-primary)] sm:text-xl md:text-2xl">
            {label(title)}
          </h2>
          {subtitle && (
            <p className="line-clamp-2 max-w-[620px] font-[var(--font-poppins)] text-[11px] font-medium leading-relaxed tracking-normal text-[var(--text-secondary)] sm:text-[12px]">
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
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-4 snap-x snap-mandatory md:gap-4 md:pb-5">
          {products.map((product, i) => (
            <div
              key={product._id || product.id || i}
              className="w-[calc(50%-0.375rem)] shrink-0 snap-start sm:w-[calc(33.333%-0.75rem)] lg:w-[calc(16.666%-0.875rem)]"
            >
              <ProductCard product={product} layout="grid" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

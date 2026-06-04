"use client";
import React from 'react';
import ProductCard from '@/components/ProductCard';
import Link from 'next/link';

export default function ProductSection({ title, subtitle, data, config }) {
  if (!data?.length) return null;

  const products = data.map((item) => item.product_id).filter(Boolean);
  if (!products.length) return null;

  return (
    <section className="py-8 w-full relative overflow-hidden">
      <div className="flex flex-col md:flex-row items-baseline justify-between mb-8 px-4 md:px-6 gap-3">
        <div className="space-y-1 text-left">
          <h2 className="text-xl md:text-2xl  font-bold text-[var(--text-primary)] tracking-tight">
            {title}
          </h2>
          {subtitle && (
            <p className="text-[var(--text-secondary)] text-[11px] lg:text-[12px]  font-semibold tracking-tight opacity-40">
              {subtitle}
            </p>
          )}
        </div>
        <Link href="/discovery" className="flex items-center gap-2 group cursor-pointer">
           <div className="h-0.5 w-12 bg-[var(--accent)] rounded-full transition-all group-hover:w-16" />
           <span className="text-[11px] lg:text-[12px]  font-semibold  tracking-[0.3em] text-[var(--accent)]">Explore</span>
        </Link>
      </div>

      <div className="w-full px-4 md:px-6">
        <div className="grid grid-cols-2 gap-3 pb-8 md:grid-cols-3 md:gap-4 lg:grid-cols-6 xl:grid-cols-6 2xl:grid-cols-6">
          {products.map((product, i) => (
            <div
              key={product._id || product.id || i}
              className="min-w-0"
            >
              <ProductCard product={product} layout="grid" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

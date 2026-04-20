"use client";
import React from 'react';
import ProductCard from '@/components/ProductCard';

export default function ProductSection({ title, subtitle, data, config }) {
  if (!data?.length) return null;

  const isCarousel = config?.layout === 'carousel';

  return (
    <section className="py-4 px-6 w-full mx-auto">
      <div className="flex flex-col items-center text-center mb-6">
        <h2 className="text-2xl md:text-3xl font-black text-[var(--text-primary)] tracking-tight mb-2">
          {title}
        </h2>
        {subtitle && (
          <p className="text-[var(--text-secondary)] text-[9px] md:text-[10px] font-bold uppercase tracking-widest max-w-2xl opacity-70">
            {subtitle}
          </p>
        )}
        <div className="h-1 w-12 md:w-16 bg-[var(--accent)] mt-3 md:mt-4 rounded-full" />
      </div>

      <div className={`grid ${isCarousel ? 'flex overflow-x-auto no-scrollbar pb-8 snap-x' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'} gap-3 md:gap-5`}>
        {data.map((item, i) => {
          const p = item.product_id;
          if (!p) return null;
          
          return (
            <div key={i} className={isCarousel ? 'w-[220px] flex-shrink-0 snap-start' : 'w-full'}>
              <ProductCard product={p} />
            </div>
          );
        })}
      </div>
    </section>
  );
}

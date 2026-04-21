"use client";
import React from 'react';
import ProductCard from '@/components/ProductCard';
import Link from 'next/link';

export default function ProductSection({ title, subtitle, data, config }) {
  if (!data?.length) return null;

  const isCarousel = config?.layout === 'carousel';

  return (
    <section className="py-8 w-full relative overflow-hidden">
      <div className="flex flex-col md:flex-row items-baseline justify-between mb-8 px-4 md:px-6 gap-3">
        <div className="space-y-1 text-left">
          <h2 className="text-xl md:text-2xl font-black text-[var(--text-primary)] tracking-tight">
            {title}
          </h2>
          {subtitle && (
            <p className="text-[var(--text-secondary)] text-[10px] font-black uppercase tracking-widest opacity-40">
              {subtitle}
            </p>
          )}
        </div>
        <Link href="/discovery" className="flex items-center gap-2 group cursor-pointer">
           <div className="h-0.5 w-12 bg-[var(--accent)] rounded-full transition-all group-hover:w-16" />
           <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--accent)]">Explore</span>
        </Link>
      </div>

      <div className="relative group/carousel w-full">
        <div className="flex overflow-x-auto no-scrollbar pb-8 snap-x snap-mandatory gap-4 md:gap-6 px-4 md:px-6">
          {data.map((item, i) => {
            const p = item.product_id;
            if (!p) return null;
            
            const isFeatured = title.toLowerCase().includes('featured');
            
            return (
              <div 
                key={i} 
                className={`flex-shrink-0 snap-start transition-transform duration-500 hover:scale-[1.02] ${
                  isFeatured 
                  ? 'w-[calc(50%-0.75rem)] sm:w-[45%] md:w-[25%] lg:w-[calc(14.28%-1.25rem)]' 
                  : 'w-[75%] sm:w-[45%] md:w-[30%] lg:w-[calc(20%-1.25rem)]'
                }`}
              >
                <ProductCard product={p} />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

"use client";
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export default function CategoryCarousel({ title, data }) {
  if (!data?.length) return null;

  return (
    <section className="w-full py-3 sm:py-4 lg:py-5">
      <div className="mb-3 flex items-end justify-between gap-3 px-3 sm:px-4 md:mb-4 md:px-1">
        <div className="min-w-0">
          <h2 className="truncate font-[var(--font-poppins)] text-[18px] font-semibold leading-tight tracking-normal text-[var(--text-primary)] sm:text-xl md:text-2xl">
            {title || "Shop by Category"}
          </h2>
        </div>
        <Link
          href="/shop"
          className="group inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full border border-[var(--accent)]/25 bg-[var(--accent)]/10 px-3 font-[var(--font-poppins)] text-[11px] font-semibold text-[var(--accent)] transition hover:border-[var(--accent)]/45 hover:bg-[var(--accent)] hover:text-white active:scale-[0.98] sm:h-10 sm:px-4 sm:text-[12px]"
        >
          <span>Browse</span>
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5 sm:size-4" />
        </Link>
      </div>

      <div className="flex gap-3 overflow-x-auto no-scrollbar px-0 pb-4 snap-x snap-mandatory md:gap-4 md:px-1 md:pb-5">
        {data.map((cat, i) => (
          <Link 
            key={i} 
            href={`/shop?category=${cat.category_name}`}
            className="group w-[38vw] max-w-[168px] flex-shrink-0 snap-start sm:w-[24vw] md:w-[178px] lg:w-[190px]"
          >
            <div className="relative aspect-square overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)] shadow-sm transition-all duration-300 group-hover:border-[var(--accent)]/30 group-hover:shadow-lg">
              <img 
                src={cat.image_url || 'https://via.placeholder.com/200'} 
                className="size-full object-cover transition-transform duration-500 group-hover:scale-105" 
                alt={cat.category_name}
              />
              <div className="absolute inset-x-0 bottom-0 p-3 md:p-4 bg-gradient-to-t from-black/60 to-transparent">
                <span className="block truncate px-1 text-center font-[var(--font-poppins)] text-[11px] font-semibold tracking-normal text-white md:px-2 md:text-[12px]">
                  {cat.category_name}
                </span>
              </div>
            </div>
            <p className="mt-2 truncate px-1 text-center font-[var(--font-poppins)] text-[11px] font-semibold tracking-normal text-[var(--text-primary)] opacity-80 transition-opacity group-hover:opacity-100 md:px-2 md:text-[12px]">
              {cat.category_name}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}

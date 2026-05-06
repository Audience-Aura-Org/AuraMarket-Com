"use client";
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export default function CategoryCarousel({ title, data }) {
  if (!data?.length) return null;

  return (
    <section className="py-4 px-6 max-w-7xl mx-auto">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h2 className="text-xl md:text-3xl font-quicksand font-bold text-[var(--text-primary)] tracking-tight">
            {title || "Shop by Category"}
          </h2>
          <div className="h-1 w-12 md:w-20 bg-[var(--accent)] mt-1 md:mt-2 rounded-full" />
        </div>
        <Link href="/overtime" className="text-[var(--accent)] text-xs md:text-base font-quicksand font-bold flex items-center gap-1 md:gap-2 hover:translate-x-1 transition-transform group shrink-0">
          Browse All <ChevronRight className="w-4 h-4 md:w-5 md:h-5" />
        </Link>
      </div>

      <div className="flex gap-4 md:gap-6 overflow-x-auto no-scrollbar pb-6 snap-x snap-mandatory">
        {data.map((cat, i) => (
          <Link 
            key={i} 
            href={`/shop?category=${cat.category_name}`}
            className="flex-shrink-0 w-32 md:w-48 snap-start group"
          >
            <div className="relative aspect-square rounded-[1.5rem] md:rounded-[2.rem] overflow-hidden bg-[var(--bg-primary)] border border-[var(--glass-border)] shadow-sm group-hover:shadow-xl group-hover:border-[var(--accent)]/30 transition-all duration-500">
              <img 
                src={cat.image_url || 'https://via.placeholder.com/200'} 
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                alt={cat.category_name}
              />
              <div className="absolute inset-x-0 bottom-0 p-3 md:p-4 bg-gradient-to-t from-black/60 to-transparent">
                <span className="text-white font-quicksand font-bold text-center block text-[10px] lg:text-[12px] md:text-sm truncate whitespace-nowrap px-1 md:px-2 tracking-tight">
                  {cat.category_name}
                </span>
              </div>
            </div>
            <p className="mt-3 text-center font-quicksand font-bold text-[var(--text-primary)] opacity-80 group-hover:opacity-100 transition-opacity truncate whitespace-nowrap px-1 md:px-2 text-[11px] lg:text-[12px] md:text-base">
              {cat.category_name}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}

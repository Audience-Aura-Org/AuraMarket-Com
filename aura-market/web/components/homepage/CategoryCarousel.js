"use client";
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export default function CategoryCarousel({ title, data }) {
  if (!data?.length) return null;

  return (
    <section className="py-4 px-6 max-w-7xl mx-auto">
      <div className="flex items-end justify-between mb-6">
        <div>
          <h2 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">
            {title || "Shop by Category"}
          </h2>
          <div className="h-1 w-20 bg-[var(--accent)] mt-2 rounded-full" />
        </div>
        <Link href="/shop" className="text-[var(--accent)] font-bold flex items-center gap-2 hover:translate-x-1 transition-transform group">
          Browse All <ChevronRight className="w-5 h-5" />
        </Link>
      </div>

      <div className="flex gap-6 overflow-x-auto no-scrollbar pb-6 snap-x snap-mandatory">
        {data.map((cat, i) => (
          <Link 
            key={i} 
            href={`/shop?category=${cat.category_name}`}
            className="flex-shrink-0 w-48 snap-start group"
          >
            <div className="relative aspect-square rounded-[2rem] overflow-hidden bg-[var(--bg-primary)] border border-[var(--glass-border)] shadow-sm group-hover:shadow-xl group-hover:border-[var(--accent)]/30 transition-all duration-500">
              <img 
                src={cat.image_url || 'https://via.placeholder.com/200'} 
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                alt={cat.category_name}
              />
              <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/60 to-transparent">
                <span className="text-white font-bold text-center block text-sm truncate whitespace-nowrap px-2">
                  {cat.category_name}
                </span>
              </div>
            </Link>
            <p className="mt-4 text-center font-bold text-[var(--text-primary)] opacity-80 group-hover:opacity-100 transition-opacity truncate whitespace-nowrap px-2">
              {cat.category_name}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}

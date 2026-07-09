"use client";
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

export default function CategoryCarousel({ title, data }) {
  const { t, label } = useLanguage();
  if (!data?.length) return null;

  const categoryHref = (cat) => {
    const params = new URLSearchParams();
    const rawCategoryId = cat.category_id || cat._id;
    const categoryId = rawCategoryId && typeof rawCategoryId === 'object' ? rawCategoryId._id : rawCategoryId;
    if (cat.category_name) params.set('category', cat.category_name);
    if (categoryId) params.set('categoryId', categoryId);
    return `/shop${params.toString() ? `?${params.toString()}` : ''}`;
  };

  return (
    <section className="w-full py-3 sm:py-4 lg:py-5">
      <div className="mb-3 flex items-end justify-between gap-3 px-3 sm:px-4 md:mb-4 md:px-1">
        <div className="min-w-0 flex items-center gap-2.5">
          <span className="w-4 h-[3px] bg-[var(--accent)] rounded-full shrink-0" />
          <h2 className="truncate font-[var(--font-poppins)] text-[18px] font-semibold leading-tight tracking-tight text-[var(--text-primary)] sm:text-xl md:text-2xl">
            {title ? label(title) : t('overtime.shopByCategory', 'Shop by Category')}
          </h2>
        </div>
        <Link
          href="/shop"
          className="group inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full border border-[var(--accent)]/25 bg-[var(--accent)]/10 px-3 font-[var(--font-poppins)] text-[11px] font-semibold text-[var(--accent)] transition hover:border-[var(--accent)]/45 hover:bg-[var(--accent)] hover:text-white active:scale-[0.98] sm:h-10 sm:px-4 sm:text-[12px]"
        >
          <span>{t('overtime.browse', 'Browse')}</span>
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5 sm:size-4" />
        </Link>
      </div>

      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-5 snap-x snap-mandatory md:gap-4 md:pb-6">
        <div className="w-1 shrink-0 md:hidden" aria-hidden="true" />
        {data.map((cat, i) => (
          <Link
            key={i}
            href={categoryHref(cat)}
            className="group w-[38vw] max-w-[172px] flex-shrink-0 snap-start sm:w-[24vw] md:w-[182px] lg:w-[194px]"
          >
            <div className="relative aspect-square overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)] shadow-sm transition-all duration-300 group-hover:border-[var(--accent)]/35 group-hover:shadow-xl group-hover:-translate-y-1">
              <img
                src={cat.image_url || 'https://via.placeholder.com/200'}
                className="size-full object-cover transition-transform duration-700 group-hover:scale-110"
                alt={cat.category_name}
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/5 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-3 md:p-4">
                <span className="block truncate text-center font-[var(--font-poppins)] text-[11px] font-bold tracking-tight text-white drop-shadow md:text-[12px]">
                  {label(cat.category_name)}
                </span>
              </div>
            </div>
          </Link>
        ))}
        <div className="w-1 shrink-0 md:hidden" aria-hidden="true" />
      </div>
    </section>
  );
}

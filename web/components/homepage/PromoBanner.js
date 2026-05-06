"use client";
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';

export default function PromoBanner({ data }) {
  const router = useRouter();
  if (!data?.length) return null;
  
  // Usually, a promo banner section is one large block or a split 2-column block
  const banner = data[0];

  return (
    <section className="w-full">
      <div 
        className="relative min-h-[400px] overflow-hidden flex items-center group cursor-pointer shadow-lg"
        onClick={() => banner.link_to && router.push(banner.link_to)}
      >
        <img 
          src={banner.image_url} 
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" 
          alt={banner.headline}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/30 to-transparent z-10" />
        
        <div className="relative z-20 px-12 py-12 max-w-xl ml-4 md:ml-12 transition-transform duration-700 group-hover:translate-x-2">
          <div className="liquid-glass p-10 md:p-14 rounded-[3rem] border border-white/10 space-y-6">
            <span className="inline-block px-4 py-1 rounded-full bg-[var(--accent)] text-white text-[11px] lg:text-[12px] font-bold tracking-tight mb-2">
              Limited Offer
            </span>
            {banner.headline && (
              <h2 className="text-4xl md:text-6xl font-bold text-white leading-[1.1] tracking-tight">
                {banner.headline}
              </h2>
            )}
            {banner.subtext && (
              <p className="text-lg text-white/80 font-medium">
                {banner.subtext}
              </p>
            )}
            {banner.cta_text && (
              <button className="flex items-center gap-3 bg-white text-black px-10 py-4 rounded-2xl font-bold text-sm hover:bg-[var(--accent)] hover:text-white transition-all transform active:scale-95 shadow-xl">
                {banner.cta_text} <ArrowRight className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

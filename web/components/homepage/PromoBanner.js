"use client";
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';

export default function PromoBanner({ data }) {
  const router = useRouter();
  if (!data?.length) return null;

  const banner = data[0];

  return (
    <section className="w-full">
      <div
        className="relative overflow-hidden flex items-end md:items-center cursor-pointer group min-h-[340px] md:min-h-[440px]"
        onClick={() => banner.link_to && router.push(banner.link_to)}
      >
        {/* Background */}
        <img
          src={banner.image_url}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1200ms] group-hover:scale-105"
          alt={banner.headline}
          loading="lazy"
        />
        {/* Gradient — stronger on mobile (bottom-up) + side tint on desktop */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/5 md:bg-gradient-to-r md:from-black/85 md:via-black/35 md:to-transparent z-10" />

        {/* Content */}
        <div className="relative z-20 px-6 sm:px-10 md:px-16 py-8 md:py-16 w-full md:max-w-xl md:ml-4 transition-transform duration-700 group-hover:translate-y-[-4px] md:group-hover:translate-x-2 md:group-hover:translate-y-0">
          <span className="inline-block px-3.5 py-1 rounded-full bg-[var(--accent)] text-white text-[10px] font-bold tracking-tight uppercase mb-4">
            Limited Offer
          </span>
          {banner.headline && (
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-[1.05] tracking-tighter font-quicksand mb-4">
              {banner.headline}
            </h2>
          )}
          {banner.subtext && (
            <p className="text-sm md:text-base text-white/75 font-medium leading-relaxed mb-7 max-w-sm">
              {banner.subtext}
            </p>
          )}
          {banner.cta_text && (
            <button className="group/btn inline-flex items-center gap-3 bg-white text-black px-7 py-3.5 rounded-2xl font-bold text-sm hover:bg-[var(--accent)] hover:text-white transition-all active:scale-95 shadow-xl">
              {banner.cta_text}
              <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

export default function Hero({ data, config }) {
  const router = useRouter();
  const { t, label } = useLanguage();
  const [current, setCurrent] = useState(0);
  const [isChanging, setIsChanging] = useState(false);

  useEffect(() => {
    if (config?.autoplay && data.length > 1) {
      const timer = setInterval(() => handleNext(), config.interval || 5000);
      return () => clearInterval(timer);
    }
  }, [data.length, config, current]);

  const handleNext = () => {
    if (isChanging) return;
    setIsChanging(true);
    setTimeout(() => {
      setCurrent(prev => (prev === data.length - 1 ? 0 : prev + 1));
      setIsChanging(false);
    }, 500);
  };

  const handlePrev = () => {
    if (isChanging) return;
    setIsChanging(true);
    setTimeout(() => {
      setCurrent(prev => (prev === 0 ? data.length - 1 : prev - 1));
      setIsChanging(false);
    }, 500);
  };

  if (!data?.length) return null;

  return (
    <section className="relative w-full overflow-hidden group select-none">
      {/* Full-height immersive hero */}
      <div className="relative h-[72dvh] min-h-[440px] md:h-[88dvh] md:min-h-[600px] bg-[#060408]">
        {data.map((banner, i) => (
          <div
            key={i}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${i === current ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          >
            {/* Background with slow zoom */}
            <div className={`absolute inset-0 transition-transform duration-[12000ms] ease-out ${i === current ? 'scale-100' : 'scale-110'}`}>
              <img
                src={banner.image_url}
                className="w-full h-full object-cover"
                alt={banner.headline}
                loading={i === 0 ? 'eager' : 'lazy'}
              />
              {/* Cinematic multi-layer gradient */}
              <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/45 to-black/5" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/10" />
            </div>

            {/* Content — bottom-aligned on mobile, center on desktop */}
            <div className="absolute inset-0 z-20 flex items-end md:items-center px-5 sm:px-10 md:px-16 lg:px-28 pb-20 md:pb-0">
              <div className={`w-full max-w-xl md:max-w-2xl transition-all duration-700 delay-200 ${i === current ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
                {/* Eyebrow */}
                <div className="flex items-center gap-2.5 mb-5 md:mb-7">
                  <span className="w-8 h-[2px] bg-[var(--accent)] rounded-full" />
                  <span className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.28em] text-white/55">
                    {t('overtime.newArrival', 'New Arrival')}
                  </span>
                </div>

                {/* Headline */}
                <h1 className="text-[2rem] sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-[1.02] tracking-tighter drop-shadow-2xl font-quicksand mb-4 md:mb-6">
                  {label(banner.headline)}
                </h1>

                {/* Subtext */}
                {banner.subtext && (
                  <p className="text-sm md:text-lg text-white/65 font-medium leading-relaxed max-w-md mb-7 md:mb-10 line-clamp-2 md:line-clamp-none">
                    {label(banner.subtext)}
                  </p>
                )}

                {/* CTA */}
                <button
                  onClick={() => router.push(banner.link_to || '/shop')}
                  className="group inline-flex items-center gap-3 bg-white text-black px-7 sm:px-10 py-3.5 sm:py-4 rounded-2xl font-bold text-sm shadow-2xl hover:bg-[var(--accent)] hover:text-white transition-all active:scale-95"
                >
                  <span className="whitespace-nowrap">
                    {banner.cta_text ? label(banner.cta_text) : t('overtime.exploreCollection', 'Explore Collection')}
                  </span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* Arrow navigation */}
        {data.length > 1 && (
          <>
            <div className="absolute top-1/2 -translate-y-1/2 inset-x-3 md:inset-x-8 z-30 flex justify-between pointer-events-none">
              <button
                onClick={handlePrev}
                className="pointer-events-auto size-9 md:size-14 flex items-center justify-center rounded-xl md:rounded-2xl bg-white/8 backdrop-blur-md border border-white/10 text-white opacity-0 group-hover:opacity-100 transition-all hover:bg-[var(--accent)] hover:border-[var(--accent)]/50 -translate-x-3 group-hover:translate-x-0"
              >
                <ChevronLeft className="w-4 h-4 md:w-6 md:h-6" />
              </button>
              <button
                onClick={handleNext}
                className="pointer-events-auto size-9 md:size-14 flex items-center justify-center rounded-xl md:rounded-2xl bg-white/8 backdrop-blur-md border border-white/10 text-white opacity-0 group-hover:opacity-100 transition-all hover:bg-[var(--accent)] hover:border-[var(--accent)]/50 translate-x-3 group-hover:translate-x-0"
              >
                <ChevronRight className="w-4 h-4 md:w-6 md:h-6" />
              </button>
            </div>

            {/* Pagination — left-aligned below content */}
            <div className="absolute bottom-6 md:bottom-10 left-5 sm:left-10 md:left-16 lg:left-28 z-30 flex items-center gap-4">
              <div className="flex gap-2 items-center">
                {data.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrent(i)}
                    className={`h-[3px] transition-all duration-500 rounded-full ${i === current ? 'bg-[var(--accent)] w-8 md:w-10' : 'bg-white/30 w-3 hover:bg-white/55'}`}
                  />
                ))}
              </div>
              <span className="text-[10px] font-semibold text-white/40 tracking-tight hidden sm:inline">
                {String(current + 1).padStart(2, '0')} / {String(data.length).padStart(2, '0')}
              </span>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

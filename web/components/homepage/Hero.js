"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, ArrowRight, Sparkles } from 'lucide-react';

export default function Hero({ data, config }) {
  const router = useRouter();
  const [current, setCurrent] = useState(0);
  const [isChanging, setIsChanging] = useState(false);

  useEffect(() => {
    if (config?.autoplay && data.length > 1) {
      const timer = setInterval(() => {
        handleNext();
      }, config.interval || 5000);
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
      <div className="relative h-[400px] md:h-[520px] bg-[#0a050c]">
        {data.map((banner, i) => (
          <div 
            key={i} 
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${i === current ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          >
            {/* Background Image with optimized scale effect */}
            <div className={`absolute inset-0 transition-transform duration-[10000ms] ease-out ${i === current ? 'scale-100' : 'scale-110'}`}>
              <img 
                src={banner.image_url} 
                className="w-full h-full object-cover" 
                alt={banner.headline}
              />
              <div className="absolute inset-0 bg-gradient-to-tr from-black/80 via-black/40 to-transparent" />
            </div>

            {/* Premium Content Card */}
            <div className="absolute inset-0 z-20 flex items-center justify-start px-4 sm:px-8 md:px-20">
              <div className={`w-full sm:max-w-2xl transition-all duration-700 delay-300 ${i === current ? 'translate-x-0 opacity-100 block' : '-translate-x-12 opacity-0 hidden'}`}>
                <div className="liquid-glass p-6 sm:p-8 md:p-12 rounded-[1.5rem] sm:rounded-[2.5rem] space-y-4 md:space-y-6">
                  <div className="flex items-center gap-3 text-[var(--accent)] font-bold text-[8px] md:text-[10px]  tracking-[0.3em] mb-1 md:mb-2">
                    <Sparkles className="w-3 h-3 md:w-4 md:h-4 animate-pulse" />
                    <span>Exclusive Release</span>
                  </div>
                  
                  <h1 className="text-2xl sm:text-4xl md:text-6xl font-bold text-white leading-[1.1] tracking-tight drop-shadow-2xl">
                    {banner.headline}
                  </h1>
                  
                  <p className="text-xs md:text-lg text-white/80 font-medium leading-relaxed max-w-lg line-clamp-3 sm:line-clamp-none">
                    {banner.subtext}
                  </p>
                  
                  <div className="pt-2 md:pt-4">
                    <button 
                      onClick={() => router.push(banner.link_to || '/overtime')}
                      className="group bg-white text-black px-6 sm:px-10 py-3 sm:py-4 rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm shadow-2xl hover:bg-[var(--accent)] hover:text-white transition-all flex items-center gap-3 tracking-tight active:scale-95"
                    >
                      <span className="whitespace-nowrap">{banner.cta_text || 'Explore Collection'}</span>
                      <ArrowRight className="w-4 h-4 md:w-5 md:h-5 group-hover:translate-x-2 transition-transform" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Dynamic Interactive Navigation */}
        {data.length > 1 && (
          <>
            <div className="absolute top-1/2 -translate-y-1/2 inset-x-8 z-30 flex justify-between pointer-events-none">
              <button 
                onClick={handlePrev} 
                className="pointer-events-auto w-14 h-14 flex items-center justify-center rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 text-white opacity-0 group-hover:opacity-100 transition-all hover:bg-[var(--accent)] hover:border-[var(--accent)]/50 -translate-x-4 group-hover:translate-x-0"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button 
                onClick={handleNext} 
                className="pointer-events-auto w-14 h-14 flex items-center justify-center rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 text-white opacity-0 group-hover:opacity-100 transition-all hover:bg-[var(--accent)] hover:border-[var(--accent)]/50 translate-x-4 group-hover:translate-x-0"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>

            {/* Premium Mini-Pills Pagination */}
            <div className="absolute bottom-10 right-20 z-30 flex items-center gap-4">
               <div className="h-[2px] w-24 bg-white/10 relative overflow-hidden hidden md:block">
                  <div 
                    className="absolute top-0 left-0 h-full bg-[var(--accent)] transition-all duration-700"
                    style={{ width: `${((current + 1) / data.length) * 100}%` }}
                  />
               </div>
               <div className="flex gap-2">
                {data.map((_, i) => (
                  <button 
                    key={i} 
                    onClick={() => setCurrent(i)}
                    className={`h-1.5 transition-all duration-500 rounded-full ${i === current ? 'bg-[var(--accent)] w-10' : 'bg-white/20 w-3 hover:bg-white/40'}`}
                  />
                ))}
               </div>
               <span className="text-[11px] font-bold text-white/40 tracking-tight ml-2 hidden md:inline">
                  {String(current + 1).padStart(2, '0')} / {String(data.length).padStart(2, '0')}
               </span>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

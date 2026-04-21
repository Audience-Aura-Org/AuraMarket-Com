"use client";
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Heart, ShoppingBag, MessageCircle, 
  ChevronLeft, ChevronRight, Play, Pause, 
  Flame 
} from 'lucide-react';
import { useChat } from '@/context/ChatContext';
import api from '@/services/api';

export default function StatusViewer({ initialStatuses, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const videoRef = useRef(null);
  const { openChat } = useChat();

  const currentStatus = initialStatuses[currentIndex];
  const total = initialStatuses.length;
  const duration = currentStatus?.type === 'video' ? 30000 : 5000; // default 5s for image

  // View state tracking
  useEffect(() => {
    if (currentStatus) {
      api.post(`/statuses/${currentStatus._id}/view`).catch(console.error);
      setIsLiked(currentStatus.isLiked || false);
    }
  }, [currentStatus]);

  // Timer loop
  useEffect(() => {
    if (!isPlaying) return;
    
    const interval = 100;
    const step = (interval / duration) * 100;

    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) return 100;
        return prev + step;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [currentIndex, isPlaying, duration]);

  // Handle completion side-effect safely outside of the setState callback
  useEffect(() => {
    if (progress >= 100) {
      handleNext();
    }
  }, [progress]);

  const handleNext = () => {
    if (currentIndex < total - 1) {
      setCurrentIndex(prev => prev + 1);
      setProgress(0);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setProgress(0);
    }
  };

  const toggleLike = async () => {
    try {
      await api.post(`/statuses/${currentStatus._id}/react`);
      setIsLiked(!isLiked);
    } catch (e) { console.error(e); }
  };

  const handleChat = () => {
    const vName = currentStatus.vendor_id?.store_name || 'Vendor';
    const msg = `Hi, I saw this on your status 👇`;
    openChat(currentStatus.vendor_id?.user_id?._id, currentStatus.linked_product, { 
      store_name: vName,
      initialMessage: msg 
    });
    onClose();
  };

  const handleViewProduct = () => {
    if (currentStatus.linked_product) {
      window.location.href = `/products/${currentStatus.linked_product._id || currentStatus.linked_product}`;
    }
  };

  if (!currentStatus) return null;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[1000] bg-black flex items-center justify-center overflow-hidden touch-none"
    >
      <div className="relative w-full h-full max-w-lg mx-auto bg-[#080808]">
        
        {/* Progress Bars */}
        <div className="absolute top-4 inset-x-4 z-50 flex gap-1">
          {initialStatuses.map((_, i) => (
            <div key={i} className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden">
              <div 
                className="h-full bg-white transition-all duration-100 ease-linear"
                style={{ width: `${i < currentIndex ? 100 : i === currentIndex ? progress : 0}%` }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-8 inset-x-4 z-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-full border-2 border-white/20 overflow-hidden bg-black/40">
              <img src={currentStatus.vendor_id?.user_id?.avatar || currentStatus.vendor_id?.user_id?.branding?.logo} alt="" className="size-full object-cover" />
            </div>
            <div>
              <p className="text-sm font-black text-white uppercase tracking-tighter">{currentStatus.vendor_id?.store_name}</p>
              <p className="text-[10px] text-white/60 font-bold uppercase tracking-widest">Aura Verified Node</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-white/80 hover:text-white transition-all">
            <X className="size-6" />
          </button>
        </div>

        {/* Content */}
        <div 
          className="w-full h-full flex items-center justify-center"
          onMouseDown={() => setIsPlaying(false)}
          onMouseUp={() => setIsPlaying(true)}
          onTouchStart={() => setIsPlaying(false)}
          onTouchEnd={() => setIsPlaying(true)}
        >
          {currentStatus.type === 'video' ? (
            <video 
              ref={videoRef}
              src={currentStatus.content_url}
              autoPlay 
              playsInline
              className="w-full h-full object-contain"
              onEnded={handleNext}
            />
          ) : currentStatus.type === 'image' ? (
            <img 
              src={currentStatus.content_url} 
              alt="" 
              className="w-full h-full object-contain"
            />
          ) : (
             <div className="p-12 text-center text-2xl font-black italic uppercase text-white bg-gradient-to-br from-[var(--accent)] to-[#111] size-full flex items-center justify-center">
               {currentStatus.text_content}
             </div>
          )}

          {/* Navigation Overlay */}
          <div className="absolute inset-x-0 inset-y-20 flex">
            <div className="flex-1 cursor-pointer" onClick={handlePrev} />
            <div className="flex-1 cursor-pointer" onClick={handleNext} />
          </div>
        </div>

        {/* Interaction Footer */}
        <div className="absolute bottom-0 inset-x-0 p-6 pb-12 bg-gradient-to-t from-black via-black/60 to-transparent z-50">
          
          {currentStatus.caption && (
            <p className="text-sm text-white font-medium mb-6 line-clamp-3 bg-black/20 backdrop-blur-md p-3 rounded-2xl border border-white/5 shadow-2xl">
              {currentStatus.caption}
            </p>
          )}

          <div className="flex items-center gap-3">
             <button 
                onClick={toggleLike}
                className={`flex-1 h-14 rounded-2xl border flex items-center justify-center gap-2 transition-all ${isLiked ? 'bg-red-500 border-red-500 text-white' : 'bg-white/10 border-white/10 text-white hover:bg-white/20'}`}
             >
                <Heart className={`size-5 ${isLiked ? 'fill-current' : ''}`} />
                <span className="text-[10px] font-black uppercase tracking-widest">{isLiked ? 'Liked' : 'React'}</span>
             </button>

             {currentStatus.linked_product && (
               <button 
                  onClick={handleViewProduct}
                  className="flex-[2] h-14 rounded-2xl bg-[var(--accent)] border border-[var(--accent)] text-white flex items-center justify-center gap-3 shadow-lg shadow-[var(--accent)]/30 active:scale-95 transition-all group"
               >
                  <ShoppingBag className="size-5 group-hover:scale-110 transition-transform" />
                  <span className="text-[11px] font-black uppercase tracking-widest">View Product</span>
               </button>
             )}

             <button 
                onClick={handleChat}
                className={`h-14 rounded-2xl bg-white/10 border border-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-all ${currentStatus.linked_product ? 'flex-1' : 'flex-[3]'}`}
             >
                <MessageCircle className={`size-6 ${currentStatus.linked_product ? '' : 'mr-2'}`} />
                {!currentStatus.linked_product && <span className="text-[10px] font-black uppercase tracking-widest">Chat with Vendor</span>}
             </button>
          </div>

          <div className="mt-6 flex items-center justify-between px-2">
             <div className="flex items-center gap-2">
                <Flame className="size-4 text-[var(--accent)] animate-pulse" />
                <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">Trending Now</span>
             </div>
             <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em]">{currentIndex + 1} / {total}</p>
          </div>
        </div>
      </div>

      {/* Nav Controls (Desktop Only) */}
      <div className="hidden lg:flex fixed left-12 top-1/2 -translate-y-1/2 flex-col gap-4">
         <button onClick={handlePrev} className="size-12 rounded-full border border-white/20 flex items-center justify-center text-white hover:bg-white/10 transition-all"><ChevronLeft /></button>
      </div>
      <div className="hidden lg:flex fixed right-12 top-1/2 -translate-y-1/2 flex-col gap-4">
         <button onClick={handleNext} className="size-12 rounded-full border border-white/20 flex items-center justify-center text-white hover:bg-white/10 transition-all"><ChevronRight /></button>
      </div>

    </motion.div>
  );
}

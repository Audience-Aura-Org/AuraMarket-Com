'use client';
import { MessageCircle } from 'lucide-react';
export default function WhatsAppSupport() {
  return <a href="https://wa.me/237676935805" target="_blank" rel="noopener noreferrer"
    aria-label="Contact logistics support on WhatsApp"
    className="fixed left-[max(1rem,env(safe-area-inset-left))] bottom-[calc(6rem+env(safe-area-inset-bottom))] z-[450] inline-flex min-h-12 items-center gap-2 rounded-full bg-[#128C7E] px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-[#0f786b] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#128C7E]">
    <MessageCircle className="size-5" aria-hidden="true" /> WhatsApp
  </a>;
}

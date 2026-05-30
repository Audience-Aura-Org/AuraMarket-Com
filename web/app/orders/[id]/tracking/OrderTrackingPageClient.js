"use client";

import { useState } from 'react';
import { 
  Package, Truck, CheckCircle2, MapPin, 
  ArrowLeft, Phone, MessageCircle, AlertCircle,
  Clock, ShieldCheck
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function OrderTrackingPage() {
  const router = useRouter();
  const [activeStep] = useState(2); // 0: Pending, 1: Processing, 2: Shipped, 3: Delivered

  const steps = [
    { label: 'Order Placed', desc: 'Awaiting vendor confirmation', time: 'Oct 24, 10:00 AM' },
    { label: 'Processing', desc: 'Vendor is preparing your items', time: 'Oct 24, 11:30 AM' },
    { label: 'In Transit', desc: 'On its way with Bastos Logistics', time: 'Oct 25, 08:15 AM' },
    { label: 'Delivered', desc: 'Secure hand-over completed', time: '' },
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-24">
      {/* Mobile Header */}
      <div className="sticky top-0 z-50 bg-white/70 backdrop-blur-md px-4 py-4 flex items-center justify-between border-b border-gray-100">
        <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-gray-100 transition-colors"><ArrowLeft className="w-6 h-6" /></button>
        <h1 className=" font-bold text-gray-900">Track Order #8812</h1>
        <div className="w-10" /> {/* Spacer */}
      </div>

      <main className="max-w-xl mx-auto px-6 py-8">
        {/* Status Card */}
        <div className="glass p-8 rounded-[40px] mb-8 border border-white/60 shadow-xl shadow-indigo-100/50 relative overflow-hidden">
          <div className="absolute top-[-20%] right-[-10%] w-32 h-32 bg-indigo-500/10 rounded-full blur-[40px]" />
          
          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-3xl bg-indigo-600 flex items-center justify-center text-white mb-6 shadow-xl shadow-indigo-200 animate-pulse">
              <Truck className="w-10 h-10" />
            </div>
            <h2 className="text-2xl  font-bold text-gray-900">In Transit</h2>
            <p className="text-gray-500 font-medium mt-1">Expected Delivery: <span className="text-gray-900  font-bold">Today, Oct 26</span></p>
          </div>
        </div>

        {/* Timeline */}
        <div className="space-y-10 pl-4 relative">
          {/* Vertical Line */}
          <div className="absolute left-[33px] top-4 bottom-4 w-1 bg-gray-100 rounded-full" />
          
          {steps.map((s, i) => (
            <div key={i} className="flex gap-8 relative group">
              <div className={`z-10 w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center border-4 border-white shadow-md transition-all ${
                i <= activeStep ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-300'
              }`}>
                {i < activeStep ? <CheckCircle2 className="w-5 h-5" /> : (i === activeStep ? <div className="w-2.5 h-2.5 rounded-full bg-white animate-ping" /> : <div className="w-2.5 h-2.5 rounded-full bg-gray-400" />)}
              </div>
              
              <div className="flex-1">
                <div className="flex justify-between items-baseline mb-1">
                  <h4 className={` font-bold  tracking-tight ${i <= activeStep ? 'text-gray-900' : 'text-gray-300'}`}>{s.label}</h4>
                  <span className="text-[11px] lg:text-[12px]  font-semibold text-gray-300  tracking-tight">{s.time}</span>
                </div>
                <p className={`text-sm font-medium leading-relaxed ${i <= activeStep ? 'text-gray-500' : 'text-gray-200'}`}>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Action Controls */}
        <div className="mt-12 space-y-4">
           <div className="p-6 rounded-[32px] bg-white border border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-400"><MapPin className="w-6 h-6" /></div>
                <div>
                   <p className="text-[11px] lg:text-[12px]  font-semibold text-gray-300 ">Live Location</p>
                   <p className=" font-bold text-gray-900">Bastos District, YDE</p>
                </div>
              </div>
              <button className="px-5 py-2.5 bg-indigo-50 text-indigo-700  font-bold rounded-xl text-xs">View Map</button>
           </div>

           <div className="grid grid-cols-2 gap-4">
              <button className="p-5 rounded-[32px] bg-white border border-gray-100 flex flex-col items-center justify-center gap-3 group hover:bg-indigo-50 transition-all">
                <Phone className="w-6 h-6 text-gray-400 group-hover:text-indigo-600" />
                <span className="text-xs  font-bold text-gray-900 ">Call Driver</span>
              </button>
              <button className="p-5 rounded-[32px] bg-white border border-gray-100 flex flex-col items-center justify-center gap-3 group hover:bg-purple-50 transition-all">
                <MessageCircle className="w-6 h-6 text-gray-400 group-hover:text-purple-600" />
                <span className="text-xs  font-bold text-gray-900 ">Chat Dealer</span>
              </button>
           </div>
        </div>

        {/* Security / Escrow Info */}
        <div className="mt-10 p-6 rounded-[32px] bg-green-50/50 border border-green-100 flex items-center gap-4">
           <ShieldCheck className="w-10 h-10 text-green-600" />
           <p className="text-xs  font-bold text-green-800 leading-relaxed">
             Funds for this order are held in Aura Escrow. Please only click "Complete Delivery" once you have the item in hand and are satisfied.
           </p>
        </div>
      </main>
    </div>
  );
}

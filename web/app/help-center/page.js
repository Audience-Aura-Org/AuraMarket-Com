"use client";

import { useState } from "react";
import { Search, ChevronDown, Package, Shield, Store, CreditCard, Mail, Sparkles } from "lucide-react";

const faqs = [
  {
    category: "Orders & Shipping",
    icon: Package,
    questions: [
      { q: "How do I track my order?", a: "You can track your order in the 'My Orders' section of your profile. Once shipped, a tracking link will be provided." },
      { q: "What are the delivery times?", a: "Delivery typically takes 2-5 business days for domestic orders and 7-14 for international, depending on the vendor." }
    ]
  },
  {
    category: "Payments & Refunds",
    icon: CreditCard,
    questions: [
      { q: "What payment methods are accepted?", a: "We accept all major credit cards, Aura Wallet balances, and selected cryptocurrencies." },
      { q: "How do refunds work?", a: "Refunds are processed back to your original payment method within 5-7 business days after a dispute is resolved or a return is accepted." }
    ]
  },
  {
    category: "Selling on Aura",
    icon: Store,
    questions: [
      { q: "How do I become a verified artisan?", a: "Navigate to the 'Become a Vendor' page to submit your application. Our team reviews all applications within 48 hours." },
      { q: "What are the marketplace fees?", a: "Auradime charges a flat 5% commission on all successful sales, with zero listing fees." }
    ]
  },
  {
    category: "Account & Security",
    icon: Shield,
    questions: [
      { q: "How do I secure my account?", a: "We strongly recommend enabling Two-Factor Authentication (2FA) in your Account Settings." },
      { q: "Can I merge multiple accounts?", a: "Currently, we do not support account merging. Please choose one primary account for all your transactions." }
    ]
  }
];

export default function HelpCenter() {
  const [search, setSearch] = useState("");
  const [openQ, setOpenQ] = useState(null);

  const toggleQ = (id) => {
    setOpenQ(openQ === id ? null : id);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)] overflow-hidden md:pt-0" style={{ paddingTop: 'calc(80px + env(safe-area-inset-top, 0px))' }}>
      {/* Hero Section */}
      <div className="relative pt-32 pb-20 px-6 lg:px-20 bg-[var(--bg-primary)] border-b border-[var(--glass-border)]">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[var(--accent)]/10 blur-[100px] pointer-events-none rounded-full" />
        
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl  font-bold tracking-tighter text-[var(--text-primary)] mb-6 ">
            How can we <span className="text-[var(--accent)]">help you?</span>
          </h1>
          <p className="text-[var(--text-secondary)] text-lg mb-10 max-w-2xl mx-auto">
            Search our knowledge base or browse categories below to find answers to your questions.
          </p>
          
          {/* Search Bar */}
          <div className="relative max-w-2xl mx-auto group">
            <div className="absolute inset-0 bg-gradient-to-r from-[var(--accent)] to-emerald-400 rounded-2xl blur-lg opacity-20 group-hover:opacity-40 transition-opacity duration-500" />
            <div className="relative bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl flex items-center p-2 shadow-2xl">
              <Search className="size-6 text-[var(--text-secondary)] ml-4" />
              <input 
                type="text" 
                placeholder="Search articles, topics, or keywords..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 bg-transparent border-none outline-none px-4 py-3 !text-base placeholder:!text-base text-[var(--text-primary)] font-medium"
              />
              <button className="bg-[var(--accent)] text-white px-6 py-3 rounded-xl  font-bold hover:shadow-lg shadow-[var(--accent)]/20 transition-all tracking-normal text-xs">
                Search
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
          {faqs.map((category, cIdx) => (
            <div key={cIdx} className="bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-3xl p-8 hover:border-[var(--accent)]/50 transition-colors duration-500 group">
              <div className="flex items-center gap-4 mb-8">
                <div className="size-12 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center group-hover:bg-[var(--accent)]/10 group-hover:text-[var(--accent)] transition-all">
                  <category.icon className="size-6" />
                </div>
                <h2 className="text-2xl  font-bold text-[var(--text-primary)] tracking-tight">{category.category}</h2>
              </div>
              
              <div className="space-y-4">
                {category.questions.filter(q => q.q.toLowerCase().includes(search.toLowerCase()) || q.a.toLowerCase().includes(search.toLowerCase())).map((q, qIdx) => {
                  const id = `${cIdx}-${qIdx}`;
                  const isOpen = openQ === id;
                  return (
                    <div key={qIdx} className="border border-[var(--glass-border)] rounded-2xl overflow-hidden bg-[var(--bg-secondary)]/50">
                      <button 
                        onClick={() => toggleQ(id)}
                        className="w-full flex items-center justify-between p-5 text-left focus:outline-none"
                      >
                        <span className=" font-bold text-[var(--text-primary)]">{q.q}</span>
                        <ChevronDown className={`size-5 text-[var(--text-secondary)] transition-transform duration-300 ${isOpen ? "rotate-180 text-[var(--accent)]" : ""}`} />
                      </button>
                      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? "max-h-40 border-t border-[var(--glass-border)] opacity-100" : "max-h-0 opacity-0"}`}>
                        <p className="p-5 text-[var(--text-secondary)] text-sm leading-relaxed">
                          {q.a}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Contact Support Banner */}
        <div className="mt-20 relative rounded-3xl overflow-hidden bg-[var(--bg-primary)] border border-[var(--glass-border)] p-10 text-center flex flex-col items-center justify-center">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[var(--accent)]/5 pointer-events-none" />
          <div className="size-16 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center mb-6">
            <Mail className="size-8" />
          </div>
          <h3 className="text-3xl  font-bold text-[var(--text-primary)] mb-4">Still need help?</h3>
          <p className="text-[var(--text-secondary)] max-w-md mx-auto mb-8">
            Our support team is available 24/7 to assist you with any questions or concerns.
          </p>
          <button className="px-8 py-4 bg-[var(--accent)] text-white rounded-xl  font-bold tracking-tight text-xs hover:shadow-lg shadow-[var(--accent)]/30 transition-all flex items-center gap-2">
            Contact Support <Sparkles className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

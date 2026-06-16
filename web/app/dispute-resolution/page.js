import { ShieldAlert, RefreshCcw, Handshake, CheckCircle } from "lucide-react";

export default function DisputeResolution() {
  const processSteps = [
    {
      title: "Opening the Dispute",
      icon: <ShieldAlert className="size-6 text-[var(--text-primary)]" />,
      text: "Users log into their 'Orders' dashboard and flag an item for dispute within 14 days of Delivery Confirmation. Valid reasons include: item not as described, damaged goods, or missing shipments.",
      color: "from-[var(--accent)] to-emerald-400"
    },
    {
      title: "Vendor Negotiation Phase",
      icon: <Handshake className="size-6 text-[var(--text-primary)]" />,
      text: "The Verified Artisan receives direct notification. They have 48 hours to offer a resolution: a partial refund, full refund, or replacement item. Over 85% of disputes are resolved amicably in this phase.",
      color: "from-blue-500 to-[var(--accent)]"
    },
    {
      title: "Aura Escrow Intervention",
      icon: <RefreshCcw className="size-6 text-[var(--text-primary)]" />,
      text: "If no agreement is reached after 48 hours, Auradime's Dispute Arbitration team steps in. Funds remain locked in the buyer's Escrow state until the investigation concludes, ensuring maximum safety.",
      color: "from-purple-500 to-pink-500"
    },
    {
      title: "Final Verdict & Resolution",
      icon: <CheckCircle className="size-6 text-[var(--text-primary)]" />,
      text: "Our arbitration team reviews chat logs, tracking data, and submitted images. A final ruling is issued, forcing either a refund to the buyer's Aura Wallet or a release of funds to the Vendor.",
      color: "from-emerald-400 to-teal-400"
    }
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)] py-32 px-6 lg:px-20 selection:bg-[var(--accent)]/30 md:pt-32" style={{ paddingTop: 'calc\(61px\ \+\ env\(safe-area-inset-top,\ 0px\)\)' }}>
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16 space-y-6">
          <div className="inline-flex items-center gap-2 px-6 py-2 rounded-full border border-[var(--accent)]/30 bg-[var(--accent)]/10 text-[var(--accent)] text-xs  font-bold tracking-tight shadow-lg shadow-[var(--accent)]/20 animate-pulse">
            <ShieldAlert className="size-4" /> Secure Escrow
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl  font-bold text-[var(--text-primary)] tracking-tighter  drop-shadow-sm">
            Dispute <span className="text-[var(--accent)]">Resolution</span>
          </h1>
          <p className="text-[var(--text-secondary)] font-medium max-w-2xl mx-auto leading-relaxed">
            Auradime operates on a strict escrow system. Funds are securely locked until the buyer confirms the successful delivery and quality of goods. Here's our transparent process handling any exceptions.
          </p>
        </div>

        {/* Timeline Flow */}
        <div className="relative border-l border-[var(--glass-border)] ml-6 md:ml-12 space-y-12">
          {processSteps.map((step, idx) => (
            <div key={idx} className="relative pl-10 md:pl-16 group">
              {/* Timeline Dot */}
              <div className={`absolute top-0 left-0 -translate-x-1/2 flex items-center justify-center size-12 md:size-16 rounded-2xl bg-gradient-to-br ${step.color} shadow-lg shadow-[var(--accent)]/30 border border-white/20 transform group-hover:scale-110 transition-transform duration-500 z-10`}>
                {step.icon}
              </div>
              
              <div className="bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-3xl p-6 md:p-10 shadow-xl group-hover:border-[var(--accent)]/50 transition-colors duration-500 relative overflow-hidden backdrop-blur-xl">
                 <div className={`absolute top-0 right-0 w-[300px] h-[300px] bg-gradient-to-br ${step.color} opacity-5 blur-[80px] pointer-events-none rounded-full translate-x-1/2 -translate-y-1/2`} />
                 
                 <h3 className="text-xl md:text-2xl  font-bold text-[var(--text-primary)] tracking-tight mb-4 flex gap-4 items-center">
                   <span className="text-[var(--text-secondary)]/50 text-sm  font-bold">STEP {idx + 1}</span>
                   {step.title}
                 </h3>
                 <p className="text-[var(--text-secondary)] leading-relaxed relative z-10">
                   {step.text}
                 </p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-20 border border-[var(--glass-border)] bg-[var(--bg-primary)]/50 rounded-3xl p-10 flex flex-col items-center justify-center text-center">
          <h4 className="text-2xl  font-bold text-[var(--text-primary)] mb-4">Open an Existing Dispute?</h4>
          <p className="text-[var(--text-secondary)] max-w-xl mx-auto mb-8">
            Navigate to your orders, locate the specific purchase, and select 'Report Issue' to begin the transparent dispute pipeline. Ensure you have high-resolution images ready if required.
          </p>
          <a 
            href="/orders" 
            className="px-8 py-4 rounded-xl bg-[var(--text-primary)] text-[var(--bg-primary)]  font-bold  text-xs tracking-tight hover:bg-[var(--accent)] hover:text-white transition-all shadow-lg"
          >
            Go to My Orders
          </a>
        </div>
      </div>
    </div>
  );
}


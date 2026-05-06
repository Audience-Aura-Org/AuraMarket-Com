export default function TermsOfService() {
  return (
    <main className="min-h-screen bg-[var(--bg-secondary)] py-32 px-6 lg:px-20 selection:bg-[var(--accent)]/30">
      <div className="max-w-4xl mx-auto space-y-16">
        
        {/* Header */}
        <section className="text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-[var(--text-primary)] tracking-tighter  mb-6 drop-shadow-sm">
            Terms of <span className="text-[var(--accent)]">Service</span>
          </h1>
          <p className="text-[var(--text-secondary)] tracking-tight text-xs font-bold  inline-block border border-[var(--glass-border)] bg-[var(--bg-primary)] rounded-full px-6 py-2 shadow-lg">
            Effective Date: March 2026
          </p>
        </section>

        {/* Content Container */}
        <div className="bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-3xl p-8 md:p-12 space-y-12">
          
          <div className="space-y-4">
            <h2 className="text-xl md:text-2xl font-bold text-[var(--accent)] tracking-tight flex items-center gap-3">
              <span className="flex items-center justify-center size-8 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)] text-sm">01</span>
              Agreement to Terms
            </h2>
            <p className="text-[var(--text-secondary)] leading-relaxed pl-11">
              By accessing or utilizing the Aura Market platform, network, or associated mobile applications ("Service"), you agree to be bound unconditionally by these Terms of Service. If you disagree with any part of these terms, you must immediately terminate use of the platform and delete your account data.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl md:text-2xl font-bold text-[var(--accent)] tracking-tight flex items-center gap-3">
              <span className="flex items-center justify-center size-8 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)] text-sm">02</span>
              User Accounts
            </h2>
            <p className="text-[var(--text-secondary)] leading-relaxed pl-11">
              You are responsible for safeguarding the password and cryptographic keys (if applicable) that you use to access Aura Market. You agree not to disclose your password to any third party. You must notify us immediately upon becoming aware of any breach of security or unauthorized use of your account.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl md:text-2xl font-bold text-[var(--accent)] tracking-tight flex items-center gap-3">
              <span className="flex items-center justify-center size-8 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)] text-sm">03</span>
              Marketplace Operations & Vendor Obligations
            </h2>
            <p className="text-[var(--text-secondary)] leading-relaxed pl-11">
              Aura Market acts as an intermediary facilitating transactions between Buyers and Verified Artisans (Vendors). Vendors are solely responsible for the authenticity, legality, and accurate description of listed products. The platform holds a flat 5% commission on finalized sales, deducted upon order confirmation.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl md:text-2xl font-bold text-[var(--accent)] tracking-tight flex items-center gap-3">
              <span className="flex items-center justify-center size-8 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)] text-sm">04</span>
              Prohibited Activities
            </h2>
            <ul className="list-none space-y-3 pl-11">
              {[
                "Deploying scrapers, bots, or unauthorized API endpoints to extract marketplace data.",
                "Listing counterfeit, stolen, or illegally sourced goods.",
                "Attempting to circumvent the payment gateway or Aura Wallet infrastructure.",
                "Engaging in fraudulent activities, chargeback abuse, or malicious dispute handling."
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className="min-w-1.5 h-1.5 rounded-full bg-red-500/80 mt-2" />
                  <span className="text-[var(--text-secondary)] leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl md:text-2xl font-bold text-[var(--accent)] tracking-tight flex items-center gap-3">
              <span className="flex items-center justify-center size-8 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)] text-sm">05</span>
              Limitation of Liability
            </h2>
            <div className="pl-11 border-l-2 border-[var(--glass-border)] py-2 ml-4">
              <p className="text-[var(--text-secondary)] leading-relaxed bg-[var(--bg-secondary)]/50 p-4 rounded-xl border border-[var(--glass-border)]  text-[11px] lg:text-[12px] font-bold tracking-tight">
                In no event shall Aura Market, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the Service.
              </p>
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}

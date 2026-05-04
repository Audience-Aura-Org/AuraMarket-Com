export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-[var(--bg-secondary)] py-32 px-6 lg:px-20 selection:bg-[var(--accent)]/30">
      <div className="max-w-4xl mx-auto">
        <div className="bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-3xl p-10 md:p-16 relative overflow-hidden backdrop-blur-xl">
          {/* Decorative Elements */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[var(--accent)]/5 rounded-full blur-[100px] pointer-events-none -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-emerald-500/5 rounded-full blur-[80px] pointer-events-none translate-y-1/2 -translate-x-1/2" />

          <div className="relative z-10 space-y-12">
            <header className="border-b border-[var(--glass-border)] pb-8">
              <h1 className="text-4xl md:text-5xl font-black text-[var(--accent)]  tracking-tighter mb-4">
                Privacy Policy
              </h1>
              <p className="text-[var(--text-secondary)] font-medium text-sm md:text-base">
                Last updated: March 2026. Designed for Excellence and Transparency.
              </p>
            </header>

            <section className="space-y-6">
              <h2 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">1. Information We Collect</h2>
              <p className="text-[var(--text-secondary)] leading-relaxed">
                When you register, interact with our site, or make purchases, we collect necessary personal information to provide our services. This includes:
              </p>
              <ul className="list-disc list-inside text-[var(--text-secondary)] space-y-2 ml-4 marker:text-[var(--accent)]">
                <li>Account identifiers (email, username, encrypted passwords)</li>
                <li>Transaction records and Aura Wallet activity</li>
                <li>Shipping and billing addresses (managed securely)</li>
                <li>Analytics data (device identifiers, IP addresses, engagement metrics)</li>
              </ul>
            </section>

            <section className="space-y-6">
              <h2 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">2. How We Use Your Data</h2>
              <div className="bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl p-6">
                <p className="text-[var(--text-secondary)] leading-relaxed">
                  We leverage your data to ensure a smooth, secure, and highly personalized marketplace experience. Your data acts as the underlying connective tissue routing your purchases from Verified Artisans directly to you.
                </p>
              </div>
            </section>

            <section className="space-y-6">
              <h2 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">3. Data Security Exellence</h2>
              <p className="text-[var(--text-secondary)] leading-relaxed">
                Aura Market implements state-of-the-art cryptographic standards, including TLS 1.3 encryption across all network transfers, role-based access control, and stringent vendor KYC (Know Your Customer) processes.
              </p>
            </section>

            <section className="space-y-6">
              <h2 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">4. Third-Party Disclosures</h2>
              <p className="text-[var(--text-secondary)] leading-relaxed">
                We do not sell, trade, or maliciously distribute your personally identifiable information. We may securely relay necessary data to logistics and payment processing architecture partners to fulfill the core functions of the marketplace.
              </p>
            </section>

            <section className="space-y-6">
              <h2 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">5. User Rights & Data Deletion</h2>
              <p className="text-[var(--text-secondary)] leading-relaxed">
                As a user, you possess full sovereignty over your profile footprint. You may request an immutable snapshot of your data or trigger an account wipe protocol by contacting our data protection officer at <span className="text-[var(--accent)] font-bold">privacy@aura.market</span>.
              </p>
            </section>
            
            <div className="pt-10 mt-10 border-t border-[var(--glass-border)] text-sm text-[var(--text-secondary)]/50 font-black tracking-wide text-center">
              Aura Market Corporate Network ©
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import Link from 'next/link';
import { ArrowLeft, Mail, MapPin, ShieldCheck } from 'lucide-react';
import { legalContact, legalPolicyLinks } from '@/data/legalPolicies';

function SectionBlock({ section, index }) {
  return (
    <section className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)] p-5 shadow-sm sm:p-6">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/10 text-[12px] font-bold text-[var(--accent)]">
          {String(index + 1).padStart(2, '0')}
        </span>
        <h2 className="pt-1 text-lg font-bold leading-tight text-[var(--text-primary)] sm:text-xl">
          {section.heading}
        </h2>
      </div>

      {section.body?.map((paragraph) => (
        <p
          key={paragraph}
          className="mb-3 text-sm leading-7 text-[var(--text-secondary)] sm:text-[15px]"
        >
          {paragraph}
        </p>
      ))}

      {section.list ? (
        <ul className="space-y-3 text-sm leading-7 text-[var(--text-secondary)] sm:text-[15px]">
          {section.list.map((item) => (
            <li key={item} className="flex gap-3">
              <span className="mt-3 size-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {section.rows ? (
        <div className="mt-3 overflow-hidden rounded-xl border border-[var(--glass-border)]">
          {section.rows.map(([label, value]) => (
            <div
              key={label}
              className="grid gap-2 border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/60 p-4 last:border-b-0 sm:grid-cols-[190px_1fr]"
            >
              <dt className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--text-primary)]">
                {label}
              </dt>
              <dd className="text-sm leading-6 text-[var(--text-secondary)]">
                {value}
              </dd>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export default function LegalPolicyPage({ policy }) {
  return (
    <main className="min-h-screen bg-[var(--bg-secondary)] px-4 py-8 font-poppins text-[var(--text-primary)] sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-full border border-[var(--glass-border)] bg-[var(--bg-primary)] px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] shadow-sm transition hover:text-[var(--text-primary)]"
          >
            <ArrowLeft className="size-4" />
            Back to login
          </Link>

          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-xs font-bold text-emerald-700">
            <ShieldCheck className="size-4" />
            Cameroon marketplace policy
          </div>
        </div>

        <header className="rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-primary)] p-6 shadow-sm sm:p-8 lg:p-10">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
            Legal Center
          </p>
          <h1 className="max-w-4xl text-3xl font-black leading-tight tracking-tight text-[var(--text-primary)] sm:text-4xl lg:text-5xl">
            {policy.title}
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--text-secondary)] sm:text-base">
            {policy.description}
          </p>

          <div className="mt-6 flex flex-wrap gap-3 text-xs font-semibold text-[var(--text-secondary)]">
            <span className="rounded-full bg-[var(--bg-secondary)] px-3 py-1.5">
              Last updated: {policy.updated}
            </span>
            <span className="rounded-full bg-[var(--bg-secondary)] px-3 py-1.5">
              Jurisdiction: {policy.jurisdiction}
            </span>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1fr_280px] lg:items-start">
          <div className="space-y-5">
            {policy.sections.map((section, index) => (
              <SectionBlock key={section.heading} section={section} index={index} />
            ))}

            <section className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)] p-5 shadow-sm sm:p-6">
              <h2 className="text-lg font-bold text-[var(--text-primary)]">
                Contact
              </h2>
              <div className="mt-4 grid gap-3 text-sm text-[var(--text-secondary)] sm:grid-cols-2">
                <a
                  href={`mailto:${legalContact.email}`}
                  className="flex items-center gap-3 rounded-xl bg-[var(--bg-secondary)] p-4 font-semibold transition hover:text-[var(--accent)]"
                >
                  <Mail className="size-4" />
                  {legalContact.email}
                </a>
                <div className="flex items-center gap-3 rounded-xl bg-[var(--bg-secondary)] p-4 font-semibold">
                  <MapPin className="size-4" />
                  {legalContact.location}
                </div>
              </div>
              <p className="mt-4 text-xs leading-6 text-[var(--text-secondary)]">
                This page is operational policy information for AuraDime and is not a
                substitute for legal advice. A qualified Cameroon lawyer should review
                the final published policies for regulatory completeness.
              </p>
            </section>
          </div>

          <aside className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)] p-4 shadow-sm lg:sticky lg:top-6">
            <p className="px-2 pb-3 text-xs font-bold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
              More policies
            </p>
            <nav className="flex flex-col gap-1">
              {legalPolicyLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-xl px-3 py-2 text-sm font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]"
                >
                  {link.name}
                </Link>
              ))}
            </nav>
          </aside>
        </div>
      </div>
    </main>
  );
}

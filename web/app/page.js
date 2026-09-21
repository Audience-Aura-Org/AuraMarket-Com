import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import HomeRedirect from './HomeRedirect';

export default function HomePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-secondary)] relative">
      {/* Client-side redirect for real users */}
      <HomeRedirect />

      {/* Spinner visible to users while redirect happens */}
      <Loader2 className="size-8 animate-spin text-[var(--accent)]" />

      {/* SEO content — visually hidden but crawlable by Google */}
      <nav className="sr-only" aria-label="Main navigation">
        <h1>Auradime — Shop, Dine &amp; Deliver Across Cameroon</h1>
        <p>
          Auradime is Cameroon&apos;s trusted marketplace. Buy quality products from local sellers,
          order meals from nearby restaurants, and enjoy fast delivery — all in one platform.
        </p>
        <ul>
          <li><Link href="/shop">Shop — Browse products</Link></li>
          <li><Link href="/dine">Dine — Order food from restaurants</Link></li>
          <li><Link href="/stores">Stores — Browse trusted sellers</Link></li>
          <li><Link href="/collections">Collections — Curated product picks</Link></li>
          <li><Link href="/brands">Brands — Verified merchants</Link></li>
          <li><Link href="/help-center">Help Center — FAQs and support</Link></li>
          <li><Link href="/contact">Contact Us</Link></li>
          <li><Link href="/login">Sign In</Link></li>
          <li><Link href="/signup">Create Account</Link></li>
          <li><Link href="/subscribe">Become a Vendor</Link></li>
        </ul>
      </nav>
    </div>
  );
}

'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

/**
 * Legacy /messages links preserve query string (e.g. vendorId) when forwarding to /chat.
 */
function MessagesRedirectInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const q = searchParams.toString();
    router.replace(q ? `/chat?${q}` : '/chat');
  }, [searchParams, router]);

  return (
    <div className="flex h-[100dvh] w-full items-center justify-center bg-[#ece5dd]">
      <div
        className="size-9 animate-spin rounded-full border-2 border-[#075e54] border-t-transparent"
        aria-hidden
      />
    </div>
  );
}

export default function MessagesRedirectPage() {
  return (
    <Suspense fallback={<div className="h-[100dvh] w-full bg-[#ece5dd]" />}>
      <MessagesRedirectInner />
    </Suspense>
  );
}

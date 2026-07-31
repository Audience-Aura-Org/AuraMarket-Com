import { Suspense } from 'react';
import EditProductPageClient from './[id]/EditProductPageClient';

// Static (non-dynamic) entry point for the product edit page.
// Used by the Capacitor APK static export — accepts ?id=<productId> as a
// query parameter so no dynamic [id] segment is needed, which avoids
// the static-export file-not-found issue that caused the app to fall back
// to the root page and redirect vendors to /vendor/dashboard.
export default function EditProductPage() {
  return (
    <Suspense>
      <EditProductPageClient />
    </Suspense>
  );
}

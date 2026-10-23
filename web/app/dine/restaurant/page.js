import { Suspense } from 'react';
import RestaurantMenuPageClient from './[vendor_id]/RestaurantMenuPageClient';
export default function RestaurantPage() {
  return <Suspense fallback={<div className="min-h-screen p-8" role="status">Loading restaurant...</div>}><RestaurantMenuPageClient /></Suspense>;
}

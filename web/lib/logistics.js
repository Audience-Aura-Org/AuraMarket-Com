import { formatVariantLabel } from '@/utils/variants';

export function summarizeLineItems(order) {
  if (!order?.products?.length) return '—';
  const parts = order.products.slice(0, 2).map((p) => {
    const name =
      (typeof p.product_id === 'object' && p.product_id?.name) ||
      p.name ||
      'Item';
    const variant = formatVariantLabel(p.variant);
    return `${name}${variant ? ` (${variant})` : ''} x${p.quantity ?? 1}`;
  });
  const extra = order.products.length > 2 ? ` +${order.products.length - 2}` : '';
  return parts.join(' · ') + extra;
}

export function destinationLine(s) {
  const d = s.delivery_address;
  if (!d || (!d.city && !d.region && !d.quartier)) return { main: '—', sub: '' };
  const main = d.city || d.quartier || d.region || '—';
  const sub = [d.quartier, d.region].filter(Boolean).join(' · ') || '';
  return { main, sub };
}

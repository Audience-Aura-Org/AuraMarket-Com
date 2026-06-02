'use client';

import { fmt, formatAdminDate, getGatewayBrand } from '@/utils/adminFinance';

export function GatewayBrand({ gateway, method, size = 'sm', className = '' }) {
  const brand = getGatewayBrand(gateway || method);
  const sizeClass = size === 'md' ? 'size-8 text-[10px]' : 'size-6 text-[8px]';

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-md font-bold uppercase tracking-tighter ${sizeClass} ${brand.className} ${className}`}
      title={brand.label}
    >
      {brand.short}
    </span>
  );
}

export function AmountDateColumn({ amount, currency = 'XAF', createdAt, amountClassName = '' }) {
  const amountLabel = fmt(amount);
  const currencyLabel = currency || 'XAF';
  const { shortDate, timeLabel } = formatAdminDate(createdAt);

  return (
    <div className="text-right">
      <p className={`text-[15px] font-semibold leading-tight tabular-nums ${amountClassName}`}>
        {amountLabel}
        <span className="ml-1.5 text-[11px] font-medium text-[var(--text-secondary)]">{currencyLabel}</span>
      </p>
      <p className="mt-1 text-[10px] font-medium text-[var(--text-secondary)]">{shortDate}</p>
      <p className="text-[9px] text-[var(--text-secondary)]/75">{timeLabel}</p>
    </div>
  );
}

export function PartyAvatar({ src, initial, alt = '', size = 'md', badge }) {
  const box = size === 'lg' ? 'size-11' : size === 'sm' ? 'size-8' : 'size-9';

  return (
    <div className="relative shrink-0">
      <div
        className={`${box} overflow-hidden rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)]`}
      >
        {src ? (
          <img src={src} alt={alt} className="size-full object-cover" />
        ) : (
          <span className="flex size-full items-center justify-center bg-[var(--bg-secondary)] text-[11px] font-semibold text-[var(--text-secondary)]">
            {initial || '?'}
          </span>
        )}
      </div>
      {badge && <div className="absolute -bottom-1 -right-1">{badge}</div>}
    </div>
  );
}

export function getTransactionParty(tx) {
  const order = tx.order_ids?.[0] || tx.order_id;
  const vendor = order?.vendor_id;
  const branding = vendor?.branding || {};
  const logo =
    branding.logo ||
    branding.logo_url ||
    branding.logoUrl ||
    branding.avatar ||
    tx.user_id?.avatar ||
    null;
  const name = vendor?.store_name || tx.user_id?.name || 'User';
  const initial = String(name).trim().charAt(0).toUpperCase();

  return { logo, name, initial };
}

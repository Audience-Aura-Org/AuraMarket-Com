'use client';

import { fmt, formatAdminDate, getGatewayBrand } from '@/utils/adminFinance';

export function GatewayBrand({ gateway, method, size = 'sm', className = '' }) {
  const brand = getGatewayBrand(gateway || method);
  const sizeClass =
    size === 'md' ? 'size-7 text-[9px] sm:size-8 sm:text-[10px]' : 'size-5 text-[7px] sm:size-6 sm:text-[8px]';

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-md font-bold uppercase tracking-tighter ${sizeClass} ${brand.className} ${className}`}
      title={brand.label}
    >
      {brand.short}
    </span>
  );
}

export function AmountDateColumn({
  amount,
  currency = 'XAF',
  createdAt,
  amountClassName = '',
  compact = false,
  className = '',
}) {
  const amountLabel = fmt(amount);
  const currencyLabel = currency || 'XAF';
  const { shortDate, timeLabel } = formatAdminDate(createdAt);

  if (compact) {
    return (
      <div className={`shrink-0 text-right ${className}`}>
        <p
          className={`text-[13px] font-semibold leading-tight tabular-nums sm:text-[14px] ${amountClassName}`}
        >
          {amountLabel}
          <span className="ml-1 text-[10px] font-medium text-[var(--text-secondary)]">{currencyLabel}</span>
        </p>
        <p className="mt-0.5 text-[9px] text-[var(--text-secondary)]">
          {shortDate} · {timeLabel}
        </p>
      </div>
    );
  }

  return (
    <div className={`text-right ${className}`}>
      <p
        className={`text-[14px] font-semibold leading-tight tabular-nums sm:text-[15px] ${amountClassName}`}
      >
        {amountLabel}
        <span className="ml-1 text-[10px] font-medium text-[var(--text-secondary)] sm:ml-1.5 sm:text-[11px]">
          {currencyLabel}
        </span>
      </p>
      <p className="mt-0.5 text-[9px] font-medium text-[var(--text-secondary)] sm:mt-1 sm:text-[10px]">
        {shortDate}
      </p>
      <p className="hidden text-[9px] text-[var(--text-secondary)]/75 sm:block">{timeLabel}</p>
      <p className="text-[8px] text-[var(--text-secondary)]/70 sm:hidden">{timeLabel}</p>
    </div>
  );
}

export function PartyAvatar({ src, initial, alt = '', size = 'md', badge }) {
  const box =
    size === 'lg'
      ? 'size-10 sm:size-11'
      : size === 'sm'
        ? 'size-7 sm:size-8'
        : 'size-9 sm:size-9';

  return (
    <div className="relative shrink-0">
      <div
        className={`${box} overflow-hidden rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)]`}
      >
        {src ? (
          <img src={src} alt={alt} className="size-full object-cover" />
        ) : (
          <span className="flex size-full items-center justify-center bg-[var(--bg-secondary)] text-[10px] font-semibold text-[var(--text-secondary)] sm:text-[11px]">
            {initial || '?'}
          </span>
        )}
      </div>
      {badge && <div className="absolute -bottom-0.5 -right-0.5 sm:-bottom-1 sm:-right-1">{badge}</div>}
    </div>
  );
}

export function getTransactionParty(tx) {
  const order = tx.order_ids?.[0] || tx.order_id;
  const vendor = order?.vendor_id;
  const vendorUser = vendor?.user_id;
  const customer = order?.customer_id;
  const branding = vendor?.branding || {};
  const logo =
    branding.logo ||
    branding.logo_url ||
    branding.logoUrl ||
    branding.avatar ||
    vendorUser?.avatar ||
    customer?.avatar ||
    tx.user_id?.avatar ||
    null;
  const name =
    vendor?.store_name ||
    customer?.name ||
    tx.user_id?.name ||
    (tx.gateway === 'platform' ? 'Auradime Platform' : 'User');
  const initial = String(name).trim().charAt(0).toUpperCase();

  return { logo, name, initial, vendor, vendorUser, customer, order };
}

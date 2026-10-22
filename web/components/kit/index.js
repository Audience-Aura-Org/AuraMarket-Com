/**
 * Shared UI kit in the vendor dashboard's design language, for every role's
 * pages (logistics, admin, customer). Built for speed: plain CSS, no motion
 * library, charts lazy-load recharts, glass blur desktop-only.
 */
export { PageContainer, PageHeader, Panel, buttonClass } from './Page';
export { default as PillTabs } from './PillTabs';
export { default as StatusPill, toneOf } from './StatusPill';
export { default as DataTable } from './DataTable';
export { default as TrendChart } from './TrendChart';
export { EmptyState, ErrorState, Skeleton, SkeletonRows } from './States';
export { default as StatCard } from '@/components/layout/StatCard';

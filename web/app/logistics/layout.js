'use client';
import { usePathname } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
export default function LogisticsLayout({ children }) {
 const pathname = usePathname();
 if (pathname === '/logistics') return children;
 return <DashboardLayout role="logistics">{children}</DashboardLayout>;
}

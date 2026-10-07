"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { useAuthStore } from "@/hooks/useAuth";

export default function AdminLayout({ children }) {
  const { user } = useAuthStore();
  const role = user?.role === 'manager' ? 'manager' : 'admin';
  return <DashboardLayout role={role}>{children}</DashboardLayout>;
}

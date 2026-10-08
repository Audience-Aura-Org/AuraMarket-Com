"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { useAuthStore } from "@/hooks/useAuth";

export default function AdminLayout({ children }) {
  return <DashboardLayout role="admin">{children}</DashboardLayout>;
}

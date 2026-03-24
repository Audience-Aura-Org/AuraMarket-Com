import DashboardLayout from "@/components/layout/DashboardLayout";

export default function AdminLayout({ children }) {
  return <DashboardLayout role="admin">{children}</DashboardLayout>;
}

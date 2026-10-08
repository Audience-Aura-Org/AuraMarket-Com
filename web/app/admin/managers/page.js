"use client";

import { redirect } from 'next/navigation';

export default function AdminManagersPage() {
  redirect('/admin/users?role=manager');
}

"use client";

import RequireRole from "@/components/RequireRole";
import AdminShell from "@/components/AdminShell";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireRole allow={["admin"]}>
      <AdminShell>{children}</AdminShell>
    </RequireRole>
  );
}

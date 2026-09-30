"use client";

import RequireRole from "@/components/RequireRole";
import { useAuth } from "@/lib/AuthProvider";
import Logo from "@/components/Logo";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuth();
  return (
    <RequireRole allow={["client"]}>
      <div className="min-h-screen bg-paper font-body">
        <header className="border-b border-line bg-white px-6 py-4">
          <div className="mx-auto flex max-w-3xl items-center justify-between">
            <div>
              <Logo height={26} />
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-neutral-500">{profile?.full_name}</span>
              <button onClick={signOut} className="text-stamp hover:underline">
                Sign out
              </button>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
      </div>
    </RequireRole>
  );
}

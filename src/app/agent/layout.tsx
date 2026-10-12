"use client";

import Link from "next/link";
import RequireRole from "@/components/RequireRole";
import { useAuth } from "@/lib/AuthProvider";
import { roleLabel } from "@/lib/types";
import Logo from "@/components/Logo";

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuth();
  const initial = (profile?.full_name ?? "?").trim().charAt(0).toUpperCase();
  return (
    <RequireRole allow={["agent", "professional"]}>
      <div className="min-h-screen bg-gradient-to-b from-sectionTint/70 via-paper to-paper font-body">
        <header className="sticky top-0 z-30 border-b border-line bg-white/85 px-4 py-3 backdrop-blur-md sm:px-6">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
            <Link
              href="/agent"
              className="flex items-center gap-2.5 rounded-lg transition active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-stamp"
              aria-label="Back to my cases"
            >
              <Logo height={26} />
              {profile && (
                <span className="rounded-full bg-stamp/10 px-2.5 py-0.5 text-xs font-semibold text-stampDark">
                  {roleLabel(profile)}
                </span>
              )}
            </Link>
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-navy text-sm font-semibold text-white"
              >
                {initial}
              </span>
              <button onClick={signOut} className="btn-outline btn-sm">
                Sign out
              </button>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-3xl px-4 py-6 sm:py-8">{children}</main>
      </div>
    </RequireRole>
  );
}

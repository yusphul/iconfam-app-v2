"use client";

import Link from "next/link";
import RequireRole from "@/components/RequireRole";
import { useAuth } from "@/lib/AuthProvider";
import { roleLabel } from "@/lib/types";
import Logo from "@/components/Logo";

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuth();
  return (
    <RequireRole allow={["agent", "professional"]}>
      <div className="min-h-screen bg-paper font-body">
        <header className="border-b border-line bg-white px-6 py-4">
          <div className="mx-auto flex max-w-2xl items-center justify-between">
            <Link href="/agent" className="flex items-center gap-2" aria-label="Back to my cases">
              <Logo height={26} />
              <span className="text-xs uppercase tracking-wide text-neutral-400">
                {profile ? roleLabel(profile) : ""}
              </span>
            </Link>
            <button onClick={signOut} className="text-sm text-stamp hover:underline">
              Sign out
            </button>
          </div>
        </header>
        <main className="mx-auto max-w-2xl px-4 py-6">{children}</main>
      </div>
    </RequireRole>
  );
}

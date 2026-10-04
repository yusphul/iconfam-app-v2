"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import RequireRole from "@/components/RequireRole";
import { useAuth } from "@/lib/AuthProvider";
import Logo from "@/components/Logo";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuth();
  const pathname = usePathname();
  // "My cases" is the client's home. Highlighted on the list page and on any
  // case page, so there is always an obvious way back without signing out.
  const onHome = pathname === "/portal";

  return (
    <RequireRole allow={["client"]}>
      <div className="min-h-screen bg-paper font-body">
        <header className="border-b border-line bg-white px-6 py-4">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
            <div className="flex items-center gap-5">
              <Link href="/portal" aria-label="iConfam — back to My Cases">
                <Logo height={26} />
              </Link>
              <nav className="hidden sm:block">
                <Link
                  href="/portal"
                  className={`border-b-2 pb-0.5 text-sm font-medium transition ${
                    onHome
                      ? "border-stamp text-stamp"
                      : "border-transparent text-neutral-500 hover:text-navy"
                  }`}
                >
                  My Cases
                </Link>
              </nav>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="hidden text-neutral-500 sm:inline">{profile?.full_name}</span>
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

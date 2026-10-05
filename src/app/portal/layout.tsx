"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import RequireRole from "@/components/RequireRole";
import { useAuth } from "@/lib/AuthProvider";
import { initials } from "@/lib/caseVisuals";
import Logo from "@/components/Logo";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuth();
  const pathname = usePathname();
  // "My cases" is the client's home. It stays lit on any case page, so there is
  // always an obvious way back without signing out.
  const onNew = pathname === "/portal/new";

  const navLink = (active: boolean) =>
    `rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stamp ${
      active ? "bg-navy text-white" : "text-neutral-600 hover:bg-slate-100 hover:text-navy"
    }`;

  return (
    <RequireRole allow={["client"]}>
      <div className="min-h-screen bg-paper bg-[radial-gradient(60rem_26rem_at_50%_-8rem,#EAF0F6,transparent)] font-body">
        <header className="sticky top-0 z-30 border-b border-line/80 bg-white/80 backdrop-blur-md">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-5">
              <Link
                href="/portal"
                aria-label="iConfam — back to My Cases"
                className="rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-stamp"
              >
                <Logo height={26} />
              </Link>
              <nav aria-label="Portal" className="hidden items-center gap-1 sm:flex">
                <Link href="/portal" className={navLink(!onNew)}>
                  My cases
                </Link>
                <Link href="/portal/new" className={navLink(onNew)}>
                  New request
                </Link>
              </nav>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span
                aria-hidden="true"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-navy text-xs font-semibold text-white"
              >
                {initials(profile?.full_name)}
              </span>
              <span className="hidden max-w-[10rem] truncate text-neutral-700 md:inline">
                {profile?.full_name}
              </span>
              <button
                onClick={signOut}
                className="rounded text-stamp hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stamp"
              >
                Sign out
              </button>
            </div>
          </div>
          {/* Phone: the two destinations sit on their own row under the logo. */}
          <nav aria-label="Portal" className="flex gap-1 border-t border-line/60 px-4 py-2 sm:hidden">
            <Link href="/portal" className={navLink(!onNew)}>
              My cases
            </Link>
            <Link href="/portal/new" className={navLink(onNew)}>
              New request
            </Link>
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">{children}</main>
      </div>
    </RequireRole>
  );
}

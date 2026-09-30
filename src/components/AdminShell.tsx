"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/AuthProvider";
import Logo from "@/components/Logo";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/cases", label: "All Cases" },
  { href: "/admin/reports", label: "Reports Queue" },
  { href: "/admin/agents", label: "Agents & Professionals" },
  { href: "/admin/payments", label: "Payments" },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-paper font-body">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <Logo height={26} />
            <span className="text-xs uppercase tracking-wide text-neutral-400">Admin</span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-neutral-500">{profile?.full_name}</span>
            <button onClick={signOut} className="text-stamp hover:underline">
              Sign out
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 px-6">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`border-b-2 px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "border-stamp text-stamp"
                    : "border-transparent text-neutral-500 hover:text-navy"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}

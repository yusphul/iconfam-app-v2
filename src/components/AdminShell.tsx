"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/AuthProvider";
import { supabase } from "@/lib/supabaseClient";
import Logo from "@/components/Logo";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/leads", label: "Leads" },
  { href: "/admin/cases", label: "All Cases" },
  { href: "/admin/reports", label: "Review Queue" },
  { href: "/admin/agents", label: "Agents & Professionals" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/settings", label: "Settings" },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const [pending, setPending] = useState(0);
  const [openLeads, setOpenLeads] = useState(0);
  const [toConfirm, setToConfirm] = useState(0);

  // Count of reports + documents waiting for the admin's approval, shown on
  // the Review Queue tab. Refreshed whenever the admin moves between pages.
  useEffect(() => {
    let cancelled = false;
    async function loadPending() {
      const [{ count: r }, { count: d }, { count: l }, { count: pc }] = await Promise.all([
        supabase
          .from("reports")
          .select("*", { count: "exact", head: true })
          .eq("review_status", "pending"),
        supabase
          .from("documents")
          .select("*", { count: "exact", head: true })
          .eq("review_status", "pending"),
        supabase
          .from("leads")
          .select("*", { count: "exact", head: true })
          .in("stage", ["new", "call_booked", "call_done"]),
        supabase
          .from("payments")
          .select("*", { count: "exact", head: true })
          .not("reported_at", "is", null)
          .in("status", ["pending", "overdue"]),
      ]);
      if (!cancelled) {
        setPending((r ?? 0) + (d ?? 0));
        setOpenLeads(l ?? 0);
        setToConfirm(pc ?? 0);
      }
    }
    loadPending();
    // Check again every minute so a new payment report shows up without a refresh.
    const timer = setInterval(loadPending, 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [pathname]);

  return (
    <div className="min-h-screen bg-paper font-body">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/admin" className="flex items-center gap-2" aria-label="iConfam admin home">
            <Logo height={26} />
            <span className="text-xs uppercase tracking-wide text-neutral-400">Admin</span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-neutral-500">{profile?.full_name}</span>
            <button onClick={signOut} className="text-stamp hover:underline">
              Sign out
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-6">
          {NAV.map((item) => {
            // Highlight a section for its sub-pages too (e.g. a case detail
            // keeps "All Cases" lit), but keep Dashboard exact.
            const active =
              item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "border-stamp text-stamp"
                    : "border-transparent text-neutral-500 hover:text-navy"
                }`}
              >
                {item.label}
                {item.href === "/admin/leads" && openLeads > 0 && (
                  <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                    {openLeads}
                  </span>
                )}
                {item.href === "/admin/payments" && toConfirm > 0 && (
                  <span
                    aria-label={`${toConfirm} payment${toConfirm === 1 ? "" : "s"} to confirm`}
                    className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white"
                  >
                    {toConfirm}
                  </span>
                )}
                {item.href === "/admin/reports" && pending > 0 && (
                  <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                    {pending}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}

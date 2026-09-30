"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthProvider";
import type { Case } from "@/lib/types";
import { CASE_STATUS_LABELS, CASE_TYPE_LABELS } from "@/lib/types";
import Badge from "@/components/Badge";

export default function ClientCasesPage() {
  const { profile } = useAuth();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    async function load() {
      const { data } = await supabase
        .from("cases")
        .select("*")
        .eq("client_id", profile!.id)
        .order("updated_at", { ascending: false });
      setCases((data as Case[]) ?? []);
      setLoading(false);
    }
    load();
  }, [profile]);

  if (loading) return <p className="text-sm text-neutral-500">Loading your cases…</p>;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="mb-1 font-display text-xl font-bold text-navy">My Cases</h1>
          <p className="text-sm text-neutral-500">
            Independent verification before your money moves.
          </p>
        </div>
        <Link
          href="/portal/new"
          className="whitespace-nowrap rounded-full bg-stamp px-4 py-2 text-sm font-semibold text-white hover:bg-stampDark"
        >
          + Request verification
        </Link>
      </div>

      <div className="space-y-3">
        {cases.map((c) => (
          <Link
            key={c.id}
            href={`/portal/cases/${c.id}`}
            className="block rounded-lg border border-line bg-white p-4 hover:border-stamp"
          >
            <div className="mb-1 flex items-center justify-between">
              <span className="font-semibold text-navy">{c.title}</span>
              <Badge className="border-line text-neutral-600">{CASE_STATUS_LABELS[c.status]}</Badge>
            </div>
            <p className="text-sm text-neutral-500">{CASE_TYPE_LABELS[c.case_type]}</p>
          </Link>
        ))}
        {cases.length === 0 && (
          <div className="rounded-lg border border-line bg-white p-6 text-center text-sm text-neutral-400">
            No cases yet. Your admin contact will set one up once you've agreed on scope.
          </div>
        )}
      </div>
    </div>
  );
}

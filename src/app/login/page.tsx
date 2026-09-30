"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import Logo from "@/components/Logo";

const ROLE_HEADING: Record<string, string> = {
  client: "Sign in as a client",
  agent: "Sign in as a field agent",
  professional: "Sign in as a professional",
  admin: "Sign in as admin",
};

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const roleParam = searchParams.get("role") ?? "";
  const heading = ROLE_HEADING[roleParam] ?? "Sign in";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.replace("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-blueprint px-4 font-body">
      <div className="w-full max-w-sm rounded-2xl border border-blueprintLine bg-white p-8 shadow-sm">
        <Link href="/" className="mb-6 inline-block">
          <Logo height={30} />
        </Link>
        <h1 className="mb-6 font-display text-lg font-semibold text-chalk">{heading}</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-slateSoft">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-blueprintLine bg-blueprint px-3 py-2 text-sm text-chalk outline-none transition focus:border-survey"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-slateSoft">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-blueprintLine bg-blueprint px-3 py-2 text-sm text-chalk outline-none transition focus:border-survey"
            />
          </div>
          {error && <p className="text-sm text-survey">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-survey py-2 text-sm font-semibold text-white transition hover:bg-surveyLight disabled:opacity-60"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="mt-6 text-xs text-slateSoft">
          New client?{" "}
          <Link href="/signup" className="font-medium text-survey hover:text-surveyLight">
            Create an account
          </Link>
          . Agents, professionals, and admin accounts are invited directly by email.
        </p>
        <Link href="/" className="mt-4 inline-block text-xs text-slateSoft hover:text-survey">
          ← Back
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

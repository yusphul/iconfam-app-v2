"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import Logo from "@/components/Logo";

export default function SetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    // supabase-js already established a session from the invite link's URL when this
    // page loaded (detectSessionInUrl is on by default) — this just sets a real password.
    const { error } = await supabase.auth.updateUser({ password });
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
        <h1 className="mb-1 font-display text-lg font-semibold text-chalk">
          Welcome — set your password
        </h1>
        <p className="mb-6 text-sm text-slateSoft">
          Choose a password for your account. You'll use this to sign in from now on.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="new-password" className="mb-1 block text-sm font-medium text-slateSoft">
              New password
            </label>
            <input
              id="new-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-blueprintLine bg-blueprint px-3 py-2 text-sm text-chalk outline-none transition focus:border-survey"
            />
          </div>
          <div>
            <label htmlFor="confirm-password" className="mb-1 block text-sm font-medium text-slateSoft">
              Confirm password
            </label>
            <input
              id="confirm-password"
              type="password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full border border-blueprintLine bg-blueprint px-3 py-2 text-sm text-chalk outline-none transition focus:border-survey"
            />
          </div>
          {error && <p className="text-sm text-survey">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-survey py-2.5 text-sm font-semibold text-white transition hover:bg-surveyLight disabled:opacity-60"
          >
            {submitting ? "Saving…" : "Set password & continue"}
          </button>
        </form>
      </div>
    </div>
  );
}

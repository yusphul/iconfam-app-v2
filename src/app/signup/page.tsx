"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import Logo from "@/components/Logo";

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Whether Supabase requires email confirmation before a session is active
  // depends on your project's Auth settings — this page handles both cases
  // rather than assuming one.
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    // No "role" is ever sent here — self-signup can only ever create a client
    // account. The on_auth_user_created trigger defaults to 'client' whenever
    // metadata doesn't include a role, and this form never collects one.
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          whatsapp_number: whatsapp || null,
        },
      },
    });
    setSubmitting(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    if (data.session) {
      // Email confirmation is off for this project — signUp already returned
      // an active session, so go straight into the "what do you need
      // verified?" flow instead of asking them to check their email.
      router.replace("/portal/new");
    } else {
      setAwaitingConfirmation(true);
    }
  }

  if (awaitingConfirmation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-blueprint px-4 font-body">
        <div className="w-full max-w-sm rounded-2xl border border-blueprintLine bg-white p-8 text-center shadow-sm">
          <div className="mb-6 flex justify-center">
            <Logo height={30} />
          </div>
          <h1 className="mb-2 font-display text-lg font-semibold text-chalk">
            Check your email
          </h1>
          <p className="text-sm text-slateSoft">
            We sent a confirmation link to <span className="font-medium text-chalk">{email}</span>.
            Click it to activate your account, then sign in.
          </p>
          <Link
            href="/login?role=client"
            className="mt-6 inline-block text-sm font-medium text-survey hover:text-surveyLight"
          >
            Go to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-blueprint px-4 py-12 font-body">
      <div className="w-full max-w-sm rounded-2xl border border-blueprintLine bg-white p-8 shadow-sm">
        <Link href="/" className="mb-6 inline-block">
          <Logo height={30} />
        </Link>
        <h1 className="mb-1 font-display text-lg font-semibold text-chalk">Create your account</h1>
        <p className="mb-6 text-sm text-slateSoft">
          For clients only — verifying a property, build, or farm. Agents,
          professionals, and admin accounts are invited directly.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="full-name" className="mb-1 block text-sm font-medium text-slateSoft">
              Full name
            </label>
            <input
              id="full-name"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-lg border border-blueprintLine bg-blueprint px-3 py-2 text-sm text-chalk outline-none transition focus:border-survey"
            />
          </div>
          <div>
            <label htmlFor="signup-email" className="mb-1 block text-sm font-medium text-slateSoft">
              Email
            </label>
            <input
              id="signup-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-blueprintLine bg-blueprint px-3 py-2 text-sm text-chalk outline-none transition focus:border-survey"
            />
          </div>
          <div>
            <label htmlFor="signup-whatsapp" className="mb-1 block text-sm font-medium text-slateSoft">
              WhatsApp number (optional)
            </label>
            <input
              id="signup-whatsapp"
              type="tel"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="+1 555 000 0000"
              className="w-full rounded-lg border border-blueprintLine bg-blueprint px-3 py-2 text-sm text-chalk outline-none transition focus:border-survey"
            />
          </div>
          <div>
            <label htmlFor="signup-password" className="mb-1 block text-sm font-medium text-slateSoft">
              Password
            </label>
            <input
              id="signup-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-blueprintLine bg-blueprint px-3 py-2 text-sm text-chalk outline-none transition focus:border-survey"
            />
          </div>
          <div>
            <label htmlFor="signup-confirm" className="mb-1 block text-sm font-medium text-slateSoft">
              Confirm password
            </label>
            <input
              id="signup-confirm"
              type="password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-lg border border-blueprintLine bg-blueprint px-3 py-2 text-sm text-chalk outline-none transition focus:border-survey"
            />
          </div>
          {error && <p className="text-sm text-survey">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full bg-chalk py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {submitting ? "Creating account…" : "Create account"}
          </button>
        </form>
        <p className="mt-6 text-xs text-slateSoft">
          Already have an account?{" "}
          <Link href="/login?role=client" className="font-medium text-survey hover:text-surveyLight">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

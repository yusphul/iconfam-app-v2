"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthProvider";
import type { UserRole } from "@/lib/types";

export default function RequireRole({
  allow,
  children,
}: {
  allow: UserRole[];
  children: React.ReactNode;
}) {
  const { session, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace("/login");
      return;
    }
    if (profile && !allow.includes(profile.role)) {
      router.replace("/");
    }
  }, [loading, session, profile, allow, router]);

  if (loading || !session || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-neutral-500">
        Loading…
      </div>
    );
  }

  if (!allow.includes(profile.role)) {
    return null; // redirect is in flight
  }

  return <>{children}</>;
}

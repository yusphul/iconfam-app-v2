"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthProvider";
import RoleGateway from "@/components/RoleGateway";

const ROLE_HOME: Record<string, string> = {
  admin: "/admin",
  agent: "/agent",
  professional: "/agent",
  client: "/portal",
};

export default function Home() {
  const { session, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (session && profile) {
      router.replace(ROLE_HOME[profile.role] ?? "/login");
    }
  }, [loading, session, profile, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-blueprint text-sm text-slateSoft">
        Loading…
      </div>
    );
  }

  // Signed-in visitors are redirected above; everyone else sees the role gateway
  // instead of being bounced straight to a bare login form.
  if (!session) {
    return <RoleGateway />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-blueprint text-sm text-slateSoft">
      Taking you to your workspace…
    </div>
  );
}

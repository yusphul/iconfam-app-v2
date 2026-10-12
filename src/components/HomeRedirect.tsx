"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthProvider";

const ROLE_HOME: Record<string, string> = {
  admin: "/admin",
  agent: "/agent",
  professional: "/agent",
  client: "/portal",
};

// Sends signed-in people to their own area. Visitors see nothing from this component.
export default function HomeRedirect() {
  const { session, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (session && profile) router.replace(ROLE_HOME[profile.role] ?? "/login");
  }, [loading, session, profile, router]);

  return null;
}

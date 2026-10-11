"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

// Does this person have to be at the site (check in, live photos) before reporting?
// Field agents always; professionals only for the specialties the admin chose in Settings.
// Returns null until known. Falls back to "agents only" if the lookup fails.
export function useSiteCheckRequired(role: string | undefined, userId: string | undefined): boolean | null {
  const [needs, setNeeds] = useState<boolean | null>(null);
  useEffect(() => {
    if (!userId) return;
    if (role === "agent") {
      setNeeds(true);
      return;
    }
    if (role !== "professional") {
      setNeeds(false);
      return;
    }
    let live = true;
    supabase.rpc("my_site_check_required").then(({ data, error }) => {
      if (live) setNeeds(error ? false : data === true);
    });
    return () => {
      live = false;
    };
  }, [role, userId]);
  return needs;
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Admin-only: turns the address a client gave us into candidate map positions
// (OpenStreetMap Nominatim, no key needed). The admin picks and confirms one;
// that pin is what the field agent's check-in is measured against.

export async function GET(req: NextRequest) {
  const bearer = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!bearer) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const supa = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      global: { headers: { Authorization: `Bearer ${bearer}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );
  const { data: auth } = await supa.auth.getUser(bearer);
  if (!auth.user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const { data: me } = await supa.from("users").select("role").eq("id", auth.user.id).maybeSingle();
  if (me?.role !== "admin") return NextResponse.json({ error: "Admins only." }, { status: 403 });

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 3 || q.length > 300) {
    return NextResponse.json({ error: "Enter an address to look up." }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(q)}`,
      {
        headers: { "User-Agent": "iConfam/1.0 (site verification; admin lookup)", Accept: "application/json" },
        cache: "no-store",
      }
    );
    if (!res.ok) throw new Error(String(res.status));
    const rows = (await res.json()) as { lat: string; lon: string; display_name: string }[];
    const results = rows
      .map((r) => ({ lat: Number(r.lat), lng: Number(r.lon), label: r.display_name }))
      .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng));
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json(
      { error: "The map lookup isn't available right now. Enter the coordinates by hand instead." },
      { status: 502 }
    );
  }
}

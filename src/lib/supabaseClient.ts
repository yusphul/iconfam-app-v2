import { createClient } from "@supabase/supabase-js";

// Security note: this client uses the public "anon" key. It is safe to ship to the
// browser because every table has Row Level Security enabled (see
// supabase/migrations/0001_init_schema.sql) — the anon key alone cannot read or write
// anything the signed-in user's role isn't allowed to touch. Never put the service
// role key in this file or any file that ships to the browser.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

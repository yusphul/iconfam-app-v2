import { createBrowserClient } from '@supabase/ssr'
export function supabaseBrowser(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL; const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!url||!key) return null;
 return createBrowserClient(url,key)
}
export type Role='client'|'field_agent'|'professional'|'admin'
export type CaseStatus='requested'|'quoted'|'paid'|'assigned'|'in_progress'|'under_review'|'completed'|'cancelled'|'refunded'

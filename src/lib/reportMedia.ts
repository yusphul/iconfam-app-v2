import { supabase } from "@/lib/supabaseClient";
import type { MediaItem } from "@/lib/types";

export interface MediaView {
  path: string;
  url: string;
  type: string; // "image" | "video"
}

// Signed links for the photos and videos attached to the given reports.
// Returns the media rows too, for callers that summarise how they were captured.
export async function loadReportMedia(
  reportIds: string[]
): Promise<{ views: Record<string, MediaView[]>; rows: Record<string, MediaItem[]> }> {
  const views: Record<string, MediaView[]> = {};
  const rowsByReport: Record<string, MediaItem[]> = {};
  await Promise.all(
    reportIds.map(async (reportId) => {
      const { data } = await supabase.from("media").select("*").eq("report_id", reportId);
      const rows = (data as MediaItem[]) ?? [];
      if (rows.length === 0) return;
      rowsByReport[reportId] = rows;
      const { data: signed } = await supabase.storage
        .from("iconfam-media")
        .createSignedUrls(
          rows.map((m) => m.storage_path),
          3600
        );
      views[reportId] = rows.flatMap((row) => {
        const hit = (signed ?? []).find((s) => s.path === row.storage_path);
        return hit?.signedUrl ? [{ path: row.storage_path, url: hit.signedUrl, type: row.media_type }] : [];
      });
    })
  );
  return { views, rows: rowsByReport };
}

// A person can send one report per milestone. They can send another only if the
// admin rejected the ones they sent.
export function canSubmitReport(mine: { review_status: string }[]): boolean {
  return !mine.some((r) => r.review_status !== "rejected");
}

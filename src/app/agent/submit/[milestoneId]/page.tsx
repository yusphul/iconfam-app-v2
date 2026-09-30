"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthProvider";
import type { Milestone, ReportStatusFlag } from "@/lib/types";
import { REPORT_FLAG_LABELS } from "@/lib/types";

export default function SubmitReportPage() {
  const { milestoneId } = useParams<{ milestoneId: string }>();
  const { profile } = useAuth();
  const router = useRouter();

  const [milestone, setMilestone] = useState<Milestone | null>(null);
  const [findings, setFindings] = useState("");
  const [statusFlag, setStatusFlag] = useState<ReportStatusFlag>("confirmed_good");
  const [files, setFiles] = useState<File[]>([]);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [docType, setDocType] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("milestones").select("*").eq("id", milestoneId).single();
      setMilestone(data as Milestone);
    }
    load();
  }, [milestoneId]);

  function captureLocation() {
    if (!("geolocation" in navigator)) {
      setError("This device/browser doesn't support location. You can still submit without it.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        setError("Couldn't get your location — check permissions, or submit without it.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile || !milestone) return;
    setError(null);
    setSubmitting(true);

    const { data: report, error: reportError } = await supabase
      .from("reports")
      .insert({
        milestone_id: milestone.id,
        submitted_by: profile.id,
        findings_summary: findings,
        status_flag: statusFlag,
        geo_lat: coords?.lat ?? null,
        geo_lng: coords?.lng ?? null,
      })
      .select()
      .single();

    if (reportError || !report) {
      setError(reportError?.message ?? "Could not save the report.");
      setSubmitting(false);
      return;
    }

    for (const file of files) {
      const path = `${milestone.case_id}/${report.id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("iconfam-media")
        .upload(path, file);
      if (uploadError) {
        setError(`Report saved, but one file failed to upload: ${uploadError.message}`);
        continue;
      }
      await supabase.from("media").insert({
        report_id: report.id,
        storage_path: path,
        media_type: file.type.startsWith("video") ? "video" : "image",
      });
    }

    // Document upload — professional role only, and only when the report genuinely
    // needed one (most cases verify against the primary source directly and never
    // reach this step). Photo/scan only, never the original, with a retention
    // policy set on every row per the minimal-upload design.
    if (documentFile && profile.role === "professional") {
      const docPath = `${milestone.case_id}/${Date.now()}-${documentFile.name}`;
      const { error: docUploadError } = await supabase.storage
        .from("iconfam-documents")
        .upload(docPath, documentFile);
      if (docUploadError) {
        setError(`Report saved, but the document failed to upload: ${docUploadError.message}`);
      } else {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 90);
        await supabase.from("documents").insert({
          case_id: milestone.case_id,
          doc_type: docType || "Supporting document",
          storage_path: docPath,
          uploaded_by: profile.id,
          retention_note: "Deleted automatically 90 days after upload.",
          expires_at: expiresAt.toISOString(),
        });
      }
    }

    await supabase.from("milestones").update({ status: "in_progress" }).eq("id", milestone.id);

    setSubmitting(false);
    setDone(true);
  }

  if (done) {
    return (
      <div className="rounded-lg border border-line bg-white p-6 text-center">
        <p className="mb-4 text-verified">Report submitted — an admin will review it before it's
          shown to the client.</p>
        <button
          onClick={() => router.replace("/agent")}
          className="rounded bg-navy px-4 py-2 text-sm font-medium text-white"
        >
          Back to my cases
        </button>
      </div>
    );
  }

  if (!milestone) return <p className="text-sm text-neutral-500">Loading…</p>;

  return (
    <div>
      <h1 className="mb-1 font-display text-xl font-bold text-navy">Submit Report</h1>
      <p className="mb-6 text-sm text-neutral-500">Milestone: {milestone.name}</p>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-line bg-white p-6">
        <div>
          <label htmlFor="status-flag" className="mb-1 block text-sm font-medium text-neutral-600">
            Status
          </label>
          <select
            id="status-flag"
            value={statusFlag}
            onChange={(e) => setStatusFlag(e.target.value as ReportStatusFlag)}
            className="w-full rounded border border-line bg-paper px-3 py-2 text-sm"
          >
            {Object.entries(REPORT_FLAG_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="findings" className="mb-1 block text-sm font-medium text-neutral-600">
            Findings — plain language, exactly what you saw
          </label>
          <textarea
            id="findings"
            required
            rows={5}
            value={findings}
            onChange={(e) => setFindings(e.target.value)}
            placeholder="e.g. Visited the site at [address]. Foundation is complete and matches the approved plan. Spoke with the site foreman, [name]. No discrepancies found."
            className="w-full rounded border border-line bg-paper px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label htmlFor="media-files" className="mb-1 block text-sm font-medium text-neutral-600">
            Photos / video
          </label>
          <input
            id="media-files"
            type="file"
            accept="image/*,video/*"
            capture="environment"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            className="w-full rounded border border-line bg-paper px-3 py-2 text-sm"
          />
          {files.length > 0 && (
            <p className="mt-1 text-xs text-neutral-400">{files.length} file(s) selected</p>
          )}
        </div>

        {profile?.role === "professional" && (
          <div className="rounded border border-line bg-paper/60 p-3">
            <label htmlFor="doc-type" className="mb-1 block text-sm font-medium text-neutral-600">
              Document (only if this case genuinely needs it — most cases are
              verified directly against the registry, not by upload)
            </label>
            <input
              id="doc-type"
              type="text"
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              placeholder="What is it? e.g. Certificate of Occupancy, survey plan"
              className="mb-2 w-full rounded border border-line bg-white px-3 py-2 text-sm"
            />
            <input
              type="file"
              aria-label="Document file"
              accept="image/*,application/pdf"
              onChange={(e) => setDocumentFile(e.target.files?.[0] ?? null)}
              className="w-full rounded border border-line bg-white px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-neutral-400">
              Photo or scan only, never the original. Automatically deleted 90 days
              after upload.
            </p>
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-600">Location</label>
          <button
            type="button"
            onClick={captureLocation}
            disabled={locating}
            className="rounded border border-line bg-paper px-3 py-2 text-sm hover:border-stamp disabled:opacity-60"
          >
            {locating ? "Getting location…" : coords ? "Location captured ✓" : "Capture current location"}
          </button>
          {coords && (
            <p className="mt-1 text-xs text-neutral-400">
              {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
            </p>
          )}
        </div>

        {error && <p className="text-sm text-stamp">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-stamp py-2.5 text-sm font-semibold text-white hover:bg-stampDark disabled:opacity-60"
        >
          {submitting ? "Submitting…" : "Submit Report"}
        </button>
      </form>
    </div>
  );
}

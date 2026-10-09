"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthProvider";
import type { Milestone, ReportStatusFlag } from "@/lib/types";
import { REPORT_FLAG_LABELS } from "@/lib/types";
import BackLink from "@/components/BackLink";
import CameraCapture from "@/components/agent/CameraCapture";
import {
  CheckInResult,
  MAX_CAPTURES,
  Position,
  formatDistance,
  friendlyCheckInError,
  friendlySubmitError,
  getPosition,
} from "@/lib/siteCheck";

type Source = "live" | "device_camera" | "gallery";
interface Item {
  id: string;
  file: File;
  kind: "image" | "video";
  source: Source;
  preview: string;
  lat: number | null;
  lng: number | null;
}

export default function SubmitReportPage() {
  const { milestoneId } = useParams<{ milestoneId: string }>();
  const { profile } = useAuth();
  const router = useRouter();

  const [milestone, setMilestone] = useState<Milestone | null>(null);
  const [findings, setFindings] = useState("");
  const [statusFlag, setStatusFlag] = useState<ReportStatusFlag>("confirmed_good");
  const [items, setItems] = useState<Item[]>([]);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [docType, setDocType] = useState("");
  const [pos, setPos] = useState<Position | null>(null);
  const [checkIn, setCheckIn] = useState<CheckInResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const itemsRef = useRef<Item[]>([]);
  itemsRef.current = items;

  const isAgent = profile?.role === "agent";
  // Professionals and admins are not site-gated; field agents are.
  const unlocked = !isAgent || (checkIn?.verified ?? false);
  const minLive = isAgent ? checkIn?.min_captures ?? 3 : 0;
  const liveCount = items.filter((i) => i.source !== "gallery").length;
  const needMore = Math.max(0, minLive - liveCount);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("milestones").select("*").eq("id", milestoneId).single();
      setMilestone(data as Milestone);
    }
    load();
  }, [milestoneId]);

  useEffect(() => {
    return () => itemsRef.current.forEach((i) => URL.revokeObjectURL(i.preview));
  }, []);

  async function runCheckIn() {
    if (!milestone) return;
    setChecking(true);
    setCheckError(null);
    try {
      const p = await getPosition();
      setPos(p);
      const { data, error: rpcError } = await supabase.rpc("check_in_site", {
        p_milestone: milestone.id,
        p_lat: p.lat,
        p_lng: p.lng,
        p_accuracy: Math.round(p.accuracy),
      });
      if (rpcError) throw new Error(friendlyCheckInError(rpcError.message));
      setCheckIn(data as CheckInResult);
    } catch (e) {
      setCheckIn(null);
      setCheckError(e instanceof Error ? e.message : "Check-in failed.");
    }
    setChecking(false);
  }

  function addItems(files: File[], source: Source, at: Position | null) {
    setItems((prev) => {
      const room = Math.max(0, MAX_CAPTURES - prev.length);
      const added = files.slice(0, room).map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        kind: (file.type.startsWith("video") ? "video" : "image") as "image" | "video",
        source,
        preview: URL.createObjectURL(file),
        lat: source === "gallery" ? null : at?.lat ?? null,
        lng: source === "gallery" ? null : at?.lng ?? null,
      }));
      return [...prev, ...added];
    });
  }

  function removeItem(id: string) {
    setItems((prev) => {
      const gone = prev.find((i) => i.id === id);
      if (gone) URL.revokeObjectURL(gone.preview);
      return prev.filter((i) => i.id !== id);
    });
  }

  // Phone camera app fallback: one file per pick, but picks add up.
  async function onDeviceCamera(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    let at = pos;
    try {
      at = await getPosition();
      setPos(at);
    } catch {
      /* keep the check-in position */
    }
    addItems(files, "device_camera", at);
  }

  function onGallery(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    addItems(files, "gallery", null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile || !milestone) return;
    if (!unlocked) {
      setError("Check in at the site first.");
      return;
    }
    if (needMore > 0) {
      setError(`Take ${needMore} more live photo${needMore === 1 ? "" : "s"} or video${needMore === 1 ? "" : "s"} at the site.`);
      return;
    }
    setError(null);
    setSubmitting(true);

    const reportId = crypto.randomUUID();
    const uploaded: string[] = [];
    const media: { path: string; type: string; source: Source; lat: number | null; lng: number | null }[] = [];
    for (const [idx, it] of items.entries()) {
      const safe = it.file.name.replace(/[^A-Za-z0-9._-]/g, "_");
      const path = `${milestone.case_id}/${reportId}/${Date.now()}-${idx}-${safe}`;
      const { error: uploadError } = await supabase.storage.from("iconfam-media").upload(path, it.file);
      if (uploadError) {
        if (uploaded.length) await supabase.storage.from("iconfam-media").remove(uploaded);
        setError(`Upload failed for ${it.file.name}: ${uploadError.message}. Nothing was submitted — try again.`);
        setSubmitting(false);
        return;
      }
      uploaded.push(path);
      media.push({ path, type: it.kind, source: it.source, lat: it.lat, lng: it.lng });
    }

    const { error: reportError } = await supabase.rpc("submit_field_report", {
      p_id: reportId,
      p_milestone: milestone.id,
      p_findings: findings,
      p_flag: statusFlag,
      p_media: media,
    });
    if (reportError) {
      if (uploaded.length) await supabase.storage.from("iconfam-media").remove(uploaded);
      setError(friendlySubmitError(reportError.message));
      setSubmitting(false);
      return;
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

    // Best effort: mark the step as started. The database only lets field staff
    // move a milestone to pending/in progress; confirming is the admin's call.
    const { error: statusError } = await supabase
      .from("milestones")
      .update({ status: "in_progress" })
      .eq("id", milestone.id);
    if (statusError) console.warn("Could not update milestone status:", statusError.message);

    setSubmitting(false);
    setDone(true);
  }

  if (done) {
    return (
      <div className="rounded-lg border border-line bg-white p-6 text-center">
        <p className="mb-4 text-verified">Report submitted — an admin will review it before it's
          shown to the client.</p>
        <button
          onClick={() => router.replace(milestone ? `/agent/cases/${milestone.case_id}` : "/agent")}
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
      <BackLink href={`/agent/cases/${milestone.case_id}`}>Back to case</BackLink>
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

        {isAgent && (
          <section aria-labelledby="checkin-h" className="rounded border border-line bg-paper/60 p-4">
            <h2 id="checkin-h" className="mb-1 text-sm font-semibold text-navy">1. Check in at the site</h2>
            <p className="mb-3 text-xs text-neutral-500">
              The camera stays locked until we confirm your phone is at the property or farm.
            </p>
            {checkIn?.verified ? (
              <p role="status" className="text-sm font-medium text-verified">
                ✓ At the site{checkIn.distance_m !== undefined ? ` (${formatDistance(checkIn.distance_m)} from the marked spot)` : ""}
              </p>
            ) : (
              <>
                <button type="button" onClick={runCheckIn} disabled={checking}
                  className="rounded bg-navy px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
                  {checking ? "Checking your location…" : checkIn ? "Check in again" : "Check in at the site"}
                </button>
                {checkIn && !checkIn.verified && (
                  <p role="alert" className="mt-2 text-sm text-stamp">
                    You are {formatDistance(checkIn.distance_m ?? 0)} from the site. Move to within {formatDistance(checkIn.radius_m ?? 0)} and check in again.
                  </p>
                )}
                {checkError && <p role="alert" className="mt-2 text-sm text-stamp">{checkError}</p>}
              </>
            )}
          </section>
        )}

        <section aria-labelledby="capture-h" className="rounded border border-line p-4">
          <h2 id="capture-h" className="mb-1 text-sm font-semibold text-navy">
            {isAgent ? "2. " : ""}Photos and video
          </h2>
          {isAgent && (
            <p className={`mb-3 text-xs ${needMore > 0 ? "text-stamp" : "text-verified"}`}>
              Live captures: {liveCount} of {minLive} required
              {needMore > 0 ? ` — take ${needMore} more at the site` : " ✓"}
            </p>
          )}
          {!unlocked && (
            <p className="mb-3 rounded bg-paper p-3 text-sm text-neutral-500">
              Locked. Check in at the site to open the camera.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={!unlocked} onClick={() => setCameraOpen(true)}
              className="rounded bg-stamp px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">
              Open camera
            </button>
            <label className={`rounded border border-line px-4 py-2 text-sm ${unlocked ? "cursor-pointer hover:border-stamp" : "cursor-not-allowed opacity-40"}`}>
              Use phone camera app
              <input type="file" accept="image/*,video/*" capture="environment" disabled={!unlocked}
                onChange={onDeviceCamera} className="sr-only" />
            </label>
            <label className={`rounded border border-line px-4 py-2 text-sm ${unlocked ? "cursor-pointer hover:border-stamp" : "cursor-not-allowed opacity-40"}`}>
              Add from gallery
              <input type="file" accept="image/*,video/*" multiple disabled={!unlocked}
                onChange={onGallery} aria-label="Add photos or videos from gallery" className="sr-only" />
            </label>
          </div>
          <p className="mt-2 text-xs text-neutral-400">
            Add as many as you need. Gallery files are marked as “not taken live” for the reviewer and don’t count toward the minimum.
          </p>
          {items.length > 0 && (
            <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4" aria-label="Selected photos and videos">
              {items.map((it) => (
                <li key={it.id} className="relative overflow-hidden rounded border border-line bg-black/5">
                  {it.kind === "video" ? (
                    <video src={it.preview} muted playsInline className="h-24 w-full object-cover" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.preview} alt="" className="h-24 w-full object-cover" />
                  )}
                  <span className={`absolute bottom-0 left-0 right-0 px-1 py-0.5 text-[10px] text-white ${it.source === "gallery" ? "bg-neutral-600" : "bg-verified"}`}>
                    {it.source === "gallery" ? "Gallery" : it.kind === "video" ? "Live video" : "Live photo"}
                  </span>
                  <button type="button" onClick={() => removeItem(it.id)} aria-label="Remove"
                    className="absolute right-1 top-1 rounded-full bg-black/70 px-1.5 text-xs text-white">×</button>
                </li>
              ))}
            </ul>
          )}
        </section>

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

        {error && <p className="text-sm text-stamp">{error}</p>}

        <button
          type="submit"
          disabled={submitting || !unlocked}
          className="w-full rounded bg-stamp py-2.5 text-sm font-semibold text-white hover:bg-stampDark disabled:opacity-60"
        >
          {submitting ? "Submitting…" : "Submit Report"}
        </button>
      </form>
      {cameraOpen && (
        <CameraCapture
          count={items.length}
          stamp={pos ? `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}` : ""}
          onClose={() => setCameraOpen(false)}
          onCapture={(file) => addItems([file], "live", pos)}
        />
      )}
    </div>
  );
}

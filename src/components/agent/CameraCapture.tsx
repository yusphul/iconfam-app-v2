"use client";

import { useEffect, useRef, useState } from "react";

// A live in-app camera. Photos are stamped with the time and place they were
// taken; videos are recorded straight from the camera. Nothing here can pick a
// file from the gallery, which is what makes these "live" captures.
export default function CameraCapture({
  stamp,
  onCapture,
  onClose,
  count,
}: {
  stamp: string;
  onCapture: (file: File, kind: "image" | "video") => void;
  onClose: () => void;
  count: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canRecord = typeof MediaRecorder !== "undefined";

  useEffect(() => {
    let cancelled = false;
    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("This browser can't open the camera here. Use “Use phone camera app” instead.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 } },
          audio: canRecord,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        setReady(true);
      } catch {
        // Retry without audio (some devices refuse the microphone).
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          if (cancelled) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play().catch(() => undefined);
          }
          setReady(true);
        } catch {
          setError("Camera is blocked. Allow camera access for this site in your browser settings, then reopen it.");
        }
      }
    }
    start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [canRecord]);

  function takePhoto() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0);
    const size = Math.max(14, Math.round(canvas.width / 48));
    ctx.font = `${size}px sans-serif`;
    const text = `${new Date().toLocaleString()}  ${stamp}`;
    const w = ctx.measureText(text).width + size;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, canvas.height - size * 1.9, w, size * 1.9);
    ctx.fillStyle = "#fff";
    ctx.fillText(text, size / 2, canvas.height - size * 0.6);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        onCapture(new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" }), "image");
      },
      "image/jpeg",
      0.85
    );
  }

  function toggleRecording() {
    if (recording) {
      recorderRef.current?.stop();
      return;
    }
    const stream = streamRef.current;
    if (!stream || !canRecord) return;
    chunksRef.current = [];
    const rec = new MediaRecorder(stream);
    rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
    rec.onstop = () => {
      const type = rec.mimeType || "video/webm";
      const ext = type.includes("mp4") ? "mp4" : "webm";
      const blob = new Blob(chunksRef.current, { type });
      onCapture(new File([blob], `video-${Date.now()}.${ext}`, { type }), "video");
      setRecording(false);
    };
    recorderRef.current = rec;
    rec.start();
    setRecording(true);
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Site camera" className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="relative flex-1 overflow-hidden">
        {error ? (
          <p className="p-6 text-sm text-white">{error}</p>
        ) : (
          <video ref={videoRef} playsInline muted autoPlay className="h-full w-full object-contain" />
        )}
        {recording && (
          <span className="absolute left-3 top-3 rounded bg-stamp px-2 py-1 text-xs font-semibold text-white">
            Recording…
          </span>
        )}
        <span className="absolute right-3 top-3 rounded bg-black/60 px-2 py-1 text-xs text-white">
          {count} saved
        </span>
      </div>
      <div className="flex items-center justify-between gap-3 bg-footerBg p-4">
        <button type="button" onClick={onClose} disabled={recording}
          className="rounded border border-white/30 px-4 py-2 text-sm text-white disabled:opacity-50">
          Done
        </button>
        <button type="button" onClick={takePhoto} disabled={!ready || recording} aria-label="Take photo"
          className="h-16 w-16 rounded-full border-4 border-white bg-white/90 disabled:opacity-40" />
        {canRecord ? (
          <button type="button" onClick={toggleRecording} disabled={!ready}
            className={`rounded px-4 py-2 text-sm font-semibold text-white ${recording ? "bg-stamp" : "bg-white/20"}`}>
            {recording ? "Stop video" : "Record video"}
          </button>
        ) : (
          <span className="w-24" />
        )}
      </div>
    </div>
  );
}

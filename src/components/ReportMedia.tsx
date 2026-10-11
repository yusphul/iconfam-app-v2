import type { MediaView } from "@/lib/reportMedia";

// The photos and videos on a report. Photos open full size in a new tab;
// videos play in place.
export default function ReportMedia({ media }: { media: MediaView[] }) {
  if (media.length === 0) return null;
  return (
    <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4" aria-label="Photos and videos on this report">
      {media.map((m, i) => (
        <li key={m.path + i}>
          {m.type === "video" ? (
            <video
              src={m.url}
              controls
              preload="metadata"
              playsInline
              aria-label="Video on this report"
              className="aspect-square w-full rounded border border-line bg-black object-cover"
            />
          ) : (
            <a href={m.url} target="_blank" rel="noreferrer" aria-label="Open photo full size">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.url} alt="Field evidence" className="aspect-square w-full rounded border border-line object-cover" />
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

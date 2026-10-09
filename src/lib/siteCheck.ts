// Helpers for the field agent's site check-in and in-app capture.

export interface CheckInResult {
  verified: boolean;
  gated: boolean;
  distance_m?: number;
  radius_m?: number;
  min_captures: number;
}

export interface Position {
  lat: number;
  lng: number;
  accuracy: number;
}

export function getPosition(): Promise<Position> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      reject(new Error("This browser can't share its location. Try another browser or phone."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) =>
        reject(
          new Error(
            err.code === err.PERMISSION_DENIED
              ? "Location is blocked. Allow location for this site in your browser settings, then try again."
              : "Couldn't get your location. Move to an open area and try again."
          )
        ),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  });
}

export function friendlyCheckInError(message: string): string {
  if (/site_not_set/.test(message))
    return "This site's map position hasn't been set yet. Ask the admin to set it, then check in again.";
  if (/not assigned/i.test(message)) return "You are not assigned to this case.";
  return message;
}

export function friendlySubmitError(message: string): string {
  if (/not_checked_in/.test(message))
    return "Your site check-in has expired or wasn't verified. Check in at the site again, then submit.";
  if (/not_enough_captures/.test(message)) return message.replace(/^.*?:\s*/, "");
  if (/invalid_media_path/.test(message)) return "A file was uploaded to the wrong place. Remove it and add it again.";
  return message;
}

export function formatDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;
}

export const MAX_CAPTURES = 40;

// One line for reviewers: was the agent at the site, and how was the evidence captured?
export function captureSummary(
  distanceM: number | null | undefined,
  rows: { capture_source: string }[]
): string {
  const live = rows.filter((r) => r.capture_source === "live" || r.capture_source === "device_camera").length;
  const gallery = rows.filter((r) => r.capture_source === "gallery").length;
  const parts: string[] = [];
  parts.push(distanceM == null ? "No site check-in" : `Checked in ${formatDistance(distanceM)} from the marked spot`);
  parts.push(`${live} live`);
  if (gallery) parts.push(`${gallery} from gallery`);
  return parts.join(" · ");
}

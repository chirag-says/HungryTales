"use client";

export type GeoResult =
  | { ok: true; lat: number; lng: number; accuracy: number }
  | { ok: false; reason: "denied" | "unavailable" | "timeout" | "unsupported"; message: string };

/** Current permission state without prompting, when the browser can tell us. */
export async function locationPermission(): Promise<PermissionState | "unknown"> {
  try {
    if (!navigator.permissions) return "unknown";
    const status = await navigator.permissions.query({ name: "geolocation" });
    return status.state;
  } catch {
    return "unknown";
  }
}

/** One-shot position. Coarse accuracy is fine: it is only used to place a pin and suggest nearby places. */
export function getCurrentPosition(): Promise<GeoResult> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) {
      resolve({ ok: false, reason: "unsupported", message: "This browser can't share your location." });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ ok: true, lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          resolve({ ok: false, reason: "denied", message: "Location is blocked for this site. You can still type the place, or allow location in your browser settings." });
        } else if (err.code === err.TIMEOUT) {
          resolve({ ok: false, reason: "timeout", message: "Finding your location took too long. Try again, or type the place." });
        } else {
          resolve({ ok: false, reason: "unavailable", message: "Your location isn't available right now. Type the place instead." });
        }
      },
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 60_000 },
    );
  });
}

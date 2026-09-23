/**
 * Hands the files picked in the Add Memory sheet to the /add page.
 * File objects are references to the device's storage, not loaded bytes,
 * so holding them here briefly costs almost nothing. The page takes them once.
 */
export type CaptureSource = "camera" | "gallery" | "manual";

let pending: { files: File[]; source: CaptureSource } | null = null;

export function stashCapture(files: File[], source: CaptureSource) {
  pending = { files, source };
}

export function takeCapture(): { files: File[]; source: CaptureSource } | null {
  const value = pending;
  pending = null;
  return value;
}

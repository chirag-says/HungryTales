import { DUPLICATES } from "./config";

export interface PhotoFingerprint {
  /** sha256 of the original file bytes. */
  hash: string | null;
  /** EXIF capture time, "YYYY-MM-DDTHH:MM:SS" wall clock. */
  takenAt: string | null;
  width: number | null;
  height: number | null;
}

export interface KnownPhoto extends PhotoFingerprint {
  memoryId: string;
}

export type DuplicateKind = "identical" | "same-moment";

export interface DuplicateWarning {
  index: number;
  kind: DuplicateKind;
  memoryId: string | null; // null when the duplicate is within the current selection
}

function secondsApart(a: string, b: string): number {
  return Math.abs(Date.parse(`${a}Z`) - Date.parse(`${b}Z`)) / 1000;
}

function sameMoment(a: PhotoFingerprint, b: PhotoFingerprint): boolean {
  if (!a.takenAt || !b.takenAt) return false;
  const seconds = secondsApart(a.takenAt, b.takenAt);
  if (!Number.isFinite(seconds) || seconds > DUPLICATES.sameMomentSeconds) return false;
  // Same moment *and* same shape; burst shots differ in content but that is still worth a soft warning.
  const dims = (p: PhotoFingerprint) => (p.width && p.height ? [Math.max(p.width, p.height), Math.min(p.width, p.height)].join("x") : null);
  return dims(a) != null && dims(a) === dims(b);
}

/**
 * Soft duplicate detection for a new selection against saved photos and against itself.
 * Identical bytes are certain; same capture second and size is "looks similar".
 * Callers only warn; they never block.
 */
export function findDuplicates(selection: PhotoFingerprint[], known: KnownPhoto[]): DuplicateWarning[] {
  const warnings: DuplicateWarning[] = [];
  selection.forEach((photo, index) => {
    const identical = photo.hash ? known.find((k) => k.hash === photo.hash) : undefined;
    if (identical) return warnings.push({ index, kind: "identical", memoryId: identical.memoryId });
    const earlier = selection.slice(0, index).find((p) => p.hash && p.hash === photo.hash);
    if (earlier) return warnings.push({ index, kind: "identical", memoryId: null });
    const similar = known.find((k) => sameMoment(photo, k));
    if (similar) return warnings.push({ index, kind: "same-moment", memoryId: similar.memoryId });
  });
  return warnings;
}

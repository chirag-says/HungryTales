"use client";

import { LIMITS } from "@/lib/domain";
import { isValidLatLng } from "@/lib/engine/geo";

/**
 * Everything that happens to a photo on the device before upload:
 * read EXIF (as suggestions), fingerprint it, decode with correct orientation,
 * and re-encode one JPEG. Re-encoding drops all EXIF, so GPS and camera details
 * never reach storage. Smaller sizes are generated on delivery by Cloudinary.
 */

export interface PhotoMeta {
  /** "YYYY-MM-DDTHH:MM:SS" as written by the camera (local wall clock), if present. */
  takenAt: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface ProcessedPhoto {
  blob: Blob;
  width: number;
  height: number;
}

export class PhotoError extends Error {}

const MAX_EDGE = 2560;

function exifDateToWallClock(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const m = /^(\d{4})[:-](\d{2})[:-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(value.trim());
  if (!m || m[1] === "0000") return null;
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`;
}

export async function readPhotoMeta(file: File): Promise<PhotoMeta> {
  try {
    const exifr = (await import("exifr")).default;
    const [tags, gps] = await Promise.all([
      exifr.parse(file, { pick: ["DateTimeOriginal", "CreateDate"], reviveValues: false }).catch(() => null),
      exifr.gps(file).catch(() => null),
    ]);
    const takenAt = exifDateToWallClock(tags?.DateTimeOriginal) ?? exifDateToWallClock(tags?.CreateDate);
    const hasGps = gps && isValidLatLng(gps.latitude, gps.longitude);
    return { takenAt, latitude: hasGps ? gps.latitude : null, longitude: hasGps ? gps.longitude : null };
  } catch {
    // Missing or unreadable metadata is normal (screenshots, messaging apps). Fall back to manual entry.
    return { takenAt: null, latitude: null, longitude: null };
  }
}

export async function hashFile(file: File): Promise<string | null> {
  if (!crypto?.subtle) return null;
  try {
    const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return null;
  }
}

export function validatePhotoFile(file: File): string | null {
  const looksLikeImage = file.type.startsWith("image/") || /\.(heic|heif|jpe?g|png|webp|avif)$/i.test(file.name);
  if (!looksLikeImage) return `"${file.name}" isn't a photo.`;
  if (file.size > LIMITS.photoInputMaxBytes) return `"${file.name}" is over ${Math.round(LIMITS.photoInputMaxBytes / 1024 / 1024)} MB.`;
  if (file.size === 0) return `"${file.name}" is empty.`;
  return null;
}

type Drawable = ImageBitmap | HTMLImageElement;

async function decode(file: File): Promise<{ source: Drawable; width: number; height: number; release: () => void }> {
  try {
    // imageOrientation applies the EXIF rotation so phone photos are upright.
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = "async";
      img.src = url;
      await img.decode();
      return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) };
    } catch {
      URL.revokeObjectURL(url);
      throw new PhotoError(
        /\.(heic|heif)$/i.test(file.name) || /heic|heif/i.test(file.type)
          ? "This browser can't open HEIC photos. Share it as JPEG (most phones do this automatically from the gallery), or try another browser."
          : "This photo couldn't be opened. It may be damaged or in an unsupported format.",
      );
    }
  }
}

function fit(width: number, height: number, maxEdge: number) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

async function encode(source: Drawable, width: number, height: number, quality: number): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new PhotoError("Your browser couldn't prepare this photo.");
  ctx.fillStyle = "#ffffff"; // transparent PNGs become white, not black
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  canvas.width = canvas.height = 0; // free the backing store promptly on iOS
  if (!blob) throw new PhotoError("Your browser couldn't prepare this photo.");
  return blob;
}

export async function processPhoto(file: File): Promise<ProcessedPhoto> {
  const decoded = await decode(file);
  try {
    const size = fit(decoded.width, decoded.height, MAX_EDGE);
    let blob = await encode(decoded.source, size.width, size.height, 0.86);
    if (blob.size > LIMITS.photoUploadMaxBytes) blob = await encode(decoded.source, size.width, size.height, 0.7);
    return { blob, width: size.width, height: size.height };
  } finally {
    decoded.release();
  }
}

export interface UploadTarget {
  url: string;
  method: "PUT" | "POST";
  headers: Record<string, string>;
  fields?: Record<string, string>;
}

export interface UploadReceipt {
  version?: number;
  signature?: string;
}

/**
 * XHR rather than fetch so we get real upload progress on phones.
 * POST targets (Cloudinary) get multipart form data; PUT targets get the raw bytes.
 * Resolves with the service's signed receipt, which the server verifies on save.
 */
export function uploadBlob(target: UploadTarget, blob: Blob, onProgress?: (fraction: number) => void, signal?: AbortSignal): Promise<UploadReceipt | null> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(target.method, target.url);
    for (const [k, v] of Object.entries(target.headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new PhotoError(xhr.status === 413 ? "That photo is too large to upload." : "Upload failed. Check your connection and retry."));
        return;
      }
      try {
        const body = JSON.parse(xhr.responseText) as { version?: unknown; signature?: unknown };
        resolve({
          version: typeof body.version === "number" ? body.version : undefined,
          signature: typeof body.signature === "string" ? body.signature : undefined,
        });
      } catch {
        resolve(null);
      }
    };
    xhr.onerror = () => reject(new PhotoError("Upload failed. Check your connection and retry."));
    xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"));
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    if (target.fields) {
      const form = new FormData();
      for (const [k, v] of Object.entries(target.fields)) form.append(k, v);
      form.append("file", blob, "photo.jpg");
      xhr.send(form);
    } else {
      xhr.send(blob);
    }
  });
}

import "server-only";
import { usesCloudinary } from "@/lib/env";
import { cloudinaryDriver } from "./cloudinary";
import { localStorageDriver } from "./local";

export interface UploadTarget {
  url: string;
  method: "PUT" | "POST";
  headers: Record<string, string>;
  /** Multipart form fields sent alongside the file (POST targets). */
  fields?: Record<string, string>;
}

export interface PhotoUrls {
  /** ~720px, for cards and grids. */
  thumb: string;
  /** ~2048px, for hero images and the full-screen viewer. */
  display: string;
}

/** What the browser got back from the storage service after uploading; verified server-side. */
export interface UploadReceipt {
  version?: number;
  signature?: string;
}

export interface StorageDriver {
  createUploadTarget(key: string): Promise<UploadTarget>;
  /** Confirm the object really was uploaded to `key` (no trust in the client's word). */
  confirmUpload(key: string, receipt: UploadReceipt | null): Promise<boolean>;
  urls(keys: string[]): Promise<Record<string, PhotoUrls>>;
  remove(keys: string[]): Promise<void>;
}

export function storage(): StorageDriver {
  if (usesCloudinary()) return cloudinaryDriver();
  if (process.env.NODE_ENV === "production") throw new Error("Photo storage is not configured");
  return localStorageDriver();
}

/** Photo object keys are always derived on the server from ids it issued. */
export function photoKey(duoId: string, photoId: string): string {
  return `hungrytales/${duoId}/${photoId}`;
}

export async function signPhotoUrls(keys: string[]): Promise<Record<string, PhotoUrls>> {
  const unique = [...new Set(keys)];
  if (unique.length === 0) return {};
  return storage().urls(unique);
}

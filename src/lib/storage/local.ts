import "server-only";
import { rm, stat } from "node:fs/promises";
import path from "node:path";
import { hmac, safeEqual } from "@/lib/auth/crypto";
import type { StorageDriver } from "./index";

/**
 * Development-only photo storage on local disk, mirroring the production flow:
 * the browser uploads to a signed URL and reads through signed URLs.
 * There are no resized variants locally; thumb and display serve the same file.
 * The route that serves these refuses to run in production.
 */
export const LOCAL_STORAGE_ROOT = path.join(process.cwd(), ".data", "storage");
const UPLOAD_TTL_SECONDS = 2 * 60 * 60;
/** Read URLs rotate in fixed windows so the browser cache still works. */
const READ_WINDOW_SECONDS = 3 * 60 * 60;

const KEY_RE = /^hungrytales\/[0-9a-f-]{36}\/[0-9a-f-]{36}$/;

export function localPathFor(key: string): string | null {
  if (!KEY_RE.test(key)) return null;
  return path.join(LOCAL_STORAGE_ROOT, ...key.split("/")) + ".jpg";
}

function sign(action: "read" | "write", key: string, exp: number): string {
  return hmac(`${action}:${key}:${exp}`);
}

export function verifyLocal(action: "read" | "write", key: string, exp: number, sig: string): boolean {
  return Number.isFinite(exp) && exp > Date.now() / 1000 && safeEqual(sign(action, key, exp), sig);
}

function url(action: "read" | "write", key: string, exp: number): string {
  return `/api/dev-storage/${key}?exp=${exp}&sig=${sign(action, key, exp)}`;
}

export function localStorageDriver(): StorageDriver {
  return {
    async createUploadTarget(key) {
      const exp = Math.floor(Date.now() / 1000) + UPLOAD_TTL_SECONDS;
      return { url: url("write", key, exp), method: "PUT", headers: { "content-type": "image/jpeg" } };
    },
    async confirmUpload(key) {
      const p = localPathFor(key);
      if (!p) return false;
      return stat(p).then(
        (s) => s.isFile(),
        () => false,
      );
    },
    async urls(keys) {
      const window = Math.floor(Date.now() / 1000 / READ_WINDOW_SECONDS);
      const exp = (window + 2) * READ_WINDOW_SECONDS;
      return Object.fromEntries(keys.map((k) => [k, { thumb: url("read", k, exp), display: url("read", k, exp) }]));
    },
    async remove(keys) {
      for (const key of keys) {
        const p = localPathFor(key);
        if (p) await rm(p, { force: true });
      }
    },
  };
}
